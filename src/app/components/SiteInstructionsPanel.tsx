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

  const nonEmptyCount = data.categories.filter((c) => c.items.length > 0).length;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-charcoal/30 transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Document Reference"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-beige bg-ivory shadow-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-beige px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-taupe">
              Document Reference
            </p>
            <p className="mt-0.5 text-sm text-olive">
              {nonEmptyCount} {nonEmptyCount === 1 ? "category" : "categories"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close document reference"
            className="flex h-8 w-8 items-center justify-center border border-beige text-taupe transition hover:border-stone hover:text-charcoal"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {data.aiSummary.length > 0 && (
            <section className="mb-6 border-b border-beige pb-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-taupe">
                Summary
              </p>
              <ul className="space-y-2">
                {data.aiSummary.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-olive">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="space-y-0">
            {data.categories.map((category) => {
              const isOpen = openSections.has(category.id);
              const hasContent = category.items.length > 0;

              return (
                <div key={category.id} className="border-b border-beige last:border-0">
                  <button
                    onClick={() => toggleSection(category.id)}
                    disabled={!hasContent}
                    className={`flex w-full items-center justify-between py-3.5 text-left transition ${
                      hasContent ? "hover:text-charcoal" : "cursor-default opacity-40"
                    }`}
                  >
                    <span className="text-sm font-semibold text-charcoal">
                      {category.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-taupe">
                        {hasContent ? category.items.length : "—"}
                      </span>
                      {hasContent && <ChevronIcon open={isOpen} />}
                    </span>
                  </button>

                  {isOpen && hasContent && (
                    <ul className="space-y-2 pb-4">
                      {category.items.map((item, i) => (
                        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-olive">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
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
      strokeWidth="1.5"
      className={`h-3.5 w-3.5 shrink-0 text-stone transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
