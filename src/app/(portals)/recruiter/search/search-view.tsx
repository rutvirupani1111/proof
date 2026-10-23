"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  ArrowUpDown,
  BookmarkPlus,
  Check,
  GitCompare,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { SearchFiltersInput, SearchSort } from "@/lib/validation/recruiter";
import { deleteSavedSearchAction, saveSearchAction } from "@/server/recruiter/actions";
import { searchCandidatesAction } from "@/server/search/actions";
import type { CandidateHit, SearchFacets, SearchResult } from "@/server/search/engine";
import { EvidenceFacts } from "../_components/evidence-facts";
import { ScoreRing } from "../_components/score-ring";

type Saved = { id: string; name: string; filters: SearchFiltersInput; createdAt: string };

const SORT_LABEL: Record<SearchSort, string> = {
  score: "Proof Score",
  relevance: "Text relevance",
  skill: "Skill match",
  commits: "Own commits",
  deployments: "Live apps",
};
const COMMIT_STEPS = [0, 25, 50, 100, 200];

function activeCount(f: SearchFiltersInput): number {
  return (
    (f.skills?.length ?? 0) +
    (f.minScore ? 1 : 0) +
    (f.hasDeployment ? 1 : 0) +
    (f.minOwnCommits ? 1 : 0) +
    (f.passedCheck ? 1 : 0) +
    (f.mentorEndorsed ? 1 : 0) +
    (f.collegeIds?.length ?? 0) +
    (f.graduationYears?.length ?? 0) +
    (f.location ? 1 : 0)
  );
}

function toggle<T>(list: T[] | undefined, v: T): T[] | undefined {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
}

