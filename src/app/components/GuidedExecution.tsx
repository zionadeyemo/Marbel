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
  const [siteInstructionsOpen, setSiteInstructionsOpen] = useState(false);

  const currentStep = flatSteps[currentIndex];
  const upNext = flatSteps.slice(currentIndex + 1, currentIndex + 3);
  const progress = Math.round((completed.size / totalSteps) * 100);
  const stepsRemaining = totalSteps - completed.size;

  const siteInstructions = plan.siteInstructions;
  const siteInstructionsCount =
    siteInstructions?.categories.filter((c) => c.items.length > 0).length ?? 0;

  const isAllDone = completed.size === totalSteps;

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(totalSteps - 1, index));
    setCurrentIndex(clamped);
    setDetailOpen(false);
    setJumpOpen(false);
  };

  const markComplete = () => {
    const next = new Set(completed).add(currentIndex);
    setCompleted(next);
    if (currentIndex < totalSteps - 1) {
      goTo(currentIndex + 1);
    }
  };

  // Completion screen
  if (isAllDone) {
    const now = new Date();
    const timestamp = now.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    return (
      <div className="mx-auto w-full max-w-2xl py-16 text-center">
        <div className="mb-8 inline-flex h-16 w-16 items-center justify-center border border-sage bg-sage-light/30 text-sage">
          <CheckLargeIcon />
        </div>

        <h1 className="font-serif text-4xl font-bold text-charcoal">
          You&rsquo;re all set.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-olive">
          {plan.missionSummary}
        </p>

        <div className="mx-auto mt-10 max-w-sm border border-beige bg-warm text-left">
          <div className="border-b border-beige px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-taupe">
              Summary
            </p>
          </div>
          <dl className="divide-y divide-beige">
            <div className="flex justify-between px-6 py-3.5 text-sm">
              <dt className="text-olive">Steps completed</dt>
              <dd className="font-semibold text-charcoal">{totalSteps}</dd>
            </div>
            <div className="flex justify-between px-6 py-3.5 text-sm">
              <dt className="text-olive">Phases</dt>
              <dd className="font-semibold text-charcoal">{plan.phases.length}</dd>
            </div>
            <div className="flex justify-between px-6 py-3.5 text-sm">
              <dt className="text-olive">Estimated duration</dt>
              <dd className="font-semibold text-charcoal">{plan.estimatedDuration}</dd>
            </div>
            <div className="flex justify-between px-6 py-3.5 text-sm">
              <dt className="text-olive">Completed</dt>
              <dd className="font-semibold text-charcoal">{timestamp}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onReset}
            className="border border-charcoal bg-charcoal px-6 py-3 text-sm font-semibold uppercase tracking-widest text-ivory transition hover:bg-ink"
          >
            Start New Workflow
          </button>
        </div>
      </div>
    );
  }

  if (!currentStep) return null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header row */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-taupe">
            Mission
          </p>
          <p className="mt-1 text-sm text-olive">{plan.missionSummary}</p>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 border border-beige px-3 py-2 text-xs font-semibold uppercase tracking-wide text-olive transition hover:border-stone hover:text-charcoal"
        >
          New Document
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-taupe">
          <span className="font-semibold uppercase tracking-widest">
            Step {currentIndex + 1} of {totalSteps}
          </span>
          <span>
            {stepsRemaining === 0 ? "Complete" : `${stepsRemaining} remaining`}
            {" · "}{progress}%
          </span>
        </div>
        <div className="h-px w-full bg-beige">
          <div
            className="h-px bg-charcoal transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current step card */}
      <div className="border border-beige bg-white">
        {/* Phase label */}
        <div className="flex items-center justify-between border-b border-beige px-6 py-3.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-taupe">
            {currentStep.phaseTitle}
          </span>
          {completed.has(currentIndex) && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-sage">
              <CheckSmallIcon /> Completed
            </span>
          )}
        </div>

        {/* Step body */}
        <div className="px-6 py-8">
          <h2 className="font-serif text-3xl font-bold leading-snug text-charcoal">
            {currentStep.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-olive">
            {currentStep.description}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-taupe">
              <ClockIcon />
              {currentStep.duration}
            </div>

            {siteInstructionsCount > 0 && (
              <button
                onClick={() => setSiteInstructionsOpen(true)}
                className="flex items-center gap-1.5 border border-beige px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-olive transition hover:border-stone hover:text-charcoal"
              >
                <DocumentIcon />
                Document Reference
              </button>
            )}
          </div>

          {/* Expandable detail */}
          <button
            onClick={() => setDetailOpen((v) => !v)}
            className="mt-6 flex items-center gap-2 text-sm font-semibold text-taupe underline-offset-4 hover:text-charcoal hover:underline"
          >
            {detailOpen ? "Hide detail" : "Need more detail?"}
            <ChevronIcon open={detailOpen} />
          </button>

          {detailOpen && (
            <div className="mt-4 space-y-5 border border-beige bg-warm p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-taupe">
                  Technical Notes
                </p>
                <p className="mt-2 text-sm leading-relaxed text-olive">
                  {currentStep.details}
                </p>
              </div>

              {currentStep.warnings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-taupe">
                    Warnings
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {currentStep.warnings.map((w, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed text-charcoal">
                        <span className="mt-0.5 shrink-0">⚠</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap items-center gap-3 border-t border-beige px-6 py-4">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="border border-beige px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-stone hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Previous
          </button>

          <button
            onClick={markComplete}
            className="border border-charcoal bg-charcoal px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-ivory transition hover:bg-ink"
          >
            {completed.has(currentIndex) ? "Next →" : "Complete & Continue"}
          </button>

          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === totalSteps - 1}
            className="border border-beige px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-stone hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-30"
          >
            Skip →
          </button>

          <button
            onClick={() => setJumpOpen((v) => !v)}
            className="ml-auto border border-beige px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-taupe transition hover:border-stone hover:text-charcoal"
          >
            Jump to Phase
          </button>
        </div>

        {/* Phase jump */}
        {jumpOpen && (
          <div className="border-t border-beige px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {plan.phases.map((phase, pIndex) => {
                const firstStep = flatSteps.find((s) => s.phaseIndex === pIndex);
                if (!firstStep) return null;
                const isCurrentPhase = currentStep.phaseIndex === pIndex;
                return (
                  <button
                    key={pIndex}
                    onClick={() => goTo(firstStep.globalIndex)}
                    className={`border px-3 py-2 text-sm transition ${
                      isCurrentPhase
                        ? "border-charcoal bg-warm text-charcoal"
                        : "border-beige text-olive hover:border-stone hover:text-charcoal"
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

      {/* Up next — only 2 */}
      {upNext.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-taupe">
            Coming up
          </p>
          <ul className="divide-y divide-beige border border-beige">
            {upNext.map((step) => (
              <li
                key={step.globalIndex}
                className="flex items-center gap-3 bg-warm px-5 py-3.5 text-sm text-olive"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-beige text-[10px] font-semibold text-taupe">
                  {step.globalIndex + 1}
                </span>
                {step.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Required tools */}
      {plan.tools.length > 0 && (
        <div className="mt-8 border-t border-beige pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-taupe">
            Required Tools &amp; Materials
          </p>
          <ul className="space-y-1">
            {plan.tools.map((tool, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-olive">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone" />
                {tool}
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function CheckLargeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
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
      strokeWidth="1.5"
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
