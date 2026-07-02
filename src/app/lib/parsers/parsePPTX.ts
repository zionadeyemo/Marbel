import JSZip from "jszip";
import { CorruptedFileError, EmptyDocumentError, type ParsedDocument } from "./types";

// Matches any text run inside a DrawingML `<a:t>` element.
const TEXT_RUN_RE = /<a:t>([^<]*)<\/a:t>/g;

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extracts all text runs from a slide or notes-slide XML string.
 * Returns one string per `<a:p>` paragraph that contains at least one run,
 * with runs within a paragraph joined without extra spaces.
 */
function extractTextFromXml(xml: string): string[] {
  const paragraphs: string[] = [];

  // Split by paragraph boundaries first so we can group runs correctly.
  const paragraphBlocks = xml.split(/<a:p[ >]/);

  for (const block of paragraphBlocks.slice(1)) {
    // Collect all text runs within this paragraph block.
    const re = new RegExp(TEXT_RUN_RE.source, "g");
    let match: RegExpExecArray | null;
    const runs: string[] = [];

    while ((match = re.exec(block)) !== null) {
      const text = decodeXml(match[1]).trim();
      if (text) runs.push(text);
    }

    if (runs.length > 0) {
      paragraphs.push(runs.join(" "));
    }
  }

  return paragraphs;
}

/**
 * Returns the numeric index embedded in a slide filename.
 * e.g. "ppt/slides/slide3.xml" → 3
 */
function slideIndex(path: string): number {
  return parseInt(path.match(/(\d+)\.xml$/)?.[1] ?? "0", 10);
}

export async function parsePPTX(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const t0 = Date.now();
  console.log("[parser:pptx] starting", { filename, sizeBytes: buffer.length });

  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new CorruptedFileError();
  }

  // Collect slide files, sorted in presentation order.
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideIndex(a) - slideIndex(b));

  if (slideFiles.length === 0) {
    throw new CorruptedFileError();
  }

  // Collect notes files keyed by slide index for O(1) lookup.
  const notesMap = new Map<number, string>();
  for (const path of Object.keys(zip.files)) {
    if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(path)) {
      const idx = slideIndex(path);
      notesMap.set(idx, path);
    }
  }

  const slideTexts: string[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const slideNumber = i + 1;
    const xml = await zip.files[slideFiles[i]].async("string");
    const paragraphs = extractTextFromXml(xml);

    if (paragraphs.length === 0) continue;

    const [title, ...body] = paragraphs;
    const parts: string[] = [`## Slide ${slideNumber}: ${title}`];

    if (body.length > 0) {
      parts.push(body.map((line) => `- ${line}`).join("\n"));
    }

    // Append speaker notes if available for this slide.
    const notesPath = notesMap.get(slideNumber);
    if (notesPath) {
      const notesXml = await zip.files[notesPath].async("string");
      const noteLines = extractTextFromXml(notesXml);

      // Speaker notes often contain the slide number as the first item —
      // skip single-token lines that are just digits to avoid noise.
      const meaningful = noteLines.filter((l) => !/^\d+$/.test(l.trim()));

      if (meaningful.length > 0) {
        parts.push(`_Notes: ${meaningful.join(" ")}_`);
      }
    }

    slideTexts.push(parts.join("\n"));
  }

  const text = slideTexts.join("\n\n").trim();

  if (!text) {
    throw new EmptyDocumentError();
  }

  console.log("[parser:pptx] done", {
    filename,
    slides: slideFiles.length,
    chars: text.length,
    hasNotes: notesMap.size > 0,
    durationMs: Date.now() - t0,
    result: "success",
  });

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
