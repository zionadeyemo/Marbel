import { describe, it, expect } from "vitest";
import { parseDOCX } from "../../app/lib/parsers/parseDOCX";
import { CorruptedFileError, EmptyDocumentError } from "../../app/lib/parsers/types";
import { makeDOCX } from "../helpers/fixtures";

describe("parseDOCX", () => {
  it("extracts text from a minimal DOCX", async () => {
    const buf = await makeDOCX("Installation procedure\nStep 1: Mount bracket\nStep 2: Connect cable");
    const doc = await parseDOCX(buf, "procedure.docx");

    expect(doc.text).toContain("Installation procedure");
    expect(doc.text).toContain("Step 1");
    expect(doc.text).toContain("Step 2");
    expect(doc.metadata.fileType).toBe("docx");
    expect(doc.metadata.filename).toBe("procedure.docx");
    expect(doc.metadata.sizeBytes).toBeGreaterThan(0);
  });

  it("preserves multi-paragraph content", async () => {
    const content = "First paragraph\nSecond paragraph\nThird paragraph";
    const buf = await makeDOCX(content);
    const doc = await parseDOCX(buf, "multi.docx");

    expect(doc.text).toContain("First paragraph");
    expect(doc.text).toContain("Third paragraph");
  });

  it("throws CorruptedFileError for a non-ZIP buffer", async () => {
    const buf = Buffer.from("this is not a docx file", "utf-8");
    await expect(parseDOCX(buf, "bad.docx")).rejects.toThrow(CorruptedFileError);
  });

  it("throws EmptyDocumentError for a DOCX with no text", async () => {
    // Create a DOCX with empty content
    const buf = await makeDOCX("");
    await expect(parseDOCX(buf, "empty.docx")).rejects.toThrow(EmptyDocumentError);
  });

  it("returns correct sizeBytes", async () => {
    const buf = await makeDOCX("Some content");
    const doc = await parseDOCX(buf, "test.docx");
    expect(doc.metadata.sizeBytes).toBe(buf.length);
  });
});
