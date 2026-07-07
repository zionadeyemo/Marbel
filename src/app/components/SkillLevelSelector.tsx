"use client";

import type { SkillLevel } from "../types";

const OPTIONS: { value: SkillLevel; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "Detailed, step-by-step" },
  { value: "intermediate", label: "Intermediate", hint: "Standard detail" },
  { value: "expert", label: "Expert", hint: "Compressed instructions" },
];

export default function SkillLevelSelector({
  value,
  onChange,
}: {
  value: SkillLevel;
  onChange: (level: SkillLevel) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-taupe">
        Experience Level
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-start border px-4 py-3.5 text-left transition ${
                active
                  ? "border-charcoal bg-warm"
                  : "border-beige bg-ivory hover:border-stone"
              }`}
            >
              <span className="flex items-center gap-2.5 text-sm font-semibold text-charcoal">
                <span
                  className={`h-3 w-3 rounded-full border-2 ${
                    active ? "border-charcoal bg-charcoal" : "border-stone"
                  }`}
                />
                {opt.label}
              </span>
              <span className="mt-1 text-xs text-olive">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
