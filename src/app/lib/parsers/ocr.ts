import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, DOMMatrix, Path2D } from "@napi-rs/canvas";
import { recognize } from "tesseract.js";
import { EmptyDocumentError, OcrFailedError, type ParsedDocument } from "./types";
import { stripHeadersAndFooters, type PdfPageText } from "./parsePDF";

// pdfjs's canvas renderer expects these as DOM globals; @napi-rs/canvas ships
// Node-compatible implementations but doesn't install them globally itself.
if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
  (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix;
}
if (typeof (globalThis as Record<string, unknown>).Path2D === "undefined") {
  (globalThis as Record<string, unknown>).Path2D = Path2D;
}

const RENDER_SCALE = 2;

/**
 * Renders each PDF page to a PNG via pdfjs-dist + @napi-rs/canvas, then runs
 * Tesseract OCR on each page sequentially, preserving page order.
 */
export async function ocrPdf(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  let doc;

  try {
    doc = await loadingTask.promise;
  } catch {
    throw new OcrFailedError();
  }

  const total = doc.numPages;
  const ocrPages: PdfPageText[] = [];

  try {
    for (let pageNum = 1; pageNum <= total; pageNum++) {
      const page = await doc.getPage(pageNum);
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

      ocrPages.push({ num: pageNum, text: data.text ?? "" });
      page.cleanup();
    }
  } catch {
    throw new OcrFailedError();
  } finally {
    await loadingTask.destroy();
  }

  const text = stripHeadersAndFooters(ocrPages);

  if (!text) {
    throw new EmptyDocumentError();
  }

  return {
    text,
    metadata: {
      filename,
      fileType: "pdf",
      sizeBytes: buffer.length,
      pages: total,
      ocrUsed: true,
    },
  };
}
