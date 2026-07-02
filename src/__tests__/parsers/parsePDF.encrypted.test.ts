/**
 * Encrypted PDF detection test.
 *
 * Uses a module-level vi.mock so pdfjs-dist is replaced entirely in this
 * file, letting us simulate a PasswordException without spying on the frozen
 * ESM namespace (which is not allowed).
 */

import { describe, it, expect, vi } from "vitest";

// Must be declared before any import that transitively imports parsePDF.
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  // parsePDF.ts sets GlobalWorkerOptions.workerSrc at module init; the mock
  // must expose it with a writable workerSrc so the assignment doesn't throw.
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(() => ({
    promise: Promise.reject(
      Object.assign(new Error("Password required"), {
        name: "PasswordException",
        code: 1,
      })
    ),
    destroy: vi.fn(() => Promise.resolve()),
  })),
}));

// Import AFTER the mock declaration (vitest hoists vi.mock before imports).
import { getPdfPageTexts } from "../../app/lib/parsers/parsePDF";
import { EncryptedPdfError } from "../../app/lib/parsers/types";

describe("getPdfPageTexts — encrypted PDF", () => {
  it("throws EncryptedPdfError when pdfjs throws PasswordException", async () => {
    await expect(
      getPdfPageTexts(Buffer.from("fake pdf bytes"))
    ).rejects.toThrow(EncryptedPdfError);
  });

  it("EncryptedPdfError has the expected user-facing message", async () => {
    await expect(
      getPdfPageTexts(Buffer.from("fake pdf bytes"))
    ).rejects.toThrow("password-protected");
  });
});
