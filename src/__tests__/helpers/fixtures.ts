/**
 * Test fixture generators.
 *
 * All helpers return raw Buffers that match what the parsers expect — no
 * external fixture files needed, everything is constructed in-memory.
 */

import JSZip from "jszip";

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * Constructs a minimal but spec-compliant single-page PDF with a selectable
 * text layer.  pdfjs-dist can open and extract text from it without issues.
 *
 * The xref byte offsets are computed dynamically so the file length doesn't
 * need to be hard-coded.
 */
export function makePdfWithText(text: string): Buffer {
  // Escape characters that are special inside a PDF string literal.
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  const streamContent = escaped ? `BT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET\n` : "";

  const o1 = "1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n";
  const o2 = "2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n";
  const o3 =
    "3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]" +
    " /Contents 5 0 R /Resources <</Font <</F1 4 0 R>>>>>>\nendobj\n";
  const o4 =
    "4 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n";
  const o5 =
    `5 0 obj\n<</Length ${Buffer.byteLength(streamContent, "latin1")}>>` +
    `\nstream\n${streamContent}endstream\nendobj\n`;

  const header = "%PDF-1.4\n";

  // Compute byte offsets for each object.
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, "latin1");
  for (const obj of [o1, o2, o3, o4, o5]) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(obj, "latin1");
  }

  const xrefStart = cursor;
  const pad10 = (n: number) => String(n).padStart(10, "0");

  // Each xref entry is exactly 20 bytes: "nnnnnnnnnn ggggg x \r\n" (or \n).
  const xrefEntries = [
    "0000000000 65535 f \r\n",
    ...offsets.map((o) => `${pad10(o)} 00000 n \r\n`),
  ].join("");

  const xref =
    `xref\n0 6\n${xrefEntries}` +
    `trailer\n<</Size 6 /Root 1 0 R>>\n` +
    `startxref\n${xrefStart}\n%%EOF`;

  const full = header + o1 + o2 + o3 + o4 + o5 + xref;
  return Buffer.from(full, "latin1");
}

/** A valid PDF whose single page has an empty content stream (no text). */
export function makeBlankPdf(): Buffer {
  return makePdfWithText("");
}

/**
 * A multi-page PDF where every page has an empty content stream.
 * Useful for verifying scanned-PDF detection (all pages are sparse).
 */
export function makeScannedPdf(pageCount = 3): Buffer {
  // Build a minimal N-page PDF where every page has an empty content stream.
  // Object layout:
  //   1 = catalog
  //   2 = pages (with N kids)
  //   3..3+N-1 = page objects
  //   3+N..3+2N-1 = content streams (empty)

  const n = Math.max(1, pageCount);
  const pageObjIds = Array.from({ length: n }, (_, i) => i + 3);
  const contentObjIds = Array.from({ length: n }, (_, i) => i + 3 + n);
  const totalObjs = 2 + n * 2;

  const kidRefs = pageObjIds.map((id) => `${id} 0 R`).join(" ");

  const objects: string[] = [];
  objects.push("1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n");
  objects.push(
    `2 0 obj\n<</Type /Pages /Kids [${kidRefs}] /Count ${n}>>\nendobj\n`
  );

  for (let i = 0; i < n; i++) {
    const pageId = pageObjIds[i];
    const contentId = contentObjIds[i];
    objects.push(
      `${pageId} 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]` +
        ` /Contents ${contentId} 0 R>>\nendobj\n`
    );
  }

  for (const contentId of contentObjIds) {
    objects.push(`${contentId} 0 obj\n<</Length 0>>\nstream\nendstream\nendobj\n`);
  }

  const header = "%PDF-1.4\n";
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, "latin1");

  for (const obj of objects) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(obj, "latin1");
  }

  const xrefStart = cursor;
  const pad10 = (n: number) => String(n).padStart(10, "0");
  const xrefEntries = [
    "0000000000 65535 f \r\n",
    ...offsets.map((o) => `${pad10(o)} 00000 n \r\n`),
  ].join("");

  const xref =
    `xref\n0 ${totalObjs + 1}\n${xrefEntries}` +
    `trailer\n<</Size ${totalObjs + 1} /Root 1 0 R>>\n` +
    `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(header + objects.join("") + xref, "latin1");
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

/**
 * Builds a minimal valid DOCX (Office Open XML) buffer from a plain-text
 * content string.  The resulting file is recognised by mammoth and yields
 * the content as plain text (one paragraph per line in the input).
 */
export async function makeDOCX(content: string): Promise<Buffer> {
  const paragraphs = content.split("\n").map((line) => {
    const escaped = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("\n    ")}
    <w:sectPr/>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

  const relsWord = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", relsRoot);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsWord);

  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// PPTX
// ---------------------------------------------------------------------------

/**
 * Builds a minimal valid PPTX buffer.
 * `slides` is an array of { title, bullets, notes? } objects.
 */
export async function makePPTX(
  slides: Array<{ title: string; bullets?: string[]; notes?: string }>
): Promise<Buffer> {
  function makeSlideXml(title: string, bullets: string[] = []): string {
    const titleParagraph = `<p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:t>${title}</a:t></a:r></a:p>
      </p:txBody>
    </p:sp>`;

    const bulletShapes = bullets.map(
      (b) => `<p:sp>
      <p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:t>${b}</a:t></a:r></a:p>
      </p:txBody>
    </p:sp>`
    );

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    ${titleParagraph}
    ${bulletShapes.join("\n    ")}
  </p:spTree></p:cSld>
</p:sld>`;
  }

  function makeNotesXml(noteText: string): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
         xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:t>${noteText}</a:t></a:r></a:p>
      </p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:notes>`;
  }

  const slideRelIds = slides.map((_, i) => `rId${i + 1}`);
  const slideRefs = slides
    .map(
      (_, i) =>
        `<Relationship Id="${slideRelIds[i]}"` +
        ` Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"` +
        ` Target="slides/slide${i + 1}.xml"/>`
    )
    .join("\n  ");

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    ${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="${slideRelIds[i]}"/>`).join("\n    ")}
  </p:sldIdLst>
</p:presentation>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml"
    ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slides
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml"` +
        ` ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join("\n  ")}
</Types>`;

  const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="ppt/presentation.xml"/>
</Relationships>`;

  const relsPpt = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slideRefs}
</Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", relsRoot);
  zip.file("ppt/presentation.xml", presentationXml);
  zip.file("ppt/_rels/presentation.xml.rels", relsPpt);

  for (let i = 0; i < slides.length; i++) {
    const { title, bullets = [], notes } = slides[i];
    zip.file(`ppt/slides/slide${i + 1}.xml`, makeSlideXml(title, bullets));

    if (notes) {
      zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`, makeNotesXml(notes));
    }
  }

  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
  return Buffer.from(arrayBuffer);
}