export function SearchView({
  facets,
  initial,
  saved: initialSaved,
  canSave,
}: {
  facets: SearchFacets;
  initial: SearchResult;
  saved: Saved[];
  canSave: boolean;
}) {
  const [filters, setFilters] = useState<SearchFiltersInput>(initial.filters);
  const [result, setResult] = useState<SearchResult>(initial);
  const [pending, startTransition] = useTransition();
  const [compare, setCompare] = useState<CandidateHit[]>([]);
  const [saved, setSaved] = useState(initialSaved);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const reqId = useRef(0);
  const first = useRef(true);

  const patch = useCallback((p: Partial<SearchFiltersInput>) => setFilters((f) => ({ ...f, ...p })), []);

  // Re-run the search whenever filters settle (debounced for typing). Stale responses are dropped.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const id = ++reqId.current;
      const qs = activeCount(filters) || filters.q || filters.sort ? `?f=${encodeURIComponent(JSON.stringify(filters))}` : "";
      window.history.replaceState(null, "", `/recruiter/search${qs}`);
      startTransition(async () => {
        const res = await searchCandidatesAction(filters);
        if (id !== reqId.current) return;
        if (res.ok) setResult(res.data);
        else toast.error(res.error);
      });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [filters]);

  const collegeName = useMemo(() => new Map(facets.colleges.map((c) => [c.id, c.shortName])), [facets.colleges]);
  const skillName = useMemo(() => new Map(facets.skills.map((s) => [s.slug, s.name])), [facets.skills]);
  const count = activeCount(filters);
  const sort: SearchSort = filters.sort ?? (filters.q ? "relevance" : filters.skills?.length ? "skill" : "score");

  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(filters.skills ?? []).map((s) => ({ key: `s-${s}`, label: skillName.get(s) ?? s, clear: () => patch({ skills: toggle(filters.skills, s) }) })),
    ...(filters.minScore ? [{ key: "min", label: `Score ${filters.minScore}+`, clear: () => patch({ minScore: undefined }) }] : []),
    ...(filters.hasDeployment ? [{ key: "dep", label: "Live app", clear: () => patch({ hasDeployment: undefined }) }] : []),
    ...(filters.minOwnCommits ? [{ key: "com", label: `${filters.minOwnCommits}+ own commits`, clear: () => patch({ minOwnCommits: undefined }) }] : []),
    ...(filters.passedCheck ? [{ key: "chk", label: "Passed a check", clear: () => patch({ passedCheck: undefined }) }] : []),
    ...(filters.mentorEndorsed ? [{ key: "end", label: "Mentor-endorsed", clear: () => patch({ mentorEndorsed: undefined }) }] : []),
    ...(filters.collegeIds ?? []).map((c) => ({ key: `c-${c}`, label: collegeName.get(c) ?? "College", clear: () => patch({ collegeIds: toggle(filters.collegeIds, c) }) })),
    ...(filters.graduationYears ?? []).map((y) => ({ key: `y-${y}`, label: `Class of ${y}`, clear: () => patch({ graduationYears: toggle(filters.graduationYears, y) }) })),
    ...(filters.location ? [{ key: "loc", label: filters.location, clear: () => patch({ location: undefined }) }] : []),
  ];

  const toggleCompare = (hit: CandidateHit) =>
    setCompare((c) => {
      if (c.some((x) => x.userId === hit.userId)) return c.filter((x) => x.userId !== hit.userId);
      if (c.length >= 3) {
        toast("Compare holds three candidates", { description: "Remove one to add another." });
        return c;
      }
      return [...c, hit];
    });

  const rail = <FilterRail facets={facets} filters={filters} patch={patch} />;

  return (
    <div className="lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1 pb-6">{rail}</div>
      </aside>

      <section aria-label="Results" className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search profiles</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input
              type="search"
              value={filters.q ?? ""}
              onChange={(e) => patch({ q: e.target.value || undefined })}
              placeholder="Search names, headlines, repos: “offline sync”, “payments”…"
              className="h-11 pl-10"
            />
            {pending && <LoaderCircle className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-subtle" aria-hidden />}
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-11 lg:hidden" onClick={() => setSheetOpen(true)}>
              <SlidersHorizontal /> Filters
              {count > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-lime font-mono text-[11px] text-lime-ink">{count}</span>
              )}
            </Button>
            <Select value={sort} onValueChange={(v) => patch({ sort: v as SearchSort })}>
              <SelectTrigger className="h-11 w-auto min-w-40" aria-label="Sort by">
                <ArrowUpDown className="size-4 text-subtle" aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SearchSort[]).map((s) => (
                  <SelectItem key={s} value={s} disabled={(s === "relevance" && !filters.q) || (s === "skill" && !filters.skills?.length)}>
                    {SORT_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(saved.length > 0 || canSave) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] tracking-wider text-subtle uppercase">Saved</span>
            {saved.map((s) => (
              <span key={s.id} className="group inline-flex items-center overflow-hidden rounded-full border border-line bg-surface text-xs">
                <button type="button" className="px-3 py-1.5 hover:bg-surface-2" onClick={() => setFilters(s.filters)}>
                  {s.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete saved search ${s.name}`}
                  className="border-l border-line px-2 py-1.5 text-subtle hover:bg-coral-soft hover:text-coral-text"
                  onClick={async () => {
                    const res = await deleteSavedSearchAction(s.id);
                    if (res.ok) setSaved((all) => all.filter((x) => x.id !== s.id));
                    else toast.error(res.error);
                  }}
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
            {canSave && (
              <Button size="sm" variant="ghost" onClick={() => setSaveOpen(true)} disabled={!count && !filters.q}>
                <BookmarkPlus /> Save this search
              </Button>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {chips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Active filters">
                {chips.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={c.clear}
                      className="inline-flex items-center gap-1 rounded-full border border-verified/30 bg-verified-soft px-2.5 py-1 text-xs font-medium text-verified hover:border-verified/60"
                    >
                      {c.label}
                      <X className="size-3" aria-hidden />
                      <span className="sr-only">Remove filter</span>
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" onClick={() => setFilters({ q: filters.q })} className="px-2 py-1 text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
                    Clear all
                  </button>
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5 mb-3 flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            <span className="font-display text-lg font-semibold text-ink tabular">{result.total}</span>{" "}
            {result.total === 1 ? "candidate" : "candidates"} with matching evidence
            {result.total > result.hits.length && <span className="text-subtle"> · top {result.hits.length}</span>}
          </p>
          <span className="hidden font-mono text-[11px] text-subtle sm:inline">sorted by {SORT_LABEL[sort].toLowerCase()}</span>
        </div>

        {result.hits.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No evidence matches every filter"
            description="Loosen one constraint (the minimum score or own-commit bar is usually the strictest) and results will flow back in."
            action={
              <Button variant="secondary" onClick={() => setFilters({})}>
                <RotateCcw /> Reset filters
              </Button>
            }
          />
        ) : (
          <LayoutGroup>
            <motion.ul className={cn("grid gap-3 transition-opacity", pending && "opacity-70")} aria-busy={pending}>
              <AnimatePresence mode="popLayout" initial={false}>
                {result.hits.map((hit, i) => (
                  <motion.li
                    key={hit.userId}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                    transition={{ ...springs.layout, delay: Math.min(i, 8) * 0.015 }}
                  >
                    <CandidateRow
                      hit={hit}
                      wanted={filters.skills}
                      selected={compare.some((c) => c.userId === hit.userId)}
                      onCompare={() => toggleCompare(hit)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          </LayoutGroup>
        )}
      </section>

      <CompareTray people={compare} onClear={() => setCompare([])} onRemove={toggleCompare} />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[min(24rem,92vw)]">
          <div className="border-b border-line px-5 py-4">
            <SheetTitle className="font-display text-lg font-semibold">Filters</SheetTitle>
            <SheetDescription className="text-sm text-muted">
              {result.total} {result.total === 1 ? "match" : "matches"} right now
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{rail}</div>
          <div className="border-t border-line p-4">
            <Button className="w-full" onClick={() => setSheetOpen(false)}>
              Show {result.total} {result.total === 1 ? "candidate" : "candidates"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <SaveSearchDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        filters={filters}
        onSaved={(s) => setSaved((all) => [s, ...all])}
      />
    </div>
  );
}

function CandidateRow({
  hit,
  wanted,
  selected,
  onCompare,
}: {
  hit: CandidateHit;
  wanted?: string[];
  selected: boolean;
  onCompare: () => void;
}) {
  const want = new Set(wanted ?? []);
  return (
    <article
      className={cn(
        "group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-[var(--radius-card)] border bg-surface p-4 shadow-card transition-[border-color,box-shadow] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-5",
        selected ? "border-violet/60 ring-2 ring-violet/20" : "border-line hover:border-line-strong hover:shadow-pop",
      )}
    >
      <ScoreRing score={hit.proofScore} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display text-base font-semibold">
            <Link href={`/recruiter/candidates/${hit.userId}`} className="after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none">
              {hit.name}
            </Link>
          </h3>
          {hit.openToWork && <Badge variant="violet">Open to work</Badge>}
          {hit.skillMatch > 0 && (
            <Badge variant="verified" mono>
              match {hit.skillMatch}
            </Badge>
          )}
        </div>
        {hit.headline && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{hit.headline}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
          {hit.collegeName && <span>{hit.collegeName}</span>}
          {hit.graduationYear && <span className="font-mono">’{String(hit.graduationYear).slice(2)}</span>}
          {hit.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="size-3" aria-hidden />
              {hit.location}
            </span>
          )}
        </p>
      </div>
      <div className="relative z-10 col-span-2 flex items-center gap-2 sm:col-span-1 sm:row-span-2 sm:flex-col sm:items-end sm:justify-between">
        <button
          type="button"
          onClick={onCompare}
          aria-pressed={selected}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
            selected ? "border-violet bg-violet text-white" : "border-line-strong text-muted hover:bg-surface-2 hover:text-ink",
          )}
        >
          {selected ? <Check className="size-3.5" /> : <GitCompare className="size-3.5" />}
          {selected ? "In compare" : "Compare"}
        </button>
      </div>
      <div className="col-span-2 grid gap-2.5 sm:col-start-2 sm:col-end-3">
        {hit.skills.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Verified skills">
            {hit.skills.map((s) => (
              <li
                key={s.slug}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs",
                  want.has(s.slug) ? "border-verified/40 bg-verified-soft text-verified" : "border-line bg-surface-2 text-ink",
                )}
              >
                {s.name}
                <span className="font-mono text-[11px] opacity-70 tabular">{s.score}</span>
              </li>
            ))}
          </ul>
        )}
        <EvidenceFacts facts={hit} />
      </div>
    </article>
  );
}

function FilterRail({
  facets,
  filters,
  patch,
}: {
  facets: SearchFacets;
  filters: SearchFiltersInput;
  patch: (p: Partial<SearchFiltersInput>) => void;
}) {
  const uid = useId();
  const [showAllSkills, setShowAllSkills] = useState(false);
  const skills = showAllSkills ? facets.skills : facets.skills.slice(0, 14);
  return (
    <div className="grid gap-6">
      <FilterGroup title="Verified skills">
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => {
            const on = filters.skills?.includes(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                aria-pressed={!!on}
                onClick={() => patch({ skills: toggle(filters.skills, s.slug) })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on ? "border-verified/50 bg-verified-soft font-medium text-verified" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {on && <Check className="size-3" aria-hidden />}
                {s.name}
                <span className="font-mono text-[10px] opacity-60">{s.count}</span>
              </button>
            );
          })}
        </div>
        {facets.skills.length > 14 && (
          <button type="button" className="mt-2 text-xs text-violet-text hover:underline" onClick={() => setShowAllSkills((v) => !v)}>
            {showAllSkills ? "Fewer skills" : `All ${facets.skills.length} skills`}
          </button>
        )}
      </FilterGroup>

      <FilterGroup title="Minimum Proof Score" aside={<span className="font-mono text-xs text-ink tabular">{filters.minScore ?? 0}+</span>}>
        <input
          type="range"
          min={0}
          max={95}
          step={5}
          value={filters.minScore ?? 0}
          onChange={(e) => patch({ minScore: Number(e.target.value) || undefined })}
          aria-label="Minimum Proof Score"
          className="w-full accent-[var(--lime)]"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-subtle">
          <span>0</span>
          <span>40</span>
          <span>70 ready</span>
          <span>95</span>
        </div>
      </FilterGroup>

      <FilterGroup title="Evidence">
        <div className="grid gap-2">
          <Toggle label="Has a live deployment" checked={!!filters.hasDeployment} onChange={(v) => patch({ hasDeployment: v || undefined })} />
          <Toggle label="Passed a skill check" checked={!!filters.passedCheck} onChange={(v) => patch({ passedCheck: v || undefined })} />
          <Toggle label="Endorsed by a verified mentor" checked={!!filters.mentorEndorsed} onChange={(v) => patch({ mentorEndorsed: v || undefined })} />
        </div>
      </FilterGroup>

      <FilterGroup title="Own commits (verified repos)">
        <div className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Minimum own commits">
          {COMMIT_STEPS.map((n) => {
            const on = (filters.minOwnCommits ?? 0) === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => patch({ minOwnCommits: n || undefined })}
                className={cn("rounded-lg py-1.5 font-mono text-xs transition-colors", on ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}
              >
                {n === 0 ? "Any" : `${n}+`}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="College">
        <div className="grid gap-1.5">
          {facets.colleges.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--violet)]"
                checked={!!filters.collegeIds?.includes(c.id)}
                onChange={() => patch({ collegeIds: toggle(filters.collegeIds, c.id) })}
              />
              <span className="min-w-0">
                <span className="block leading-tight">{c.shortName}</span>
                <span className="block text-xs text-subtle">{c.city}</span>
              </span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Graduation year">
        <div className="flex flex-wrap gap-1.5">
          {facets.years.map((y) => {
            const on = filters.graduationYears?.includes(y);
            return (
              <button
                key={y}
                type="button"
                aria-pressed={!!on}
                onClick={() => patch({ graduationYears: toggle(filters.graduationYears, y) })}
                className={cn(
                  "rounded-lg border px-3 py-1 font-mono text-xs transition-colors",
                  on ? "border-violet bg-violet-soft text-violet-text" : "border-line text-muted hover:text-ink",
                )}
              >
                {y}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Location">
        <Label htmlFor={`${uid}-loc`} className="sr-only">
          Location
        </Label>
        <Input id={`${uid}-loc`} value={filters.location ?? ""} onChange={(e) => patch({ location: e.target.value || undefined })} placeholder="e.g. Pune" />
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 flex w-full items-center justify-between font-mono text-[11px] tracking-wider text-subtle uppercase">
        {title}
        {aside}
      </legend>
      {children}
    </fieldset>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm transition-colors hover:border-line-strong"
    >
      <span>{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-lime" : "bg-surface-3")}>
        <motion.span
          layout
          transition={springs.snappy}
          className={cn("absolute top-0.5 size-4 rounded-full shadow-sm", checked ? "right-0.5 bg-lime-ink" : "left-0.5 bg-surface")}
        />
      </span>
    </button>
  );
}

function CompareTray({
  people,
  onClear,
  onRemove,
}: {
  people: CandidateHit[];
  onClear: () => void;
  onRemove: (hit: CandidateHit) => void;
}) {
  const ids = people.map((p) => p.userId);
  return (
    <AnimatePresence>
      {ids.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={springs.gentle}
          className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur sm:inset-x-6"
          role="region"
          aria-label="Compare tray"
        >
          <div className="flex items-center gap-3">
            <ul className="flex -space-x-2">
              {people.map((p) => (
                <li key={p.userId}>
                  <button type="button" onClick={() => onRemove(p)} aria-label={`Remove ${p.name} from compare`} className="rounded-full ring-2 ring-surface">
                    <Avatar name={p.name} src={p.image} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="min-w-0 flex-1 truncate text-sm text-muted">
              <span className="font-medium text-ink">{ids.length}</span> of 3 selected
            </p>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
            <Button size="sm" asChild>
              <Link href={`/recruiter/compare?ids=${ids.join(",")}`}>
                <GitCompare /> Compare
              </Link>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SaveSearchDialog({
  open,
  onOpenChange,
  filters,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: SearchFiltersInput;
  onSaved: (s: Saved) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this search</DialogTitle>
          <DialogDescription>Re-run it any time; new evidence flows into the same filters.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveSearchAction({ name, filters });
              if (!res.ok) {
                setError(res.fieldErrors?.name ?? res.error);
                return;
              }
              onSaved({ ...res.data, filters: res.data.filters as SearchFiltersInput });
              toast.success("Search saved");
              setName("");
              setError(undefined);
              onOpenChange(false);
            });
          }}
        >
          <Field label="Name" htmlFor="saved-name" error={error}>
            <Input id="saved-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="React, 70+, live app" autoFocus aria-invalid={!!error} />
          </Field>
          <DialogFooter className="mt-5">
            <Button type="submit" loading={pending}>
              Save search
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
