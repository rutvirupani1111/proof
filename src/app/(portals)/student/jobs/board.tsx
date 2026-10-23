"use client";

import { ArrowUpRight, Briefcase, CalendarClock, Check, MapPin, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { BoardJob } from "@/server/student/jobs";
import { applyToJob } from "@/server/student/job-actions";
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, formatDate, formatPay } from "./format";

type TypeFilter = "all" | "full_time" | "internship";
type ModeFilter = "all" | "onsite" | "hybrid" | "remote";
type Sort = "match" | "newest" | "pay";

export function JobsBoard({ jobs, proofScore }: { jobs: BoardJob[]; proofScore: number }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState<Sort>("match");
  const [openId, setOpenId] = useState<string | null>(null);

  const locations = useMemo(() => [...new Set(jobs.map((j) => j.location))].sort(), [jobs]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = jobs.filter((j) => {
      if (type !== "all" && j.employmentType !== type) return false;
      if (mode !== "all" && j.workMode !== mode) return false;
      if (location !== "all" && j.location !== location) return false;
      if (!needle) return true;
      return [j.title, j.company.name, j.location, j.description, ...j.requirements.map((r) => r.label)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return list.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "pay") return (b.salaryMax ?? b.salaryMin ?? 0) / (b.employmentType === "internship" ? 1 : 12) - (a.salaryMax ?? a.salaryMin ?? 0) / (a.employmentType === "internship" ? 1 : 12);
      return b.match - a.match || b.createdAt.localeCompare(a.createdAt);
    });
  }, [jobs, q, type, mode, location, sort]);

  const active = jobs.find((j) => j.id === openId) ?? null;
  const filtered = q || type !== "all" || mode !== "all" || location !== "all";

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-card sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            type="search"
            aria-label="Search jobs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by role, company or skill"
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="size-4 text-subtle" aria-hidden />
          <Segmented
            label="Employment type"
            value={type}
            onChange={setType}
            options={[
              ["all", "All"],
              ["full_time", "Full-time"],
              ["internship", "Internship"],
            ]}
          />
          <Segmented
            label="Work mode"
            value={mode}
            onChange={setMode}
            options={[
              ["all", "Any"],
              ["onsite", "On-site"],
              ["hybrid", "Hybrid"],
              ["remote", "Remote"],
            ]}
          />
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger aria-label="Location" className="h-9 sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger aria-label="Sort" className="h-9 sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="match">Best match</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="pay">Highest pay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted" aria-live="polite">
        <span className="tabular">
          {visible.length} of {jobs.length} open role{jobs.length === 1 ? "" : "s"}
        </span>
        {filtered && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-violet-text hover:underline"
            onClick={() => {
              setQ("");
              setType("all");
              setMode("all");
              setLocation("all");
            }}
          >
            <X className="size-3.5" aria-hidden /> Clear filters
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={jobs.length ? "No roles match these filters" : "No open roles yet"}
          description={jobs.length ? "Loosen a filter or search for a skill instead." : "Companies post roles here as they join Proof."}
        />
      ) : (
        <LayoutGroup>
          <ul className="grid gap-3 md:grid-cols-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((job) => (
                <motion.li
                  key={job.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={springs.layout}
                >
                  <JobCard job={job} onOpen={() => setOpenId(job.id)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </LayoutGroup>
      )}

      <Sheet open={!!active} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-[min(32rem,100vw)] overflow-y-auto">
          {active && <JobDetail key={active.id} job={active} proofScore={proofScore} onDone={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5">
      {options.map(([v, text]) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={cn("relative h-8 rounded-lg px-2.5 text-[13px] font-medium transition-colors", on ? "text-ink" : "text-muted hover:text-ink")}
          >
            {on && <motion.span layoutId={`seg-${label}`} transition={springs.snappy} className="absolute inset-0 rounded-lg border border-line bg-surface shadow-card" />}
            <span className="relative">{text}</span>
          </button>
        );
      })}
    </div>
  );
}

function MatchMeter({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const strong = value >= 75;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${value}% evidence match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={4} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strong ? "var(--lime)" : value >= 40 ? "var(--violet)" : "var(--coral)"}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ ...springs.gentle, delay: 0.1 }}
        />
      </svg>
      <span className="absolute font-mono text-[11px] font-semibold tabular">{value}</span>
    </div>
  );
}

