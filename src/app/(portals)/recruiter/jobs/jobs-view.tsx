"use client";

import { AnimatePresence, motion } from "motion/react";
import { Briefcase, KanbanSquare, MapPin, Pencil, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn, formatLpa, formatNumber, timeAgo } from "@/lib/utils";
import { JOB_TYPES, JOB_WORK_MODES } from "@/lib/validation/recruiter";
import { JobMatchCounter } from "@/components/recruiter/job-match-counter";
import { closeJobAction, reopenJobAction, saveJobAction } from "@/server/recruiter/actions";

type Job = {
  id: string;
  title: string;
  description: string;
  location: string;
  workMode: (typeof JOB_WORK_MODES)[number];
  employmentType: (typeof JOB_TYPES)[number];
  salaryMin: number | null;
  salaryMax: number | null;
  requiredSkills: { skillSlug: string; minScore: number }[];
  minProofScore: number;
  openings: number;
  status: "draft" | "open" | "closed";
  applicants: number;
  createdAt: string;
};

const TYPE_LABEL = { full_time: "Full-time", internship: "Internship", contract: "Contract" } as const;
const MODE_LABEL = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" } as const;

function pay(j: Pick<Job, "salaryMin" | "salaryMax" | "employmentType">) {
  if (j.salaryMin == null && j.salaryMax == null) return null;
  const f = j.employmentType === "internship" ? (n: number) => `₹${formatNumber(n)}/mo` : formatLpa;
  if (j.salaryMin != null && j.salaryMax != null) return `${f(j.salaryMin)} – ${f(j.salaryMax)}`;
  return f((j.salaryMin ?? j.salaryMax)!);
}

