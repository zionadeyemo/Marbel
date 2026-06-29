import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  // Native/binary modules used by the document-ingestion pipeline must be
  // loaded as real Node `require`s at runtime, not bundled by webpack.
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],
};

export default nextConfig;
