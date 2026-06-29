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

export class UnsupportedFileTypeError extends Error {
  constructor() {
    super("This file type isn't supported yet.");
  }
}

export class EmptyDocumentError extends Error {
  constructor() {
    super("No readable text was found.");
  }
}

export class CorruptedFileError extends Error {
  constructor() {
    super("Unable to read this document.");
  }
}

export class OcrFailedError extends Error {
  constructor() {
    super("We couldn't extract readable text from this scanned document.");
  }
}

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

/**
 * Below this average characters-per-page, a PDF is treated as scanned
 * (no meaningful selectable text layer) and routed to OCR.
 */
export const SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE = 20;
