import { EmptyDocumentError, type ParsedDocument } from "./types";

export function parseMarkdown(buffer: Buffer, filename: string): ParsedDocument {
  const text = buffer.toString("utf-8").trim();

  if (!text) {
    throw new EmptyDocumentError();
  }

  return {
    text,
    metadata: {
      filename,
      fileType: "md",
      sizeBytes: buffer.length,
    },
  };
}
