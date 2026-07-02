import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, DOMMatrix, Path2D } from "@napi-rs/canvas";
import { recognize } from "tesseract.js";
import {
  EncryptedPdfError,
  OcrFailedError,
  EmptyDocumentError,
  SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE,
  type ParsedDocument,
} from "./types";
import { stripHeadersAndFooters, buildPageText, type PdfPageText } from "./parsePDF";

// pdfjs canvas renderer expects DOMMatrix and Path2D as browser globals.
// @napi-rs/canvas ships Node-compatible implementations but doesn't auto-install them.
if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
  (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix;
}
if (typeof (globalThis as Record<string, unknown>).Path2D === "undefined") {
  (globalThis as Record<string, unknown>).Path2D = Path2D;
}

const RENDER_SCALE = 2; // 2× scale → sharper images → better OCR accuracy

function isPasswordException(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: unknown }).name === "PasswordException"
  );
}

/**
 * Renders one PDF page to a PNG buffer using @napi-rs/canvas, then runs
 * Tesseract on the result.  Returns the recognized text.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ocrPage(page: any): Promise<string> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  const pngBuffer = canvas.toBuffer("image/png");
  const { data } = await recognize(pngBuffer, "eng");
  return data.text ?? "";
}

/**
 * Hybrid OCR pass over a PDF buffer.
 *
 * For each page:
 *  - If the text layer already has meaningful content (≥ threshold chars), keep it.
 *  - Otherwise render the page to an image and run Tesseract OCR.
 *
 * This handles fully-scanned PDFs (all pages get OCR'd) and mixed PDFs
 * (text pages are kept as-is; only blank/image pages are OCR'd).
 *
 * Throws:
 *  - EncryptedPdfError — if the PDF requires a password
 *  - OcrFailedError    — if OCR processing fails
 *  - EmptyDocumentError — if the final assembled text is empty
 */
export async function ocrPdf(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const t0 = Date.now();
  console.log("[parser:ocr] starting hybrid OCR", { filename, sizeBytes: buffer.length });

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  let doc: Awaited<typeof loadingTask.promise>;

  try {
    doc = await loadingTask.promise;
  } catch (err) {
    if (isPasswordException(err)) throw new EncryptedPdfError();
    throw new OcrFailedError();
  }

  const total = doc.numPages;
  const pages: PdfPageText[] = [];
  let ocrPageCount = 0;

  try {
    for (let pageNum = 1; pageNum <= total; pageNum++) {
      const page = await doc.getPage(pageNum);

      // 1. Try the text layer first — it is instant and preserves formatting.
      const textContent = await page.getTextContent();
      const textLayerText = buildPageText(textContent.items).trim();

      if (textLayerText.length >= SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE) {
        // Page has a usable text layer — no OCR needed.
        pages.push({ num: pageNum, text: textLayerText });
        page.cleanup();
        continue;
      }

      // 2. Text layer is sparse → render + OCR this page.
      ocrPageCount++;
      try {
        const ocrText = await ocrPage(page);
        pages.push({ num: pageNum, text: ocrText });
      } catch {
        // If a single page's OCR fails, record an empty page rather than
        // aborting the entire document.
        pages.push({ num: pageNum, text: "" });
        console.warn("[parser:ocr] page OCR failed, skipping", { filename, pageNum });
      }

      page.cleanup();
    }
  } catch (err) {
    // Re-throw known typed errors unchanged; wrap everything else.
    if (err instanceof EncryptedPdfError) throw err;
    throw new OcrFailedError();
  } finally {
    await loadingTask.destroy();
  }

  console.log("[parser:ocr] extraction complete", {
    filename,
    totalPages: total,
    ocrPages: ocrPageCount,
    textLayerPages: total - ocrPageCount,
    durationMs: Date.now() - t0,
  });

  const text = stripHeadersAndFooters(pages);

  if (!text.trim()) {
    throw new EmptyDocumentError();
  }

  console.log("[parser:ocr] done", {
    filename,
    chars: text.length,
    ocrUsed: ocrPageCount > 0,
    durationMs: Date.now() - t0,
    result: "success",
  });

  return {
    text,
    metadata: {
      filename,
      fileType: "pdf",
      sizeBytes: buffer.length,
      pages: total,
      ocrUsed: ocrPageCount > 0,
    },
  };
}
