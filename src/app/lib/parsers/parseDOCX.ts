import mammoth from "mammoth";
import { CorruptedFileError, EmptyDocumentError, type ParsedDocument } from "./types";

// mammoth 1.12's bundled declarations predate `convertToMarkdown`; it does
// exist at runtime.  Cast narrowly so we can call it without "any".
type MammothWithMarkdown = {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function parseDOCX(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const t0 = Date.now();
  console.log("[parser:docx] starting", { filename, sizeBytes: buffer.length });

  let markdown: string;

  try {
    const result = await (mammoth as unknown as MammothWithMarkdown).convertToMarkdown({ buffer });
    markdown = result.value.trim();
  } catch {
    throw new CorruptedFileError();
  }

  if (!markdown) {
    throw new EmptyDocumentError();
  }

  console.log("[parser:docx] done", {
    filename,
    chars: markdown.length,
    durationMs: Date.now() - t0,
    result: "success",
  });

  return {
    text: markdown,
    metadata: {
      filename,
      fileType: "docx",
      sizeBytes: buffer.length,
    },
  };
}
