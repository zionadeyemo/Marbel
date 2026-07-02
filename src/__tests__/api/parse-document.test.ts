/**
 * Integration tests for POST /api/parse-document.
 *
 * These tests call the Next.js route handler directly (no HTTP server needed).
 * Node 18+ provides the necessary globals: Request, FormData, File, Blob.
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/parse-document/route";
import {
  makePdfWithText,
  makeBlankPdf,
  makeScannedPdf,
  makeDOCX,
  makePPTX,
} from "../helpers/fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  phase?: string
): Promise<Response> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), filename);
  if (phase) formData.append("phase", phase);

  const req = new NextRequest("http://localhost/api/parse-document", {
    method: "POST",
    body: formData,
  });

  return POST(req);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("parse-document route — validation", () => {
  it("returns 400 when no file is uploaded", async () => {
    const formData = new FormData();
    const req = new NextRequest("http://localhost/api/parse-document", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 422 for an unsupported file type", async () => {
    const res = await uploadBuffer(Buffer.from("data"), "archive.zip");
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/supported/i);
  });

  it("returns 413 when the file exceeds 25 MB", async () => {
    // 26 MB buffer of zeros
    const big = Buffer.alloc(26 * 1024 * 1024, 0);
    const res = await uploadBuffer(big, "huge.pdf");
    expect(res.status).toBe(413);
  });
});

// ---------------------------------------------------------------------------
// TXT
// ---------------------------------------------------------------------------

describe("parse-document route — TXT", () => {
  it("parses a TXT file and returns status:done", async () => {
    const buf = Buffer.from(
      "Install the bracket using M6 bolts.\nTorque to 25 Nm.",
      "utf-8"
    );
    const res = await uploadBuffer(buf, "procedure.txt");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.document.text).toContain("Install the bracket");
    expect(body.document.metadata.fileType).toBe("txt");
  });

  it("returns 422 for an empty TXT file", async () => {
    const res = await uploadBuffer(Buffer.from("", "utf-8"), "empty.txt");
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

describe("parse-document route — Markdown", () => {
  it("parses a Markdown file and returns status:done", async () => {
    const content = "# SOP\n\n## Phase 1\n\n1. First action\n2. Second action";
    const res = await uploadBuffer(Buffer.from(content, "utf-8"), "sop.md");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.document.text).toContain("# SOP");
    expect(body.document.metadata.fileType).toBe("md");
  });
});

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

describe("parse-document route — DOCX", () => {
  it("parses a DOCX file and returns status:done", async () => {
    const buf = await makeDOCX("Commissioning Procedure\nStep 1: Power on\nStep 2: Verify LEDs");
    const res = await uploadBuffer(buf, "commissioning.docx");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.document.text).toContain("Commissioning Procedure");
    expect(body.document.metadata.fileType).toBe("docx");
  });

  it("returns 422 for a corrupt DOCX buffer", async () => {
    const res = await uploadBuffer(Buffer.from("not a zip", "utf-8"), "bad.docx");
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// PPTX
// ---------------------------------------------------------------------------

describe("parse-document route — PPTX", () => {
  it("parses a PPTX file and returns status:done", async () => {
    const buf = await makePPTX([
      { title: "Overview", bullets: ["Safety first", "Two-person lift required"] },
      { title: "Installation Steps", bullets: ["Mount rack", "Run cables"] },
    ]);
    const res = await uploadBuffer(buf, "training.pptx");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.document.text).toContain("Overview");
    expect(body.document.text).toContain("Installation Steps");
    expect(body.document.metadata.fileType).toBe("pptx");
    expect(body.document.metadata.pages).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// PDF — searchable
// ---------------------------------------------------------------------------

describe("parse-document route — PDF (searchable)", () => {
  it("extracts text and returns status:done for a searchable PDF", async () => {
    const buf = makePdfWithText(
      "Rack installation procedure. Mount unit in rack. Connect power supply."
    );
    const res = await uploadBuffer(buf, "rack.pdf");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.document.text.length).toBeGreaterThan(0);
    expect(body.document.metadata.fileType).toBe("pdf");
    expect(body.document.metadata.ocrUsed).toBe(false);
  });

  it("returns 422 for a corrupt PDF buffer", async () => {
    const res = await uploadBuffer(Buffer.from("not a pdf at all", "utf-8"), "bad.pdf");
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// PDF — scanned (blank pages → needs_ocr)
// ---------------------------------------------------------------------------

describe("parse-document route — PDF (scanned, phase 1)", () => {
  it("returns status:needs_ocr for a blank-page PDF on the first upload", async () => {
    const buf = makeScannedPdf(3);
    const res = await uploadBuffer(buf, "scan.pdf");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("needs_ocr");
    expect(body.metadata.filename).toBe("scan.pdf");
    expect(body.metadata.pages).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// PDF — blank → EmptyDocumentError path
// ---------------------------------------------------------------------------

describe("parse-document route — PDF (blank page)", () => {
  it("returns 422 EmptyDocumentError if PDF has no text and OCR phase also yields nothing", async () => {
    // A blank PDF (single empty page) is sparse → would trigger needs_ocr in phase detect.
    // If we force it straight to OCR phase, OCR of a blank page produces no text → EmptyDocument.
    // This test verifies the blank-page → phase=ocr → EmptyDocumentError path.
    const buf = makeBlankPdf();
    const res = await uploadBuffer(buf, "blank.pdf", "ocr");
    // OCR of a completely blank page yields no text → EmptyDocumentError (422)
    // OR it might succeed with empty → EmptyDocumentError from buildPdfDocument.
    // Either outcome is a 422.
    expect(res.status).toBe(422);
  });
});
