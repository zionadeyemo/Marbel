import { describe, it, expect } from "vitest";
import { parsePPTX } from "../../app/lib/parsers/parsePPTX";
import { CorruptedFileError, EmptyDocumentError } from "../../app/lib/parsers/types";
import { makePPTX } from "../helpers/fixtures";

describe("parsePPTX", () => {
  it("extracts slide titles and bullets", async () => {
    const buf = await makePPTX([
      { title: "Network Installation Overview", bullets: ["Check rack space", "Verify power"] },
      { title: "Cable Management", bullets: ["Label all cables", "Use cable ties"] },
    ]);
    const doc = await parsePPTX(buf, "overview.pptx");

    expect(doc.text).toContain("Network Installation Overview");
    expect(doc.text).toContain("Check rack space");
    expect(doc.text).toContain("Cable Management");
    expect(doc.text).toContain("Label all cables");
    expect(doc.metadata.fileType).toBe("pptx");
    expect(doc.metadata.pages).toBe(2);
  });

  it("numbers slides correctly", async () => {
    const buf = await makePPTX([
      { title: "Slide One" },
      { title: "Slide Two" },
      { title: "Slide Three" },
    ]);
    const doc = await parsePPTX(buf, "numbered.pptx");

    expect(doc.text).toContain("## Slide 1: Slide One");
    expect(doc.text).toContain("## Slide 2: Slide Two");
    expect(doc.text).toContain("## Slide 3: Slide Three");
  });

  it("includes speaker notes when present", async () => {
    const buf = await makePPTX([
      {
        title: "Safety Checks",
        bullets: ["Verify PPE", "Check lockout"],
        notes: "Remind team about arc flash protection",
      },
    ]);
    const doc = await parsePPTX(buf, "notes.pptx");

    expect(doc.text).toContain("Safety Checks");
    expect(doc.text).toContain("arc flash protection");
  });

  it("maintains slide order", async () => {
    const slides = Array.from({ length: 5 }, (_, i) => ({ title: `Step ${i + 1}` }));
    const buf = await makePPTX(slides);
    const doc = await parsePPTX(buf, "ordered.pptx");

    const positions = slides.map((s) => doc.text.indexOf(s.title));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("throws CorruptedFileError for a non-ZIP buffer", async () => {
    await expect(
      parsePPTX(Buffer.from("not a pptx", "utf-8"), "bad.pptx")
    ).rejects.toThrow(CorruptedFileError);
  });

  it("throws EmptyDocumentError when all slides are empty", async () => {
    // A PPTX with a slide that has no text content.
    // makePPTX with empty strings produces a slide with no usable text.
    const buf = await makePPTX([{ title: "" }]);
    await expect(parsePPTX(buf, "empty.pptx")).rejects.toThrow(EmptyDocumentError);
  });
});
