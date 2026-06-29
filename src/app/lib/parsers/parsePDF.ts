import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import {
  CorruptedFileError,
  EmptyDocumentError,
  SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE,
  type ParsedDocument,
} from "./types";

export type PdfPageText = { num: number; text: string };

const PAGE_NUMBER_LINE = /^(page\s+)?\d+(\s+of\s+\d+)?$/i;

// A line whose dominant font size is at least this much larger than the
// page's median body-text size is treated as a heading.
const HEADING_FONT_SIZE_RATIO = 1.15;

// Vertical distance (PDF user-space units) within which two text items are
// considered to sit on the same line.
const LINE_Y_TOLERANCE = 3;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

/**
 * Groups raw text items into reading-order lines, joins them with
 * gap-aware spacing (wide horizontal gaps become double-spaces, approximating
 * flattened table columns), and prefixes oversized lines as Markdown headings.
 */
function buildPageText(rawItems: (TextItem | unknown)[]): string {
  const items = rawItems.filter(isTextItem).filter((item) => item.str.length > 0);
  if (items.length === 0) return "";

  type Line = { y: number; items: TextItem[] };
  const lines: Line[] = [];

  for (const item of items) {
    const y = item.transform[5] as number;
    const line = lines.find((l) => Math.abs(l.y - y) <= LINE_Y_TOLERANCE);
    if (line) {
      line.items.push(item);
    } else {
      lines.push({ y, items: [item] });
    }
  }

  // PDF y-coordinates grow upward, so descending y is top-to-bottom reading order.
  lines.sort((a, b) => b.y - a.y);

  const fontSizes = items.map((i) => Math.abs(i.transform[3] as number)).filter((n) => n > 0);
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

        if (gap > charWidth * 4) {
          lineText += "  ";
        } else if (gap > charWidth * 0.3) {
          lineText += " ";
        }
      }
      lineText += item.str;
      prevItem = item;
    }

    lineText = lineText.trim();
    if (!lineText) continue;

    const lineFontSize = Math.max(...line.items.map((i) => Math.abs(i.transform[3] as number)));
    const isHeading =
      medianFontSize > 0 &&
      lineFontSize >= medianFontSize * HEADING_FONT_SIZE_RATIO &&
      lineText.length < 120;

    textLines.push(isHeading ? `## ${lineText}` : lineText);
  }

  return textLines.join("\n");
}

/**
 * Strips repeated header/footer lines (same text on >50% of pages) and
 * standalone page-number lines, then rejoins pages with blank-line separators.
 */
export function stripHeadersAndFooters(pages: PdfPageText[]): string {
  const pageLines = pages.map((p) =>
    p.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );

  const lineFrequency = new Map<string, number>();

  for (const lines of pageLines) {
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

  const cleanedPages = pageLines.map((lines) =>
    lines
      .filter((line) => !repeatedLines.has(line) && !PAGE_NUMBER_LINE.test(line))
      .join("\n")
  );

  return cleanedPages.filter(Boolean).join("\n\n").trim();
}

export async function getPdfPageTexts(
  buffer: Buffer
): Promise<{ pages: PdfPageText[]; total: number }> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  let doc;

  try {
    doc = await loadingTask.promise;
  } catch {
    throw new CorruptedFileError();
  }

  const total = doc.numPages;
  const pages: PdfPageText[] = [];

  try {
    for (let pageNum = 1; pageNum <= total; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      pages.push({ num: pageNum, text: buildPageText(textContent.items) });
      await page.cleanup();
    }
  } catch {
    throw new CorruptedFileError();
  } finally {
    await loadingTask.destroy();
  }

  return { pages, total };
}

export function isScannedPdf(pages: { text: string }[]): boolean {
  const totalChars = pages.reduce((sum, p) => sum + p.text.trim().length, 0);
  const avgCharsPerPage = pages.length > 0 ? totalChars / pages.length : 0;
  return avgCharsPerPage < SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE;
}

export function buildPdfDocument(
  pages: PdfPageText[],
  total: number,
  filename: string,
  sizeBytes: number,
  ocrUsed = false
): ParsedDocument {
  const text = stripHeadersAndFooters(pages);

  if (!text) {
    throw new EmptyDocumentError();
  }

  return {
    text,
    metadata: {
      filename,
      fileType: "pdf",
      sizeBytes,
      pages: total,
      ocrUsed,
    },
  };
}

/**
 * Full single-shot parse for a PDF already confirmed to have a selectable text layer.
 * Callers that need to detect scanned PDFs before deciding on OCR should call
 * `getPdfPageTexts` + `isScannedPdf` directly instead (see api/parse-document/route.ts).
 */
export async function parsePDF(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const { pages, total } = await getPdfPageTexts(buffer);
  return buildPdfDocument(pages, total, filename, buffer.length);
}
