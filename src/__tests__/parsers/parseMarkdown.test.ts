import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../app/lib/parsers/parseMarkdown";
import { EmptyDocumentError } from "../../app/lib/parsers/types";

describe("parseMarkdown", () => {
  it("returns raw markdown text unchanged", () => {
    const content = "# Title\n\n## Section\n\nSome **bold** text.\n\n- Item 1\n- Item 2";
    const buf = Buffer.from(content, "utf-8");
    const doc = parseMarkdown(buf, "readme.md");

    expect(doc.text).toBe(content.trim());
    expect(doc.metadata.fileType).toBe("md");
    expect(doc.metadata.filename).toBe("readme.md");
  });

  it("preserves heading markers", () => {
    const content = "# H1\n## H2\n### H3";
    const doc = parseMarkdown(Buffer.from(content, "utf-8"), "headings.md");
    expect(doc.text).toContain("# H1");
    expect(doc.text).toContain("## H2");
    expect(doc.text).toContain("### H3");
  });

  it("preserves numbered lists", () => {
    const content = "1. First step\n2. Second step\n3. Third step";
    const doc = parseMarkdown(Buffer.from(content, "utf-8"), "steps.md");
    expect(doc.text).toContain("1. First step");
    expect(doc.text).toContain("3. Third step");
  });

  it("throws EmptyDocumentError for an empty file", () => {
    expect(() => parseMarkdown(Buffer.from("", "utf-8"), "empty.md")).toThrow(
      EmptyDocumentError
    );
  });
});
