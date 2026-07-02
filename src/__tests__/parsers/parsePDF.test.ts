import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getPdfPageTexts,
  isScannedPdf,
  buildPdfDocument,
  parsePDF,
  stripHeadersAndFooters,
  type PdfPageText,
} from "../../app/lib/parsers/parsePDF";
import {
  CorruptedFileError,
  EmptyDocumentError,
  EncryptedPdfError,
  SCANNED_PDF_CHAR_THRESHOLD_PER_PAGE,
} from "../../app/lib/parsers/types";
import { makePdfWithText, makeBlankPdf, makeScannedPdf } from "../helpers/fixtures";

// ---------------------------------------------------------------------------
// isScannedPdf
// ---------------------------------------------------------------------------

describe("isScannedPdf", () => {
  it("returns false for pages with substantial text", () => {
    const pages = [
      { text: "A".repeat(200) },
      { text: "B".repeat(300) },
    ];
    expect(isScannedPdf(pages)).toBe(false);
  });

  it("returns true when all pages are nearly empty", () => {
    const pages = Array.from({ length: 5 }, () => ({ text: "" }));
    expect(isScannedPdf(pages)).toBe(true);
  });

  it("returns true when ≥35% of pages are sparse AND overall average is low", () => {
    // 4 empty pages + 1 page with 10 chars = 2 chars average, 80% sparse
    const pages = [
      ...Array.from({ length: 4 }, () => ({ text: "" })),
      { text: "A".repeat(10) },
    ];
    expect(isScannedPdf(pages)).toBe(true);
  });

  it("returns false when sparse pages are a small minority", () => {
    // 1 empty page + 9 text-heavy pages → 10% sparse, overall avg is high
    const pages = [
      { text: "" },
      ...Array.from({ length: 9 }, () => ({ text: "A".repeat(500) })),
    ];
    expect(isScannedPdf(pages)).toBe(false);
  });

  it("returns false for an empty pages array", () => {
    expect(isScannedPdf([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stripHeadersAndFooters
// ---------------------------------------------------------------------------

describe("stripHeadersAndFooters", () => {
  it("removes lines that appear on ≥50% of pages at their edges", () => {
    const pages: PdfPageText[] = [
      { num: 1, text: "Acme Corp\nContent A\nPage 1" },
      { num: 2, text: "Acme Corp\nContent B\nPage 2" },
      { num: 3, text: "Acme Corp\nContent C\nPage 3" },
    ];
    const result = stripHeadersAndFooters(pages);
    expect(result).not.toContain("Acme Corp");
    expect(result).toContain("Content A");
    expect(result).toContain("Content B");
    expect(result).toContain("Content C");
  });

  it("removes standalone page-number lines", () => {
    const pages: PdfPageText[] = [
      { num: 1, text: "Real content here\n1" },
      { num: 2, text: "More content\n2" },
    ];
    const result = stripHeadersAndFooters(pages);
    expect(result).not.toMatch(/^\d+$/m);
    expect(result).toContain("Real content here");
  });

  it("removes page N of M lines", () => {
    const pages: PdfPageText[] = [
      { num: 1, text: "Content\nPage 1 of 3" },
      { num: 2, text: "More\nPage 2 of 3" },
    ];
    const result = stripHeadersAndFooters(pages);
    expect(result).not.toContain("Page 1 of 3");
  });

  it("preserves unique body content", () => {
    const pages: PdfPageText[] = [
      { num: 1, text: "Header\nUnique section A\nFooter" },
      { num: 2, text: "Header\nUnique section B\nFooter" },
    ];
    const result = stripHeadersAndFooters(pages);
    expect(result).toContain("Unique section A");
    expect(result).toContain("Unique section B");
  });
});

// ---------------------------------------------------------------------------
// getPdfPageTexts — real PDF parsing
// ---------------------------------------------------------------------------

describe("getPdfPageTexts", () => {
  it("extracts text from a minimal searchable PDF", async () => {
    const buf = makePdfWithText("Hello World this is a test document");
    const { pages, total } = await getPdfPageTexts(buf);

    expect(total).toBe(1);
    expect(pages).toHaveLength(1);
    expect(pages[0].num).toBe(1);
    // pdfjs should extract the text we embedded
    expect(pages[0].text.trim().length).toBeGreaterThan(0);
  });

  it("returns empty text for a blank page PDF", async () => {
    const buf = makeBlankPdf();
    const { pages, total } = await getPdfPageTexts(buf);

    expect(total).toBe(1);
    expect(pages[0].text.trim()).toBe("");
  });

  it("returns one entry per page for a multi-page PDF", async () => {
    const buf = makeScannedPdf(5);
    const { pages, total } = await getPdfPageTexts(buf);

    expect(total).toBe(5);
    expect(pages).toHaveLength(5);
    expect(pages.map((p) => p.num)).toEqual([1, 2, 3, 4, 5]);
  });

  it("throws CorruptedFileError for a non-PDF buffer", async () => {
    await expect(
      getPdfPageTexts(Buffer.from("not a pdf", "utf-8"))
    ).rejects.toThrow(CorruptedFileError);
  });

  // Encrypted PDF detection is tested in parsePDF.encrypted.test.ts because
  // it requires a module-level vi.mock that cannot coexist with real pdfjs calls.
});

// ---------------------------------------------------------------------------
// buildPdfDocument
// ---------------------------------------------------------------------------

describe("buildPdfDocument", () => {
  it("assembles a ParsedDocument from pages", () => {
    const pages: PdfPageText[] = [
      { num: 1, text: "Section 1\nStep 1: Do this\nStep 2: Do that" },
      { num: 2, text: "Section 2\nMore instructions here" },
    ];
    const doc = buildPdfDocument(pages, 2, "manual.pdf", 12345);

    expect(doc.text).toContain("Step 1: Do this");
    expect(doc.text).toContain("More instructions here");
    expect(doc.metadata.fileType).toBe("pdf");
    expect(doc.metadata.pages).toBe(2);
    expect(doc.metadata.ocrUsed).toBe(false);
  });

  it("sets ocrUsed when instructed", () => {
    const pages: PdfPageText[] = [{ num: 1, text: "Some OCR'd text here" }];
    const doc = buildPdfDocument(pages, 1, "scan.pdf", 5000, true);
    expect(doc.metadata.ocrUsed).toBe(true);
  });

  it("throws EmptyDocumentError when all pages have no text", () => {
    const pages: PdfPageText[] = [
      { num: 1, text: "" },
      { num: 2, text: "   " },
    ];
    expect(() => buildPdfDocument(pages, 2, "blank.pdf", 1000)).toThrow(
      EmptyDocumentError
    );
  });
});

// ---------------------------------------------------------------------------
// parsePDF — full end-to-end text extraction
// ---------------------------------------------------------------------------

describe("parsePDF", () => {
  it("extracts text from a searchable PDF", async () => {
    const content = "Installation Manual Step 1 Mount the bracket Step 2 Connect power";
    const buf = makePdfWithText(content);
    const doc = await parsePDF(buf, "manual.pdf");

    expect(doc.text.length).toBeGreaterThan(0);
    expect(doc.metadata.fileType).toBe("pdf");
    expect(doc.metadata.ocrUsed).toBe(false);
  });

  it("throws EmptyDocumentError for a blank PDF", async () => {
    const buf = makeBlankPdf();
    await expect(parsePDF(buf, "blank.pdf")).rejects.toThrow(EmptyDocumentError);
  });

  it("throws CorruptedFileError for garbage input", async () => {
    await expect(
      parsePDF(Buffer.from("garbage", "utf-8"), "bad.pdf")
    ).rejects.toThrow(CorruptedFileError);
  });
});

// ---------------------------------------------------------------------------
// scanned PDF detection — integration
// ---------------------------------------------------------------------------

describe("scanned PDF detection (integration)", () => {
  it("isScannedPdf returns true for a blank multi-page PDF", async () => {
    const buf = makeScannedPdf(3);
    const { pages } = await getPdfPageTexts(buf);
    expect(isScannedPdf(pages)).toBe(true);
  });

  it("isScannedPdf returns false for a text-bearing PDF", async () => {
    const content = "This is a large amount of text in this document ".repeat(10);
    const buf = makePdfWithText(content);
    const { pages } = await getPdfPageTexts(buf);
    expect(isScannedPdf(pages)).toBe(false);
  });
});
