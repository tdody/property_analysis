import { useMemo } from "react";
import { GLOSSARY } from "../data/glossary.ts";
import type { GlossaryEntry } from "../data/glossary.ts";

const CATEGORY_LABELS: Record<GlossaryEntry["category"], string> = {
  metrics: "Metrics",
  revenue: "Revenue",
  expenses: "Expenses",
  financing: "Financing",
  tax: "Tax & Property",
};

const CATEGORY_COLORS: Record<GlossaryEntry["category"], string> = {
  metrics: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  revenue: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  expenses: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  financing: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  tax: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function termToId(term: string): string {
  return `term-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function GlossaryPage() {
  const grouped = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>();
    for (const entry of GLOSSARY) {
      const letter = entry.term[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(entry);
    }
    return map;
  }, []);

  const activeLetters = useMemo(() => new Set(grouped.keys()), [grouped]);

  const handleLetterClick = (letter: string) => {
    const el = document.getElementById(`letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTermClick = (term: string) => {
    const el = document.getElementById(termToId(term));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-indigo-400");
      setTimeout(() => el.classList.remove("ring-2", "ring-indigo-400"), 2000);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Glossary
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Definitions for all metrics and terms used throughout the app.
        </p>
      </div>

      {/* Alphabet navigation */}
      <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 py-3 mb-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap gap-1">
          {ALPHABET.map((letter) => {
            const active = activeLetters.has(letter);
            return (
              <button
                key={letter}
                onClick={() => active && handleLetterClick(letter)}
                disabled={!active}
                className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400"
                    : "text-slate-300 dark:text-slate-600 cursor-default"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Glossary entries grouped by letter */}
      <div className="space-y-10">
        {ALPHABET.filter((l) => activeLetters.has(l)).map((letter) => (
          <section key={letter} id={`letter-${letter}`}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
              {letter}
            </h3>
            <div className="space-y-4">
              {grouped.get(letter)!.map((entry) => (
                <div
                  key={entry.term}
                  id={termToId(entry.term)}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/20 p-5 transition-all scroll-mt-20"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {entry.term}
                    </h4>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${CATEGORY_COLORS[entry.category]}`}
                    >
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {entry.definition}
                  </p>

                  {entry.formula && (
                    <div className="mt-3 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <span className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
                        Formula
                      </span>
                      <p className="text-sm font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                        {entry.formula}
                      </p>
                    </div>
                  )}

                  {entry.relatedTerms && entry.relatedTerms.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        Related:
                      </span>
                      {entry.relatedTerms.map((rt) => (
                        <button
                          key={rt}
                          onClick={() => handleTermClick(rt)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-colors"
                        >
                          {rt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
