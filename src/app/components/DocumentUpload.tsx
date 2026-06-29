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
      <div className="rounded-md border border-zinc-700 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-700 bg-emerald-500/10 text-emerald-400">
              <CheckIcon />
            </div>
            <div>
              <p className="font-semibold text-zinc-100">{metadata.filename}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400">
                <span className="rounded-sm border border-zinc-700 px-1.5 py-0.5 uppercase tracking-wide">
                  {FILE_TYPE_LABEL[metadata.fileType]}
                </span>
                {metadata.pages != null && <span>{metadata.pages} pages</span>}
                <span>{formatFileSize(metadata.sizeBytes)}</span>
                {metadata.ocrUsed && (
                  <span className="rounded-sm border border-orange-700 px-1.5 py-0.5 text-orange-400">
                    OCR
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={reset}
            className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            Replace Document
          </button>
        </div>

        <p className="mt-3 text-sm font-medium text-emerald-400">
          Ready for workflow generation.
        </p>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Extracted Text Preview
          </p>
          <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-zinc-700 bg-zinc-900 px-6 py-12 text-center">
        <div className="spinner h-8 w-8 rounded-full border-[3px] border-zinc-700 border-t-orange-500" />
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed px-6 py-12 text-center transition ${
          isDragOver
            ? "border-orange-500 bg-orange-500/5"
            : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-zinc-700 text-zinc-400">
          <PaperclipIcon />
        </div>
        <p className="text-sm font-medium text-zinc-300">
          Drop a PDF, Word document, PowerPoint, Markdown, or Text file here.
        </p>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
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
        <div className="mt-3 rounded-md border border-orange-700 bg-orange-500/10 px-4 py-3 text-sm font-medium text-orange-300">
          {state.errorId ? (
            <>
              <p>Something went wrong.</p>
              <p className="mt-1 font-mono text-xs text-orange-400">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M21 11.5l-8.5 8.5a4 4 0 0 1-5.66-5.66l9-9a3 3 0 0 1 4.24 4.24l-8.5 8.5a2 2 0 0 1-2.83-2.83l7.5-7.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
