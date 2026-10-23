"use client";

import { Search } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { springs } from "@/components/motion/transitions";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn } from "@/lib/utils";

type Candidate = { id: string; name: string; college: string; react: number; commits: number; live: boolean; check: boolean; mentor: boolean };

// Fictional sample rows for the demo only.
const PEOPLE: Candidate[] = [
  { id: "a", name: "Aarav Shah", college: "SPIT Surat", react: 91, commits: 212, live: true, check: true, mentor: false },
  { id: "b", name: "Ishita Varma", college: "WGIT Pune", react: 86, commits: 141, live: true, check: true, mentor: true },
  { id: "c", name: "Kabir Mehta", college: "DVCE", react: 74, commits: 88, live: false, check: true, mentor: true },
  { id: "d", name: "Meher Joshi", college: "NVIE", react: 69, commits: 156, live: true, check: false, mentor: false },
  { id: "e", name: "Rohan Iyer", college: "SPIT Surat", react: 58, commits: 41, live: false, check: false, mentor: true },
  { id: "f", name: "Tanvi Rao", college: "WGIT Pune", react: 81, commits: 97, live: true, check: false, mentor: true },
];

const FILTERS = [
  { id: "react", label: "React ≥ 70", test: (c: Candidate) => c.react >= 70 },
  { id: "live", label: "Live deployment", test: (c: Candidate) => c.live },
  { id: "check", label: "Passed a check", test: (c: Candidate) => c.check },
  { id: "mentor", label: "Mentor-endorsed", test: (c: Candidate) => c.mentor },
  { id: "commits", label: "100+ own commits", test: (c: Candidate) => c.commits >= 100 },
] as const;

const SORTS = [
  { id: "react", label: "React score", key: (c: Candidate) => c.react },
  { id: "commits", label: "Own commits", key: (c: Candidate) => c.commits },
] as const;

/** Interactive, fictional evidence search: results re-sort with layout animations as filters change. */
export function SearchDemo() {
  const [on, setOn] = useState<Set<string>>(new Set(["react"]));
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("react");
  const sorter = SORTS.find((s) => s.id === sort)!;
  const results = PEOPLE.filter((c) => FILTERS.every((f) => !on.has(f.id) || f.test(c))).sort((a, b) => sorter.key(b) - sorter.key(a));

  return (
    <div className="rounded-[1.4rem] border border-line bg-surface p-4 shadow-pop sm:p-5">
      <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-sm text-muted">
        <Search className="size-4" aria-hidden /> frontend, react, final year
        <span className="ml-auto font-mono text-[11px] text-subtle">demo data</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filters">
        {FILTERS.map((f) => {
          const active = on.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setOn((prev) => {
                  const next = new Set(prev);
                  if (next.has(f.id)) next.delete(f.id);
                  else next.add(f.id);
                  return next;
                })
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                active ? "border-verified/30 bg-verified-soft text-verified" : "border-line bg-surface-2 text-muted hover:text-ink",
              )}
            >
              {active && <SealGlyph className="size-3" />}
              {f.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-subtle">
        <span aria-live="polite">
          {results.length} of {PEOPLE.length} candidates
        </span>
        <span className="flex items-center gap-1">
          Sort
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              onClick={() => setSort(s.id)}
              className={cn("rounded-md px-1.5 py-0.5", sort === s.id ? "bg-surface-2 text-ink" : "hover:text-ink")}
            >
              {s.label}
            </button>
          ))}
        </span>
      </div>
      <LayoutGroup>
        <ul className="mt-2 grid min-h-[17rem] content-start gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {results.map((c, i) => (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={springs.layout}
                className={cn("flex items-center gap-3 rounded-xl border p-3", i === 0 ? "border-line-strong bg-surface-2/60" : "border-line bg-surface")}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 font-display text-sm font-semibold">{c.name[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate font-mono text-[10.5px] text-subtle">
                    {c.college} · {c.commits} commits{c.live ? " · live" : ""}
                    {c.check ? " · check ✓" : ""}
                    {c.mentor ? " · mentor ✓" : ""}
                  </span>
                </span>
                <span className="font-display text-xl font-semibold text-verified tabular">{c.react}</span>
              </motion.li>
            ))}
          </AnimatePresence>
          {results.length === 0 && <li className="py-10 text-center text-sm text-muted">No one has proven all of that yet. Loosen a filter.</li>}
        </ul>
      </LayoutGroup>
    </div>
  );
}
