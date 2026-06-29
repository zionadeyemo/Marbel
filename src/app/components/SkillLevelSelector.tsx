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
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
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
              className={`flex flex-col items-start rounded-md border px-4 py-3 text-left transition ${
                active
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <span
                  className={`h-3 w-3 rounded-full border ${
                    active
                      ? "border-orange-500 bg-orange-500"
                      : "border-zinc-600"
                  }`}
                />
                {opt.label}
              </span>
              <span className="mt-1 text-xs text-zinc-500">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
