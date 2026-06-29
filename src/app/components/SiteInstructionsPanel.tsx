"use client";

import { useEffect, useState } from "react";
import type { SiteInstructions } from "../types";

export default function SiteInstructionsPanel({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: SiteInstructions;
}) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(data.categories.filter((c) => c.items.length > 0).slice(0, 1).map((c) => c.id))
  );

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Site Instructions"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Site Instructions
            </p>
            <p className="mt-0.5 text-sm text-zinc-400">
              {data.categories.filter((c) => c.items.length > 0).length} categories
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close site instructions"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <section className="mb-5 rounded-md border border-dashed border-zinc-700 bg-zinc-950 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-500">
              AI Summary
              <span className="rounded-sm border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                Coming Soon
              </span>
            </p>
            {data.aiSummary.length > 0 ? (
              <ul className="space-y-1.5">
                {data.aiSummary.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-300">
                    <span className="mt-0.5 text-zinc-600">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                A condensed summary of the categories below will appear here.
              </p>
            )}
          </section>

          <div className="space-y-2">
            {data.categories.map((category) => {
              const isOpen = openSections.has(category.id);
              const hasContent = category.items.length > 0;

              return (
                <div
                  key={category.id}
                  className="overflow-hidden rounded-md border border-zinc-800"
                >
                  <button
                    onClick={() => toggleSection(category.id)}
                    disabled={!hasContent}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                      hasContent ? "hover:bg-zinc-800/50" : "cursor-default opacity-50"
                    }`}
                  >
                    <span className="text-sm font-semibold text-zinc-100">
                      {category.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">
                        {hasContent ? category.items.length : "None"}
                      </span>
                      {hasContent && <ChevronIcon open={isOpen} />}
                    </span>
                  </button>

                  {isOpen && hasContent && (
                    <ul className="space-y-2 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
                      {category.items.map((item, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-sm leading-relaxed text-zinc-300"
                        >
                          <span className="mt-0.5 text-zinc-600">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M6 6l12 12M18 6L6 18" />
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
      className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
