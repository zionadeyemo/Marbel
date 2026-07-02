import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 120_000, // OCR can be slow
    hookTimeout: 30_000,
    server: {
      deps: {
        // Native-binary / pure-ESM packages must be loaded via Node require, not
        // bundled by Vite. Matches the same list in next.config.mjs.
        external: ["pdfjs-dist", "@napi-rs/canvas", "tesseract.js"],
      },
    },
  },
});
