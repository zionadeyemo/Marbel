"use client";

import { useMemo, useState } from "react";
import type { WorkflowPlan } from "../types";
import { flattenPlan } from "../types";
import SiteInstructionsPanel from "./SiteInstructionsPanel";

export default function GuidedExecution({
  plan,
  onReset,
}: {
  plan: WorkflowPlan;
  onReset: () => void;
}) {
  const flatSteps = useMemo(() => flattenPlan(plan), [plan]);
  const totalSteps = flatSteps.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [siteInstructionsOpen, setSiteInstructionsOpen] = useState(false);

  const currentStep = flatSteps[currentIndex];
  const upNext = flatSteps.slice(currentIndex + 1, currentIndex + 4);
  const progress = Math.round(((currentIndex + 1) / totalSteps) * 100);

  const siteInstructions = plan.siteInstructions;
  const siteInstructionsCount =
    siteInstructions?.categories.filter((c) => c.items.length > 0).length ?? 0;

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(totalSteps - 1, index));
    setCurrentIndex(clamped);
    setDetailOpen(false);
    setJumpOpen(false);
  };

  const markComplete = () => {
    setCompleted((prev) => new Set(prev).add(currentIndex));
    if (currentIndex < totalSteps - 1) {
      goTo(currentIndex + 1);
    }
  };

  if (!currentStep) return null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Mission
          </p>
          <p className="mt-0.5 text-sm text-zinc-300">{plan.missionSummary}</p>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 rounded-md border border-zinc-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
        >
          New Document
        </button>
      </div>

      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-zinc-500">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500">
            Step {currentIndex + 1} of {totalSteps}
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {currentStep.phaseTitle}
          </span>
        </div>

        <div className="px-5 py-6">
          <h2 className="text-2xl font-bold leading-snug text-zinc-50">
            {currentStep.title}
          </h2>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-zinc-300">
            {currentStep.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
              <ClockIcon />
              Estimated time: {currentStep.duration}
            </div>

            {siteInstructionsCount > 0 && (
              <button
                onClick={() => setSiteInstructionsOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-orange-500 hover:text-orange-400"
              >
                <DocumentIcon />
                View Site Instructions ({siteInstructionsCount})
              </button>
            )}
          </div>

          {completed.has(currentIndex) && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-700 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-400">
              <CheckIcon /> Marked complete
            </div>
          )}

          <button
            onClick={() => setDetailOpen((v) => !v)}
            className="mt-5 flex items-center gap-2 text-sm font-semibold text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            {detailOpen ? "Hide Detail" : "Need More Detail?"}
            <ChevronIcon open={detailOpen} />
          </button>

          {detailOpen && (
            <div className="mt-4 space-y-4 rounded-md border border-zinc-800 bg-zinc-950 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Technical Notes
                </p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                  {currentStep.details}
                </p>
              </div>

              {currentStep.warnings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">
                    Warnings
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {currentStep.warnings.map((w, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-sm leading-relaxed text-orange-300"
                      >
                        <span className="mt-0.5">⚠</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 px-5 py-4">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>

          <button
            onClick={markComplete}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-emerald-500"
          >
            Mark Complete
          </button>

          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === totalSteps - 1}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>

          <button
            onClick={() => setJumpOpen((v) => !v)}
            className="ml-auto rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            Jump to Phase
          </button>
        </div>

        {jumpOpen && (
          <div className="border-t border-zinc-800 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {plan.phases.map((phase, pIndex) => {
                const firstStep = flatSteps.find((s) => s.phaseIndex === pIndex);
                if (!firstStep) return null;
                const isCurrentPhase = currentStep.phaseIndex === pIndex;
                return (
                  <button
                    key={pIndex}
                    onClick={() => goTo(firstStep.globalIndex)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                      isCurrentPhase
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {pIndex + 1}. {phase.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {upNext.length > 0 && (
        <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Up Next
          </p>
          <ul className="space-y-2">
            {upNext.map((step) => (
              <li
                key={step.globalIndex}
                className="flex items-center gap-3 text-sm text-zinc-400"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-[10px] text-zinc-500">
                  {step.globalIndex + 1}
                </span>
                {step.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-zinc-600">
        {plan.tools.length > 0 && (
          <button
            onClick={() => setShowOverview((v) => !v)}
            className="font-semibold uppercase tracking-widest text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
          >
            {showOverview ? "Hide" : "Show"} Mission Overview
          </button>
        )}
      </div>

      {showOverview && (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Estimated Duration
          </p>
          <p className="mt-1 text-sm text-zinc-300">{plan.estimatedDuration}</p>

          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Required Tools
          </p>
          <ul className="mt-2 space-y-1">
            {plan.tools.map((tool, i) => (
              <li key={i} className="text-sm text-zinc-300">
                • {tool}
              </li>
            ))}
          </ul>
        </div>
      )}

      {siteInstructions && (
        <SiteInstructionsPanel
          open={siteInstructionsOpen}
          onClose={() => setSiteInstructionsOpen(false)}
          data={siteInstructions}
        />
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="h-4 w-4"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M7 3h7l3 3v15H7z" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
