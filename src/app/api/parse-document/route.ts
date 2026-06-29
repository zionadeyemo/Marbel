import { NextRequest, NextResponse } from "next/server";
import {
  CorruptedFileError,
  EmptyDocumentError,
  OcrFailedError,
  UnsupportedFileTypeError,
  detectFileType,
  parseDocument,
  getPdfPageTexts,
  isScannedPdf,
  buildPdfDocument,
  ocrPdf,
} from "../../lib/parsers";
import { handleKnownError, handleUnexpectedError, type ErrorContext } from "../../lib/server-error";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const REQUEST_PATH = "/api/parse-document";

const KNOWN_ERROR_TYPES = [
  UnsupportedFileTypeError,
  EmptyDocumentError,
  CorruptedFileError,
  OcrFailedError,
];

function getExtension(filename: string): string {
  return filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "(none)";
}

export async function POST(request: NextRequest) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const file = formData.get("file");
  const phase = formData.get("phase")?.toString() ?? "detect";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 25 MB." },
      { status: 413 }
    );
  }

  const filename = file.name;
  const buffer = Buffer.from(await file.arrayBuffer());

  const context: ErrorContext = {
    requestPath: REQUEST_PATH,
    filename,
    mimeType: file.type || "(empty)",
    extension: getExtension(filename),
    fileSizeBytes: buffer.length,
    phase,
    parserSelected: "(not yet determined)",
  };

  try {
    const fileType = detectFileType(filename);

    if (fileType !== "pdf") {
      context.parserSelected = `parseDocument → parse${fileType.toUpperCase()}`;
      const document = await parseDocument(buffer, filename);
      return NextResponse.json({ status: "done", document });
    }

    if (phase === "ocr") {
      context.parserSelected = "ocrPdf (pdfjs-dist render + tesseract.js)";
      const document = await ocrPdf(buffer, filename);
      return NextResponse.json({ status: "done", document });
    }

    context.parserSelected = "getPdfPageTexts (pdfjs-dist text layer)";
    const { pages, total } = await getPdfPageTexts(buffer);

    if (isScannedPdf(pages)) {
      return NextResponse.json({
        status: "needs_ocr",
        metadata: { filename, fileType: "pdf", sizeBytes: buffer.length, pages: total },
      });
    }

    context.parserSelected = "buildPdfDocument (header/footer strip)";
    const document = buildPdfDocument(pages, total, filename, buffer.length);
    return NextResponse.json({ status: "done", document });
  } catch (err) {
    const knownErrorType = KNOWN_ERROR_TYPES.find((ErrorType) => err instanceof ErrorType);

    if (knownErrorType && err instanceof Error) {
      return handleKnownError(err, 422, context);
    }

    return handleUnexpectedError(err, context, "Unable to process this document.");
  }
}
