export type SupportedFileType = "pdf" | "docx" | "pptx" | "txt" | "md";

export type ParsedDocumentMetadata = {
  filename: string;
  fileType: SupportedFileType;
  sizeBytes: number;
  pages?: number;
  ocrUsed?: boolean;
};

export type ParsedDocument = {
  text: string;
  metadata: ParsedDocumentMetadata;
};

// ---------------------------------------------------------------------------
// Error classes — thrown by parsers and caught at the route level.
// "Known" errors are user-actionable and carry a public-facing message.
// "Unknown" errors bubble up as unexpected 500s with an errorId.
// ---------------------------------------------------------------------------

export class UnsupportedFileTypeError extends Error {
  constructor() {
    super("This file type isn't supported yet. Upload a PDF, DOCX, PPTX, TXT, or Markdown file.");
  }
}

export class EmptyDocumentError extends Error {
  constructor() {
    super("No readable text was found in this document.");
  }
}

export class CorruptedFileError extends Error {
  constructor(detail?: string) {
    super(detail ?? "Unable to read this document. It may be corrupt or in an unsupported format.");
  }
}

export class EncryptedPdfError extends Error {
  constructor() {
    super("This PDF is password-protected. Remove the password and try again.");
  }
}

export class OcrFailedError extends Error {
  constructor() {
    super("We couldn't extract readable text from this scanned document.");
  }
}

// ---------------------------------------------------------------------------
// File-type detection
// ---------------------------------------------------------------------------

const EXTENSION_TO_TYPE: Record<string, SupportedFileType> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  txt: "txt",
  md: "md",
  markdown: "md",
};

export function detectFileType(filename: string): SupportedFileType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const fileType = EXTENSION_TO_TYPE[ext];

  if (!fileType) {
    throw new UnsupportedFileTypeError();
  }

  return fileType;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * Average characters per page below this value signals a scanned (image-only)
 * PDF that needs OCR.  Twenty chars is enough for a lone page number or a
 * single short label — anything less is almost certainly a blank/scanned page.
 */
export const SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE = 20;

/**
 * Fraction of pages that must be sparse before we decide the whole document
 * should go through OCR rather than text-layer extraction.
 *
 * 0.35 = if ≥35% of pages have fewer than SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE
 *        characters, treat the document as a scanned PDF.
 */
export const SCANNED_PDF_PAGE_FRACTION = 0.35;
