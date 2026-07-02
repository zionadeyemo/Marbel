import { describe, it, expect } from "vitest";
import { parseTXT } from "../../app/lib/parsers/parseTXT";
import { EmptyDocumentError } from "../../app/lib/parsers/types";

describe("parseTXT", () => {
  it("extracts text from a plain-text buffer", () => {
    const buf = Buffer.from("Step 1: Tighten the bolt.\nStep 2: Torque to spec.", "utf-8");
    const doc = parseTXT(buf, "procedure.txt");

    expect(doc.text).toContain("Step 1");
    expect(doc.text).toContain("Step 2");
    expect(doc.metadata.fileType).toBe("txt");
    expect(doc.metadata.filename).toBe("procedure.txt");
    expect(doc.metadata.sizeBytes).toBe(buf.length);
  });

  it("strips leading and trailing whitespace", () => {
    const buf = Buffer.from("\n\n  hello world  \n\n", "utf-8");
    const doc = parseTXT(buf, "test.txt");
    expect(doc.text).toBe("hello world");
  });

  it("throws EmptyDocumentError for an empty file", () => {
    expect(() => parseTXT(Buffer.from("", "utf-8"), "empty.txt")).toThrow(
      EmptyDocumentError
    );
  });

  it("throws EmptyDocumentError for a whitespace-only file", () => {
    expect(() => parseTXT(Buffer.from("   \n\t  ", "utf-8"), "blank.txt")).toThrow(
      EmptyDocumentError
    );
  });

  it("preserves multi-line content", () => {
    const content = "# Heading\n\nLine one.\nLine two.\n- Bullet";
    const doc = parseTXT(Buffer.from(content, "utf-8"), "multi.txt");
    expect(doc.text).toContain("# Heading");
    expect(doc.text).toContain("Line one.");
    expect(doc.text).toContain("- Bullet");
  });
});
