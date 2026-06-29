"use client";

import { useState } from "react";
import Spinner from "./components/Spinner";
import SkillLevelSelector from "./components/SkillLevelSelector";
import GuidedExecution from "./components/GuidedExecution";
import DocumentUpload from "./components/DocumentUpload";
import type { SkillLevel, WorkflowPlan } from "./types";
import type { ParsedDocument } from "./lib/parsers/types";

export default function Home() {
  const [document, setDocument] = useState("");
  const [uploadedDocument, setUploadedDocument] = useState<ParsedDocument | null>(null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("intermediate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [plan, setPlan] = useState<WorkflowPlan | null>(null);

  const handleGenerate = async () => {
    const trimmed = (uploadedDocument?.text ?? document).trim();

    if (!trimmed) {
      setError("Please paste or upload some technical documentation before generating a plan.");
      setErrorId(null);
      return;
    }

    setError(null);
    setErrorId(null);
    setLoading(true);
    setPlan(null);

    try {
      const res = await fetch("/api/generate-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: trimmed, skillLevel }),
      });

      const data = await res.json();

      if (data.debug) {
        console.error("[generate-workflow] failed", data.debug);
      }

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setErrorId(data.errorId ?? null);
        return;
      }

      setPlan(data.plan);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setErrorId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPlan(null);
    setError(null);
    setErrorId(null);
    setDocument("");
    setUploadedDocument(null);
  };

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-orange-500 font-bold text-zinc-950">
              M
            </div>
            <span className="text-base font-bold uppercase tracking-widest text-zinc-100">
              Marbel
            </span>
            <span className="ml-2 rounded-sm border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Guided Execution System
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {!plan && !loading && (
          <>
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
                Turn Documentation Into a Guided Mission
              </h1>
              <p className="mt-4 text-base leading-relaxed text-zinc-400">
                Paste installation guides, SOPs, SOWs, manuals, or technical
                procedures. Marbel breaks the job into phases and walks you
                through it one action at a time — current step only, nothing
                more.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-4xl space-y-6">
              <SkillLevelSelector value={skillLevel} onChange={setSkillLevel} />

              <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Option 1 — Paste Technical Documentation
                  </p>
                  <textarea
                    value={document}
                    onChange={(e) => {
                      setDocument(e.target.value);
                      if (e.target.value) setUploadedDocument(null);
                    }}
                    placeholder="Paste technical documentation here..."
                    rows={14}
                    className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 p-4 text-[1rem] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="my-6 flex items-center justify-center lg:my-0 lg:flex-col">
                  <div className="h-px flex-1 bg-zinc-800 lg:h-full lg:w-px" />
                  <span className="px-3 text-xs font-bold uppercase tracking-widest text-zinc-600 lg:py-3">
                    Or
                  </span>
                  <div className="h-px flex-1 bg-zinc-800 lg:h-full lg:w-px" />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Option 2 — Upload Documentation
                  </p>
                  <DocumentUpload
                    onExtracted={(doc) => {
                      setUploadedDocument(doc);
                      setDocument("");
                    }}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-orange-700 bg-orange-500/10 px-4 py-3 text-sm font-medium text-orange-300">
                  {errorId ? (
                    <>
                      <p>Something went wrong.</p>
                      <p className="mt-1 font-mono text-xs text-orange-400">
                        Error ID: {errorId}
                      </p>
                    </>
                  ) : (
                    error
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  className="rounded-md bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-widest text-zinc-950 transition hover:bg-orange-400"
                >
                  Generate Workflow
                </button>
              </div>
            </div>
          </>
        )}

        {loading && <Spinner />}

        {plan && !loading && (
          <GuidedExecution plan={plan} onReset={handleReset} />
        )}
      </div>
    </main>
  );
}
