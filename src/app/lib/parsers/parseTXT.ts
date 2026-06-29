import { EmptyDocumentError, type ParsedDocument } from "./types";

export function parseTXT(buffer: Buffer, filename: string): ParsedDocument {
  const text = buffer.toString("utf-8").trim();

  if (!text) {
    throw new EmptyDocumentError();
  }

  return {
    text,
    metadata: {
      filename,
      fileType: "txt",
      sizeBytes: buffer.length,
    },
  };
}