export function JobsView({ jobs: initial, skills }: { jobs: Job[]; skills: { slug: string; name: string }[] }) {
  const [jobs, setJobs] = useState(initial);
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [, start] = useTransition();
  const skillName = new Map(skills.map((s) => [s.slug, s.name]));
  const shown = jobs.filter((j) => (tab === "open" ? j.status !== "closed" : j.status === "closed"));

  const setStatus = (job: Job, status: "open" | "closed") =>
    start(async () => {
      setJobs((all) => all.map((j) => (j.id === job.id ? { ...j, status } : j)));
      const res = status === "closed" ? await closeJobAction(job.id) : await reopenJobAction(job.id);
      if (!res.ok) {
        setJobs((all) => all.map((j) => (j.id === job.id ? job : j)));
        toast.error(res.error);
      } else toast.success(status === "closed" ? "Job closed" : "Job reopened");
    });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Job status">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("relative rounded-lg px-4 py-1.5 text-sm capitalize", tab === t ? "text-ink" : "text-muted hover:text-ink")}
            >
              {tab === t && <motion.span layoutId="job-tab" transition={springs.snappy} className="absolute inset-0 rounded-lg bg-surface shadow-card" />}
              <span className="relative">
                {t} <span className="font-mono text-xs text-subtle">{jobs.filter((j) => (t === "open" ? j.status !== "closed" : j.status === "closed")).length}</span>
              </span>
            </button>
          ))}
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus /> Post a job
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Briefcase} title={tab === "open" ? "No open roles" : "Nothing closed yet"} description="Post a role with the verified skills it needs; candidates who meet the bar can apply." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((j) => (
              <motion.li key={j.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={springs.gentle}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-semibold">{j.title}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden /> {j.location}
                        </span>
                        <span>{MODE_LABEL[j.workMode]}</span>
                        <span>{TYPE_LABEL[j.employmentType]}</span>
                      </p>
                    </div>
                    {j.status === "draft" ? <Badge>Draft</Badge> : j.status === "closed" ? <Badge variant="coral">Closed</Badge> : <Badge variant="verified">Open</Badge>}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    <li className="rounded-md bg-lime px-2 py-0.5 font-mono text-[11px] font-semibold text-lime-ink">Score {j.minProofScore}+</li>
                    {j.requiredSkills.map((r) => (
                      <li key={r.skillSlug} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs">
                        {skillName.get(r.skillSlug) ?? r.skillSlug} <span className="font-mono text-subtle">{r.minScore}+</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted">{j.description}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="flex items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden />
                        <span className="font-mono tabular">{j.applicants}</span> applicants
                      </span>
                      {pay(j) && <span className="font-mono">{pay(j)}</span>}
                      <span className="hidden text-subtle sm:inline">{timeAgo(j.createdAt)}</span>
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/recruiter/pipeline?job=${j.id}`} aria-label={`Pipeline for ${j.title}`}>
                          <KanbanSquare />
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(j)} aria-label={`Edit ${j.title}`}>
                        <Pencil />
                      </Button>
                      {j.status === "closed" ? (
                        <Button size="sm" variant="secondary" onClick={() => setStatus(j, "open")}>
                          Reopen
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setStatus(j, "closed")}>
                          <X /> Close
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <JobForm
            key={editing === "new" ? "new" : editing.id}
            job={editing === "new" ? null : editing}
            skills={skills}
            onSaved={(saved) => {
              setJobs((all) => {
                const exists = all.some((j) => j.id === saved.id);
                return exists ? all.map((j) => (j.id === saved.id ? saved : j)) : [saved, ...all];
              });
              setTab(saved.status === "closed" ? "closed" : "open");
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </>
  );
}

function JobForm({ job, skills, onSaved }: { job: Job | null; skills: { slug: string; name: string }[]; onSaved: (j: Job) => void }) {
  const [form, setForm] = useState({
    title: job?.title ?? "",
    description: job?.description ?? "",
    location: job?.location ?? "",
    workMode: job?.workMode ?? "hybrid",
    employmentType: job?.employmentType ?? "full_time",
    salaryMin: job?.salaryMin?.toString() ?? "",
    salaryMax: job?.salaryMax?.toString() ?? "",
    minProofScore: job?.minProofScore ?? 50,
    openings: job?.openings ?? 1,
    requiredSkills: job?.requiredSkills ?? [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [addSkill, setAddSkill] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{job ? "Edit job" : "Post a job"}</DialogTitle>
        <DialogDescription>Required skills are matched against verified per-skill scores, not self-reported lists.</DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const payload = {
              id: job?.id,
              ...form,
              salaryMin: form.salaryMin === "" ? undefined : Number(form.salaryMin),
              salaryMax: form.salaryMax === "" ? undefined : Number(form.salaryMax),
              status: "open" as const,
            };
            const res = await saveJobAction(payload);
            if (!res.ok) return setErrors(res.fieldErrors ?? { title: res.error });
            toast.success(job ? "Job updated" : "Job posted");
            onSaved({
              ...(job ?? { applicants: 0, createdAt: new Date().toISOString() }),
              ...payload,
              id: res.data.id,
              salaryMin: payload.salaryMin ?? null,
              salaryMax: payload.salaryMax ?? null,
              status: job?.status === "closed" ? "closed" : "open",
            } as Job);
          });
        }}
      >
        <Field label="Title" htmlFor="job-title" error={errors.title} className="sm:col-span-2">
          <Input id="job-title" placeholder="e.g. Frontend intern" autoComplete="off" value={form.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} />
        </Field>
        <Field label="Description" htmlFor="job-desc" error={errors.description} className="sm:col-span-2">
          <Textarea id="job-desc" placeholder="What they will build, the stack, and who they work with." value={form.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!errors.description} />
        </Field>
        <Field label="Location" htmlFor="job-loc" error={errors.location}>
          <Input id="job-loc" placeholder="e.g. Bengaluru or Remote" autoComplete="off" value={form.location} onChange={(e) => set("location", e.target.value)} aria-invalid={!!errors.location} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mode" htmlFor="job-mode">
            <Select value={form.workMode} onValueChange={(v) => set("workMode", v as Job["workMode"])}>
              <SelectTrigger id="job-mode">
                <SelectValue placeholder="Choose a work mode" />
              </SelectTrigger>
              <SelectContent>
                {JOB_WORK_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type" htmlFor="job-type">
            <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v as Job["employmentType"])}>
              <SelectTrigger id="job-type">
                <SelectValue placeholder="Choose a role type" />
              </SelectTrigger>
              <SelectContent>
                {JOB_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={form.employmentType === "internship" ? "Stipend min (₹/month)" : "CTC min (₹/year)"} htmlFor="job-min" error={errors.salaryMin} hint="Digits only, in rupees.">
          <Input id="job-min" inputMode="numeric" autoComplete="off" placeholder={form.employmentType === "internship" ? "e.g. 25000" : "e.g. 600000"} value={form.salaryMin} onChange={(e) => set("salaryMin", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={form.employmentType === "internship" ? "Stipend max (₹/month)" : "CTC max (₹/year)"} htmlFor="job-max" error={errors.salaryMax} hint="Digits only, in rupees.">
          <Input id="job-max" inputMode="numeric" autoComplete="off" placeholder={form.employmentType === "internship" ? "e.g. 40000" : "e.g. 1200000"} value={form.salaryMax} onChange={(e) => set("salaryMax", e.target.value.replace(/\D/g, ""))} aria-invalid={!!errors.salaryMax} />
        </Field>
        <Field label={`Minimum Proof Score: ${form.minProofScore}`} htmlFor="job-score">
          <input id="job-score" type="range" min={0} max={95} step={5} value={form.minProofScore} onChange={(e) => set("minProofScore", Number(e.target.value))} className="w-full accent-[var(--lime)]" />
        </Field>
        <Field label="Openings" htmlFor="job-openings" error={errors.openings}>
          <Input id="job-openings" type="number" inputMode="numeric" placeholder="e.g. 3" min={1} max={500} value={form.openings} onChange={(e) => set("openings", Number(e.target.value))} />
        </Field>
        <div className="grid gap-2 sm:col-span-2">
          <span className="text-[13px] font-medium">Required verified skills</span>
          {/* Phones: one full-width row per skill (name, compact min box, remove). sm+: inline chips. */}
          <ul className="grid gap-2 sm:flex sm:flex-wrap">
            {form.requiredSkills.map((r, i) => {
              const name = skills.find((s) => s.slug === r.skillSlug)?.name ?? r.skillSlug;
              return (
                <li
                  key={r.skillSlug}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3 text-sm sm:inline-flex sm:pl-2.5"
                >
                  <span className="min-w-0 flex-1 truncate sm:flex-none">{name}</span>
                  <label className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-subtle">
                    <span aria-hidden>min</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      placeholder="50"
                      value={r.minScore}
                      aria-label={`Minimum ${name} score`}
                      onChange={(e) =>
                        set(
                          "requiredSkills",
                          form.requiredSkills.map((x, j) =>
                            j === i ? { ...x, minScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x,
                          ),
                        )
                      }
                      className="h-8 min-h-0 w-12 min-w-0 rounded-md border border-line bg-surface px-1 text-center font-mono text-[13px] text-ink sm:h-6 sm:w-11 sm:text-xs"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => set("requiredSkills", form.requiredSkills.filter((_, j) => j !== i))}
                    className="grid size-8 min-h-0 min-w-0 shrink-0 place-items-center rounded text-subtle hover:text-coral-text sm:size-6"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          {form.requiredSkills.length < 8 && (
            <Select
              value={addSkill}
              onValueChange={(v) => {
                setAddSkill("");
                if (!form.requiredSkills.some((r) => r.skillSlug === v)) set("requiredSkills", [...form.requiredSkills, { skillSlug: v, minScore: 50 }]);
              }}
            >
              <SelectTrigger aria-label="Add a required skill" className="sm:w-64">
                <SelectValue placeholder="+ Add a skill" />
              </SelectTrigger>
              <SelectContent>
                {skills
                  .filter((s) => !form.requiredSkills.some((r) => r.skillSlug === s.slug))
                  .map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="sm:col-span-2">
          <JobMatchCounter skills={form.requiredSkills} minScore={form.minProofScore} />
        </div>
        <DialogFooter className="sm:col-span-2">
          <Button type="submit" loading={pending}>
            {job ? "Save changes" : "Publish job"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
