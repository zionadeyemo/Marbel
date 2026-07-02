import { EmptyDocumentError, type ParsedDocument } from "./types";

export function parseMarkdown(buffer: Buffer, filename: string): ParsedDocument {
  const t0 = Date.now();
  const text = buffer.toString("utf-8").trim();

  if (!text) {
    throw new EmptyDocumentError();
  }

  console.log("[parser:md] done", {
    filename,
    chars: text.length,
    durationMs: Date.now() - t0,
    result: "success",
  });

  return {
    text,
    metadata: { filename, fileType: "md", sizeBytes: buffer.length },
  };
}
