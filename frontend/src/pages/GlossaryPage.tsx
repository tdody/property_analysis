import { useMemo, useState } from "react";
import { GLOSSARY } from "../data/glossary.ts";
import type { GlossaryEntry } from "../data/glossary.ts";
import { Segmented } from "../components/shared/Segmented.tsx";

type CategoryFilter = "all" | GlossaryEntry["category"];

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "metrics", label: "Metrics" },
  { value: "revenue", label: "Revenue" },
  { value: "expenses", label: "Expenses" },
  { value: "financing", label: "Financing" },
  { value: "tax", label: "Tax" },
];

const CATEGORY_LABELS: Record<GlossaryEntry["category"], string> = {
  metrics: "Metrics",
  revenue: "Revenue",
  expenses: "Expenses",
  financing: "Financing",
  tax: "Tax & Property",
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function termToId(term: string): string {
  return `term-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function matchesSearch(entry: GlossaryEntry, needle: string): boolean {
  if (!needle) return true;
  const haystack =
    `${entry.term} ${entry.definition} ${entry.formula ?? ""}`.toLowerCase();
  return haystack.includes(needle);
}

export function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return GLOSSARY.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      return matchesSearch(entry, needle);
    });
  }, [search, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>();
    for (const entry of filtered) {
      const letter = entry.term[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(entry);
    }
    return map;
  }, [filtered]);

  const activeLetters = useMemo(() => new Set(grouped.keys()), [grouped]);

  const handleLetterClick = (letter: string) => {
    const el = document.getElementById(`letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTermClick = (term: string) => {
    const el = document.getElementById(termToId(term));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-accent");
      setTimeout(
        () => el.classList.remove("ring-2", "ring-accent"),
        2000
      );
    }
  };

  const totalCount = filtered.length;

  return (
    <div className="space-y-8">
      {/* Editorial header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="caps text-ink-3 mb-2">Glossary</p>
          <h1 className="font-serif text-[44px] leading-tight text-ink">
            Every term, defined.
          </h1>
          <p className="text-[14px] text-ink-3 mt-2">
            {totalCount} {totalCount === 1 ? "entry" : "entries"}
            {category !== "all"
              ? ` in ${CATEGORY_LABELS[category as GlossaryEntry["category"]]}`
              : ""}
          </p>
        </div>
        <div className="md:max-w-xs w-full">
          <label className="field-label" htmlFor="glossary-search">
            Search
          </label>
          <input
            id="glossary-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cap rate, DSCR, Redfin…"
            className="field"
          />
        </div>
      </header>

      {/* Category pill */}
      <div>
        <Segmented
          options={CATEGORY_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          value={category}
          onChange={(v) => setCategory(v as CategoryFilter)}
          ariaLabel="Category filter"
        />
      </div>

      {/* A–Z index */}
      <div className="sticky top-0 z-10 bg-canvas py-3 -mx-2 px-2 border-b border-rule">
        <div className="flex flex-wrap gap-1">
          {ALPHABET.map((letter) => {
            const active = activeLetters.has(letter);
            return (
              <button
                key={letter}
                type="button"
                onClick={() => active && handleLetterClick(letter)}
                disabled={!active}
                className={`w-8 h-8 font-mono text-[13px] rounded border transition-colors ${
                  active
                    ? "border-rule-strong text-ink hover:border-ink hover:text-accent cursor-pointer"
                    : "border-transparent text-ink-3 opacity-40 cursor-not-allowed"
                }`}
                aria-label={`Jump to ${letter}${active ? "" : " (no entries)"}`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      {totalCount === 0 ? (
        <div className="border-2 border-dashed border-rule-strong rounded py-16 px-6 text-center">
          <p className="font-serif text-[22px] text-ink mb-2">
            No matching terms
          </p>
          <p className="text-[13px] text-ink-3">
            Try a different search or category.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {ALPHABET.filter((l) => activeLetters.has(l)).map((letter) => (
            <section
              key={letter}
              id={`letter-${letter}`}
              className="grid grid-cols-1 md:grid-cols-[80px_minmax(0,1fr)] gap-6 scroll-mt-24"
            >
              <div>
                <h2 className="font-serif text-[48px] leading-none text-ink-2">
                  {letter}
                </h2>
              </div>
              <div className="space-y-8">
                {grouped.get(letter)!.map((entry) => (
                  <GlossaryEntryBlock
                    key={entry.term}
                    entry={entry}
                    onRelatedClick={handleTermClick}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function GlossaryEntryBlock({
  entry,
  onRelatedClick,
}: {
  entry: GlossaryEntry;
  onRelatedClick: (term: string) => void;
}) {
  return (
    <article
      id={termToId(entry.term)}
      className="border-t border-rule pt-6 scroll-mt-24 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-serif text-[22px] leading-tight text-ink">
          {entry.term}
        </h3>
        <span className="caps px-2 py-0.5 border border-rule-strong rounded">
          {CATEGORY_LABELS[entry.category]}
        </span>
      </div>

      <p className="text-[14px] text-ink-2 leading-relaxed max-w-3xl">
        {entry.definition}
      </p>

      {entry.formula && (
        <div className="mt-4 border border-rule-strong rounded p-4 max-w-2xl">
          <div className="caps text-ink-3 mb-1">Formula</div>
          <p className="font-mono tabular-nums text-[14px] text-ink">
            {entry.formula}
          </p>
        </div>
      )}

      {entry.relatedTerms && entry.relatedTerms.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="caps text-ink-3">Related</span>
          {entry.relatedTerms.map((rt) => (
            <button
              key={rt}
              type="button"
              onClick={() => onRelatedClick(rt)}
              className="text-[13px] text-accent hover:underline"
            >
              {rt}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
