import { parseTXT } from "./parseTXT";
import { parseMarkdown } from "./parseMarkdown";
import { parseDOCX } from "./parseDOCX";
import { parsePPTX } from "./parsePPTX";
import { parsePDF } from "./parsePDF";
import { detectFileType, type ParsedDocument, type SupportedFileType } from "./types";

export * from "./types";
export { getPdfPageTexts, isScannedPdf, buildPdfDocument } from "./parsePDF";
export { ocrPdf } from "./ocr";

/**
 * Single dispatch point for non-PDF formats. PDFs are handled separately by the
 * upload route because they require a scanned-document detection step before
 * deciding between direct text extraction and OCR.
 */
export async function parseDocument(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const fileType: SupportedFileType = detectFileType(filename);

  switch (fileType) {
    case "txt":
      return parseTXT(buffer, filename);
    case "md":
      return parseMarkdown(buffer, filename);
    case "docx":
      return parseDOCX(buffer, filename);
    case "pptx":
      return parsePPTX(buffer, filename);
    case "pdf":
      return parsePDF(buffer, filename);
  }
}
