import mammoth from "mammoth";
import { CorruptedFileError, EmptyDocumentError, type ParsedDocument } from "./types";

// mammoth's bundled type declarations predate `convertToMarkdown`, which does
// exist at runtime in the installed version — cast narrowly to call it.
type MammothWithMarkdown = {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function parseDOCX(buffer: Buffer, filename: string): Promise<ParsedDocument> {
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

  return {
    text: markdown,
    metadata: {
      filename,
      fileType: "docx",
      sizeBytes: buffer.length,
    },
  };
}
