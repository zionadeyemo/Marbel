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

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function errorResponse(err: unknown) {
  if (
    err instanceof UnsupportedFileTypeError ||
    err instanceof EmptyDocumentError ||
    err instanceof CorruptedFileError ||
    err instanceof OcrFailedError
  ) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }

  console.error("Document parsing failed:", err);
  return NextResponse.json(
    { error: "Unable to read this document." },
    { status: 500 }
  );
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

  try {
    const fileType = detectFileType(filename);

    if (fileType !== "pdf") {
      const document = await parseDocument(buffer, filename);
      return NextResponse.json({ status: "done", document });
    }

    if (phase === "ocr") {
      const document = await ocrPdf(buffer, filename);
      return NextResponse.json({ status: "done", document });
    }

    const { pages, total } = await getPdfPageTexts(buffer);

    if (isScannedPdf(pages)) {
      return NextResponse.json({
        status: "needs_ocr",
        metadata: { filename, fileType: "pdf", sizeBytes: buffer.length, pages: total },
      });
    }

    const document = buildPdfDocument(pages, total, filename, buffer.length);
    return NextResponse.json({ status: "done", document });
  } catch (err) {
    return errorResponse(err);
  }
}
