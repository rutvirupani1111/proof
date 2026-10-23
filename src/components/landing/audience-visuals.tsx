import { Check, Search, SlidersHorizontal } from "lucide-react";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn } from "@/lib/utils";

/** Static product vignettes for the audience sections. Decorative: the copy carries the meaning. */

export function StudentVignette() {
  const rows = [
    { k: "Code authorship", v: "41 own commits · 3 repos" },
    { k: "Live deployment", v: "tiffin-tracker.example · 200" },
    { k: "Skill check", v: "Async retry · 9/9 hidden tests" },
    { k: "Mentor", v: "Verified at @spit-surat.example" },
  ];
  return (
    <div aria-hidden className="relative rounded-[1.4rem] border border-line bg-surface bg-ledger p-5 shadow-pop">
      <div className="flex items-center justify-between border-b border-dashed border-line-strong pb-4">
        <div>
          <p className="font-mono text-[10.5px] tracking-[0.14em] text-subtle uppercase">proof.example/u/ishita-varma</p>
          <p className="mt-1 font-display text-xl font-semibold">Ishita Varma</p>
        </div>
        <div className="grid size-14 place-items-center rounded-full border-[5px] border-lime font-display text-lg font-semibold tabular">82</div>
      </div>
      <ul className="mt-4 grid gap-2.5">
        {rows.map((r) => (
          <li key={r.k} className="flex items-center gap-3 text-sm">
            <SealGlyph className="size-4 shrink-0 text-verified" />
            <span className="w-28 shrink-0 text-muted max-sm:hidden">{r.k}</span>
            <span className="truncate font-mono text-[12.5px]">{r.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecruiterVignette() {
  const results = [
    { n: "Aarav S.", s: 88, tags: ["React 91", "Live ×2"] },
    { n: "Ishita V.", s: 82, tags: ["React 86", "Check ✓"] },
    { n: "Kabir M.", s: 77, tags: ["TypeScript 80", "Mentor ✓"] },
  ];
  return (
    <div aria-hidden className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-pop">
      <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-sm text-muted">
        <Search className="size-4" /> react developer, live project
        <SlidersHorizontal className="ml-auto size-4" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["React ≥ 70", "Has live deployment", "Own commits ≥ 30", "Passed a check"].map((f, i) => (
          <span key={f} className={cn("rounded-full border px-2.5 py-1 text-[11.5px]", i < 3 ? "border-verified/30 bg-verified-soft text-verified" : "border-line bg-surface-2 text-muted")}>
            {f}
          </span>
        ))}
      </div>
      <ul className="mt-4 grid gap-2">
        {results.map((r, i) => (
          <li key={r.n} className={cn("flex items-center gap-3 rounded-xl border p-3", i === 0 ? "border-line-strong bg-surface-2/60" : "border-line")}>
            <span className="grid size-9 place-items-center rounded-full bg-surface-3 font-display text-sm font-semibold">{r.n[0]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{r.n}</span>
              <span className="mt-0.5 flex flex-wrap gap-1">
                {r.tags.map((t) => (
                  <span key={t} className="font-mono text-[10.5px] text-subtle">
                    {t}
                  </span>
                ))}
              </span>
            </span>
            <span className="font-display text-xl font-semibold text-verified tabular">{r.s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CollegeVignette() {
  const funnel = [
    { k: "Enrolled on Proof", v: 100 },
    { k: "GitHub proven", v: 78 },
    { k: "1+ live project", v: 52 },
    { k: "Passed a check", v: 41 },
    { k: "Job-ready (score ≥ 70)", v: 29 },
  ];
  return (
    <div aria-hidden className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-pop">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10.5px] tracking-[0.14em] text-subtle uppercase">Class of 2026 · readiness</p>
        <p className="font-mono text-[11px] text-subtle">212 students</p>
      </div>
      <ul className="mt-4 grid gap-2.5">
        {funnel.map((f, i) => (
          <li key={f.k} className="grid gap-1">
            <div className="flex justify-between text-[13px]">
              <span>{f.k}</span>
              <span className="font-mono text-muted tabular">{f.v}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className={cn("h-full rounded-full", i === funnel.length - 1 ? "bg-lime" : "bg-ink/80")} style={{ width: `${f.v}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 rounded-xl bg-violet-soft px-3 py-2 text-[12.5px] text-violet-text">
        <Check className="size-3.5" /> Biggest gap: SQL. 61 students nudged this week.
      </p>
    </div>
  );
}
