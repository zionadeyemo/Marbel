import JSZip from "jszip";
import { CorruptedFileError, EmptyDocumentError, type ParsedDocument } from "./types";

const TEXT_RUN_PATTERN = /<a:t>([^<]*)<\/a:t>/g;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractSlideTextLines(slideXml: string): string[] {
  const lines: string[] = [];
  let match: RegExpExecArray | null;

  TEXT_RUN_PATTERN.lastIndex = 0;
  while ((match = TEXT_RUN_PATTERN.exec(slideXml)) !== null) {
    const text = decodeXmlEntities(match[1]).trim();
    if (text) lines.push(text);
  }

  return lines;
}

export async function parsePPTX(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new CorruptedFileError();
  }

  const slideFiles = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    throw new CorruptedFileError();
  }

  const slideTexts: string[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const lines = extractSlideTextLines(xml);

    if (lines.length === 0) continue;

    const [title, ...body] = lines;
    const slideNumber = i + 1;
    const heading = `## Slide ${slideNumber}: ${title}`;
    const bodyText = body.map((line) => `- ${line}`).join("\n");

    slideTexts.push(bodyText ? `${heading}\n${bodyText}` : heading);
  }

  const text = slideTexts.join("\n\n").trim();

  if (!text) {
    throw new EmptyDocumentError();
  }

  return {
    text,
    metadata: {
      filename,
      fileType: "pptx",
      sizeBytes: buffer.length,
      pages: slideFiles.length,
    },
  };
}