function JobCard({ job, onOpen }: { job: BoardJob; onOpen: () => void }) {
  const pay = formatPay(job.employmentType, job.salaryMin, job.salaryMax);
  const applied = job.application && job.application.stage !== "withdrawn";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Avatar name={job.company.name} size="md" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] leading-snug font-semibold text-balance">{job.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
            <span className="truncate">{job.company.name}</span>
            {job.company.verified && (<><SealGlyph className="size-3.5 shrink-0 text-lime" /><span className="sr-only">Verified company</span></>)}
          </p>
        </div>
        <MatchMeter value={job.match} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{EMPLOYMENT_LABEL[job.employmentType]}</Badge>
        <Badge>
          <MapPin aria-hidden />
          {job.location} · {WORK_MODE_LABEL[job.workMode]}
        </Badge>
        {pay && <Badge mono>{pay}</Badge>}
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Evidence requirements">
        {job.requirements.map((r) => (
          <li
            key={r.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px]",
              r.met ? "border-verified/30 bg-verified-soft text-verified" : "border-line bg-surface-2 text-muted",
            )}
          >
            {r.met ? <Check className="size-3" aria-hidden /> : <span aria-hidden>·</span>}
            {r.label} {r.min}+
            <span className="sr-only">{r.met ? "(met)" : `(you have ${r.have})`}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" aria-hidden />
          {job.applyBy ? `Apply by ${formatDate(job.applyBy)}` : "Rolling"}
        </span>
        {applied ? (
          <Badge variant="verified">Applied</Badge>
        ) : (
          <span className="inline-flex items-center gap-0.5 font-medium text-violet-text group-hover:underline">
            View & apply <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
    </button>
  );
}

function JobDetail({ job, proofScore, onDone }: { job: BoardJob; proofScore: number; onDone: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pay = formatPay(job.employmentType, job.salaryMin, job.salaryMax);
  const applied = job.application && job.application.stage !== "withdrawn";
  const met = job.requirements.filter((r) => r.met).length;

  const apply = () =>
    start(async () => {
      const res = await applyToJob({ jobId: job.id, coverNote: note || undefined });
      if (!res.ok) {
        const msg = res.errors.coverNote ?? res.errors.form ?? "Could not apply.";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`Applied to ${job.company.name}`, { description: "Track it under Applications." });
      router.refresh();
      onDone();
    });

  return (
    <div className="flex flex-col gap-6 p-5 pt-6 sm:p-6">
      <div className="flex items-start gap-3 pr-8">
        <Avatar name={job.company.name} size="lg" className="rounded-2xl" />
        <div className="min-w-0">
          <SheetTitle className="font-display text-xl leading-tight font-semibold text-balance">{job.title}</SheetTitle>
          <SheetDescription className="mt-1 flex items-center gap-1 text-sm text-muted">
            {job.company.name}
            {job.company.verified && (<><SealGlyph className="size-3.5 text-lime" /><span className="sr-only">Verified company</span></>)}
            {job.company.industry && <span>· {job.company.industry}</span>}
          </SheetDescription>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Fact label="Type" value={EMPLOYMENT_LABEL[job.employmentType]} />
        <Fact label="Where" value={`${job.location} · ${WORK_MODE_LABEL[job.workMode]}`} />
        <Fact label={job.employmentType === "internship" ? "Stipend" : "CTC"} value={pay ?? "Not disclosed"} />
        <Fact label="Openings" value={<span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{job.openings}</span>} />
      </dl>

      <section aria-labelledby="req-title" className="rounded-2xl border border-line bg-surface-2 bg-ledger p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 id="req-title" className="font-display text-sm font-semibold">
              Evidence match
            </h3>
            <p className="text-xs text-muted">
              {met} of {job.requirements.length} met · your Proof Score is {proofScore}
            </p>
          </div>
          <MatchMeter value={job.match} size={52} />
        </div>
        <ul className="grid gap-2.5">
          {job.requirements.map((r) => (
            <li key={r.label} className="grid gap-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-medium">
                  {r.met ? <SealGlyph className="size-3.5 text-lime" /> : <span className="size-3.5 rounded-full border border-line-strong" aria-hidden />}
                  {r.label}
                </span>
                <span className="font-mono text-xs text-muted tabular">
                  {r.have} / {r.min}
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className={cn("absolute inset-y-0 left-0 rounded-full", r.met ? "bg-lime" : "bg-violet")}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, r.min ? (r.have / r.min) * 100 : 100)}%` }}
                  transition={springs.gentle}
                />
              </div>
            </li>
          ))}
        </ul>
        {met < job.requirements.length && (
          <p className="mt-3 text-xs text-muted">
            Short on a skill? <Link href="/student/proofs" className="text-violet-text hover:underline">Add evidence</Link> and your match updates. You can still apply now.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-1.5 font-display text-sm font-semibold">About the role</h3>
        <p className="text-sm leading-relaxed text-pretty text-muted">{job.description}</p>
        {job.applyBy && <p className="mt-2 text-xs text-subtle">Applications close {formatDate(job.applyBy)}.</p>}
      </section>

      {applied ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-verified/40 bg-verified-soft p-4">
          <span className="flex items-center gap-2 text-sm font-medium text-verified">
            <SealGlyph className="size-4" /> You applied
          </span>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/student/applications">Track it</Link>
          </Button>
        </div>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <Field label="Cover note (optional)" htmlFor="cover" error={error ?? undefined} hint={`${note.length}/1000 · your evidence is attached automatically`}>
            <Textarea id="cover" rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="One or two lines on why this role, and which proof to look at first." />
          </Field>
          <Button type="submit" size="lg" loading={pending}>
            Apply with my evidence
          </Button>
        </form>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <dt className="font-mono text-[10px] tracking-wider text-subtle uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
