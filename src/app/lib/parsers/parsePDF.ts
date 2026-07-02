import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import {
  CorruptedFileError,
  EmptyDocumentError,
  EncryptedPdfError,
  SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE,
  SCANNED_PDF_PAGE_FRACTION,
  type ParsedDocument,
} from "./types";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export type PdfPageText = { num: number; text: string };

// ---------------------------------------------------------------------------
// Text-extraction tuning constants
// ---------------------------------------------------------------------------

const LINE_Y_TOLERANCE = 3;
const HEADING_FONT_SIZE_RATIO = 1.15;
const COLUMN_GAP_CHAR_WIDTHS = 4;
const WORD_GAP_CHAR_WIDTHS = 0.3;
const PAGE_NUMBER_LINE = /^(page\s+)?\d+(\s+of\s+\d+)?$/i;
const MAX_HEADING_LENGTH = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

function isPasswordException(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: unknown }).name === "PasswordException"
  );
}

// ---------------------------------------------------------------------------
// Page text assembly
// ---------------------------------------------------------------------------

/**
 * Converts pdfjs TextContent items for a single page into a string that
 * preserves reading order, detects headings, and approximates table columns
 * with double-space gaps.
 */
export function buildPageText(rawItems: (TextItem | unknown)[]): string {
  const items = rawItems.filter(isTextItem).filter((item) => item.str.length > 0);
  if (items.length === 0) return "";

  type Line = { y: number; items: TextItem[] };
  const lines: Line[] = [];

  for (const item of items) {
    const y = item.transform[5] as number;
    const existing = lines.find((l) => Math.abs(l.y - y) <= LINE_Y_TOLERANCE);
    if (existing) {
      existing.items.push(item);
    } else {
      lines.push({ y, items: [item] });
    }
  }

  // PDF y-coordinates grow upward → descending y = top-to-bottom.
  lines.sort((a, b) => b.y - a.y);

  const fontSizes = items
    .map((i) => Math.abs(i.transform[3] as number))
    .filter((n) => n > 0);
  const medianFontSize = median(fontSizes);

  const textLines: string[] = [];

  for (const line of lines) {
    line.items.sort((a, b) => (a.transform[4] as number) - (b.transform[4] as number));

    let lineText = "";
    let prevItem: TextItem | null = null;

    for (const item of line.items) {
      if (prevItem) {
        const prevRight = (prevItem.transform[4] as number) + prevItem.width;
        const gap = (item.transform[4] as number) - prevRight;
        const charWidth = prevItem.width / Math.max(prevItem.str.length, 1);

        if (gap > charWidth * COLUMN_GAP_CHAR_WIDTHS) {
          lineText += "  "; // wide gap → likely a table column boundary
        } else if (gap > charWidth * WORD_GAP_CHAR_WIDTHS) {
          lineText += " ";
        }
      }
      lineText += item.str;
      prevItem = item;
    }

    lineText = lineText.trim();
    if (!lineText) continue;

    const lineFontSize = Math.max(
      ...line.items.map((i) => Math.abs(i.transform[3] as number))
    );
    const isHeading =
      medianFontSize > 0 &&
      lineFontSize >= medianFontSize * HEADING_FONT_SIZE_RATIO &&
      lineText.length < MAX_HEADING_LENGTH;

    textLines.push(isHeading ? `## ${lineText}` : lineText);
  }

  return textLines.join("\n");
}

// ---------------------------------------------------------------------------
// Header / footer stripping
// ---------------------------------------------------------------------------

/**
 * Removes lines that appear at the top or bottom of ≥50% of pages
 * (i.e. repeated headers / footers) and standalone page-number lines.
 */
export function stripHeadersAndFooters(pages: PdfPageText[]): string {
  if (pages.length === 0) return "";

  const pageLines = pages.map((p) =>
    p.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );

  const lineFrequency = new Map<string, number>();

  for (const lines of pageLines) {
    // Only look at the first two and last two lines of each page.
    const edgeLines = new Set([...lines.slice(0, 2), ...lines.slice(-2)]);
    for (const line of edgeLines) {
      lineFrequency.set(line, (lineFrequency.get(line) ?? 0) + 1);
    }
  }

  const repeatThreshold = Math.max(2, Math.ceil(pages.length * 0.5));
  const repeatedLines = new Set(
    [...lineFrequency.entries()]
      .filter(([, count]) => count >= repeatThreshold)
      .map(([line]) => line)
  );

  const cleaned = pageLines.map((lines) =>
    lines
      .filter((line) => !repeatedLines.has(line) && !PAGE_NUMBER_LINE.test(line))
      .join("\n")
  );

  return cleaned.filter(Boolean).join("\n\n").trim();
}

