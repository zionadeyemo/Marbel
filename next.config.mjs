import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),

  // Native/binary modules must be loaded as real Node requires at runtime,
  // not bundled by webpack.
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],

  // pdfjs-dist's fake-worker (used in Node.js instead of a real Web Worker)
  // does:  await import(/*webpackIgnore:true*/ workerSrc)
  // The webpackIgnore comment also prevents @vercel/nft from tracing the
  // worker file as a static dependency, so it never makes it into the
  // Vercel deployment bundle.  This tells nft to include it explicitly.
  outputFileTracingIncludes: {
    "/api/parse-document": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
