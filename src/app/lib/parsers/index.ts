import { parseTXT } from "./parseTXT";
import { parseMarkdown } from "./parseMarkdown";
import { parseDOCX } from "./parseDOCX";
import { parsePPTX } from "./parsePPTX";
import { parsePDF } from "./parsePDF";
import { detectFileType, type ParsedDocument, type SupportedFileType } from "./types";

export * from "./types";
export { getPdfPageTexts, isScannedPdf, buildPdfDocument, stripHeadersAndFooters } from "./parsePDF";
export { ocrPdf } from "./ocr";

/**
 * Single dispatch point for all supported file types.
 *
 * PDFs are also handled here, but the upload route calls the lower-level
 * `getPdfPageTexts` + `isScannedPdf` directly so it can implement the
 * two-phase scanned-document detection flow.  This function exists for
 * contexts that don't need that two-phase split.
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
