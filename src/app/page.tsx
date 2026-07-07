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
    <main className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="border-b border-beige bg-ivory">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center bg-charcoal font-bold text-ivory text-sm">
              M
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-charcoal">
              Marbel
            </span>
            <span className="ml-1 text-xs font-semibold uppercase tracking-widest text-taupe">
              Guided Execution
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-16">
        {!plan && !loading && (
          <>
            {/* Hero */}
            <div className="mx-auto max-w-xl text-center">
              <h1 className="font-serif text-4xl font-bold leading-tight text-charcoal sm:text-5xl">
                Turn documentation<br />into guided action.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-olive">
                Paste installation guides, SOPs, manuals, or technical procedures.
                Marbel breaks the job into phases and walks you through it one step
                at a time.
              </p>
            </div>

            <div className="mx-auto mt-14 max-w-4xl space-y-8">
              <SkillLevelSelector value={skillLevel} onChange={setSkillLevel} />

              {/* Two-column input */}
              <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-taupe">
                    Paste documentation
                  </p>
                  <textarea
                    value={document}
                    onChange={(e) => {
                      setDocument(e.target.value);
                      if (e.target.value) setUploadedDocument(null);
                    }}
                    placeholder="Paste technical documentation here…"
                    rows={14}
                    className="w-full resize-y border border-beige bg-white px-4 py-3.5 text-[0.95rem] leading-relaxed text-charcoal placeholder:text-stone focus:border-charcoal focus:outline-none"
                  />
                </div>

                <div className="my-6 flex items-center justify-center lg:my-0 lg:flex-col">
                  <div className="h-px flex-1 bg-beige lg:h-full lg:w-px" />
                  <span className="px-3 text-xs font-bold uppercase tracking-widest text-stone lg:py-3">
                    or
                  </span>
                  <div className="h-px flex-1 bg-beige lg:h-full lg:w-px" />
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-taupe">
                    Upload a document
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
                <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {errorId ? (
                    <>
                      <p>Something went wrong.</p>
                      <p className="mt-1 font-mono text-xs text-rose-500">
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
                  className="border border-charcoal bg-charcoal px-7 py-3 text-sm font-semibold uppercase tracking-widest text-ivory transition hover:bg-ink"
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