// ---------------------------------------------------------------------------
// Scanned-PDF detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the extracted text is too sparse to be a real text layer.
 *
 * Uses two independent signals — both must be satisfied:
 *  1. A high fraction of individual pages are nearly empty (< 20 chars).
 *  2. The overall document average is also below threshold.
 *
 * This is more robust than a simple average because it correctly handles
 * mixed documents where many pages are scanned and a few have dense text.
 */
export function isScannedPdf(pages: { text: string }[]): boolean {
  if (pages.length === 0) return false;

  const sparsePages = pages.filter(
    (p) => p.text.trim().length < SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE
  );
  const sparseFraction = sparsePages.length / pages.length;

  const totalChars = pages.reduce((s, p) => s + p.text.trim().length, 0);
  const avgCharsPerPage = totalChars / pages.length;

  // Trigger OCR if ≥35% of pages are sparse AND the average is also low.
  return (
    sparseFraction >= SCANNED_PDF_PAGE_FRACTION &&
    avgCharsPerPage < SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE * 3
  );
}

// ---------------------------------------------------------------------------
// Core extraction
// ---------------------------------------------------------------------------

/**
 * Loads the PDF, extracts each page's text layer, and returns the raw per-page
 * results along with the total page count.
 *
 * Throws:
 *  - EncryptedPdfError  — when pdfjs reports a password is required
 *  - CorruptedFileError — for any other load / parse failure
 */
export async function getPdfPageTexts(
  buffer: Buffer
): Promise<{ pages: PdfPageText[]; total: number }> {
  console.log("[getPdfPageTexts] ENTER", { bufferBytes: buffer.length });

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  let doc: Awaited<typeof loadingTask.promise>;

  try {
    doc = await loadingTask.promise;
  } catch (err) {
    console.error("[getPdfPageTexts] getDocument().promise THREW", {
      constructorName: (err as Error)?.constructor?.name,
      name: (err as Record<string,unknown>)?.name,
      message: (err as Error)?.message,
      stack: (err as Error)?.stack,
    });
    if (isPasswordException(err)) throw new EncryptedPdfError();
    throw new CorruptedFileError();
  }

  const total = doc.numPages;
  console.log("[getPdfPageTexts] doc loaded", { total });

  const pages: PdfPageText[] = [];

  // No broad catch here — let the real exception propagate with its original
  // identity so the top-level handler can log it properly.
  for (let pageNum = 1; pageNum <= total; pageNum++) {
    console.log("[getPdfPageTexts] getPage", { pageNum });
    const page = await doc.getPage(pageNum);

    console.log("[getPdfPageTexts] getTextContent", { pageNum });
    const textContent = await page.getTextContent();

    console.log("[getPdfPageTexts] textContent received", {
      pageNum,
      itemCount: textContent.items.length,
      firstItemKeys: textContent.items[0] ? Object.keys(textContent.items[0]) : [],
    });

    const text = buildPageText(textContent.items);
    console.log("[getPdfPageTexts] buildPageText result", { pageNum, chars: text.length });

    pages.push({ num: pageNum, text });
    page.cleanup();
  }

  await loadingTask.destroy();
  console.log("[getPdfPageTexts] EXIT", { totalPages: total, pagesExtracted: pages.length });
  return { pages, total };
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

export function buildPdfDocument(
  pages: PdfPageText[],
  total: number,
  filename: string,
  sizeBytes: number,
  ocrUsed = false
): ParsedDocument {
  console.log("[buildPdfDocument] ENTER", {
    filename,
    total,
    pageCharCounts: pages.map((p) => ({ num: p.num, chars: p.text.trim().length })),
  });

  const text = stripHeadersAndFooters(pages);

  console.log("[buildPdfDocument] stripHeadersAndFooters result", {
    filename,
    charsBeforeStrip: pages.reduce((s, p) => s + p.text.trim().length, 0),
    charsAfterStrip: text.trim().length,
    first200chars: text.slice(0, 200),
  });

  if (!text.trim()) {
    console.error("[buildPdfDocument] EMPTY after strip — throwing EmptyDocumentError", { filename });
    throw new EmptyDocumentError();
  }

  console.log("[buildPdfDocument] EXIT success", { filename, chars: text.length });

  return {
    text,
    metadata: { filename, fileType: "pdf", sizeBytes, pages: total, ocrUsed },
  };
}

// ---------------------------------------------------------------------------
// Public single-shot API
// ---------------------------------------------------------------------------

/**
 * Full parse for a PDF that is known (or assumed) to have a text layer.
 * Route handlers that need scanned-PDF detection should call
 * `getPdfPageTexts` + `isScannedPdf` directly.
 */
export async function parsePDF(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const t0 = Date.now();
  console.log("[parser:pdf] starting text extraction", { filename, sizeBytes: buffer.length });

  const { pages, total } = await getPdfPageTexts(buffer);
  const doc = buildPdfDocument(pages, total, filename, buffer.length);

  console.log("[parser:pdf] done", {
    filename,
    pages: total,
    chars: doc.text.length,
    durationMs: Date.now() - t0,
  });

  return doc;
}
