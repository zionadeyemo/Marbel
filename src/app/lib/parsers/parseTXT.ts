import { EmptyDocumentError, type ParsedDocument } from "./types";

export function parseTXT(buffer: Buffer, filename: string): ParsedDocument {
  const t0 = Date.now();
  const text = buffer.toString("utf-8").trim();

  if (!text) {
    throw new EmptyDocumentError();
  }

  console.log("[parser:txt] done", {
    filename,
    chars: text.length,
    durationMs: Date.now() - t0,
    result: "success",
  });

  return {
    text,
    metadata: { filename, fileType: "txt", sizeBytes: buffer.length },
  };
}
