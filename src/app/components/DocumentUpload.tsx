"use client";

import { useCallback, useRef, useState } from "react";
import type { ParsedDocument } from "../lib/parsers/types";

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "ocr" }
  | { phase: "done"; document: ParsedDocument }
  | { phase: "error"; message: string; errorId?: string };

class UploadError extends Error {
  errorId?: string;

  constructor(message: string, errorId?: string) {
    super(message);
    this.errorId = errorId;
  }
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md"];

const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: "PDF",
  docx: "Word Document",
  pptx: "PowerPoint",
  txt: "Text File",
  md: "Markdown",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadFile(file: File, phase?: "ocr") {
  const formData = new FormData();
  formData.append("file", file);
  if (phase) formData.append("phase", phase);

  const res = await fetch("/api/parse-document", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    if (data.debug) {
      console.error("[parse-document] failed", data.debug);
    }
    throw new UploadError(data.error ?? "Unable to read this document.", data.errorId);
  }

  return data as
    | { status: "done"; document: ParsedDocument }
    | { status: "needs_ocr"; metadata: ParsedDocument["metadata"] };
}

export default function DocumentUpload({
  onExtracted,
}: {
  onExtracted: (document: ParsedDocument) => void;
}) {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setState({ phase: "uploading" });

    try {
      const first = await uploadFile(file);

      if (first.status === "needs_ocr") {
        setState({ phase: "ocr" });
        const second = await uploadFile(file, "ocr");
        if (second.status !== "done") throw new Error("Unable to read this document.");
        setState({ phase: "done", document: second.document });
        onExtracted(second.document);
        return;
      }

      setState({ phase: "done", document: first.document });
      onExtracted(first.document);
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Unable to read this document.",
        errorId: err instanceof UploadError ? err.errorId : undefined,
      });
    }
  }, [onExtracted]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const reset = () => {
    setState({ phase: "idle" });
  };

  if (state.phase === "done") {
    const { metadata } = state.document;
    return (
      <div className="border border-beige bg-warm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-sage bg-sage-light/30 text-sage">
              <CheckIcon />
            </div>
            <div>
              <p className="font-semibold text-charcoal">{metadata.filename}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-olive">
                <span className="border border-beige px-1.5 py-0.5 uppercase tracking-wide">
                  {FILE_TYPE_LABEL[metadata.fileType]}
                </span>
                {metadata.pages != null && <span>{metadata.pages} pages</span>}
                <span>{formatFileSize(metadata.sizeBytes)}</span>
                {metadata.ocrUsed && (
                  <span className="border border-stone px-1.5 py-0.5 text-olive">OCR</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={reset}
            className="shrink-0 border border-beige px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-olive transition hover:border-stone hover:text-charcoal"
          >
            Replace
          </button>
        </div>

        <p className="mt-3 text-sm font-medium text-sage">
          Ready for workflow generation.
        </p>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-taupe">
            Extracted Text Preview
          </p>
          <div className="max-h-44 overflow-y-auto border border-beige bg-ivory p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-olive">
              {state.document.text.slice(0, 1000)}
              {state.document.text.length > 1000 ? "…" : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "uploading" || state.phase === "ocr") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border border-beige bg-warm px-6 py-12 text-center">
        <div className="spinner h-7 w-7 rounded-full border-2 border-beige border-t-charcoal" />
        <p className="text-xs font-semibold uppercase tracking-widest text-taupe">
          {state.phase === "ocr"
            ? "Scanned document detected. Running OCR…"
            : "Extracting document text…"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-12 text-center transition ${
          isDragOver
            ? "border-charcoal bg-warm"
            : "border-beige bg-ivory hover:border-stone"
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center border border-beige text-taupe">
          <PaperclipIcon />
        </div>
        <p className="text-sm text-olive">
          Drop a PDF, Word document, PowerPoint, Markdown, or Text file here.
        </p>
        <p className="text-xs font-semibold uppercase tracking-widest text-stone">
          or click to browse
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {state.phase === "error" && (
        <div className="mt-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {state.errorId ? (
            <>
              <p>Something went wrong.</p>
              <p className="mt-1 font-mono text-xs text-rose-500">
                Error ID: {state.errorId}
              </p>
            </>
          ) : (
            state.message
          )}
        </div>
      )}
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M21 11.5l-8.5 8.5a4 4 0 0 1-5.66-5.66l9-9a3 3 0 0 1 4.24 4.24l-8.5 8.5a2 2 0 0 1-2.83-2.83l7.5-7.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
