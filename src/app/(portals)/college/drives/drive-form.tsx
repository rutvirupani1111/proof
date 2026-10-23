"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createDriveAction } from "@/server/college/actions";

type Facets = { branches: string[]; years: number[]; skills: { slug: string; name: string }[] };

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function NewDriveButton({ facets }: { facets: Facets }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [form, setForm] = useState({ companyName: "", title: "", scheduledAt: "", location: "" });
  const [minScore, setMinScore] = useState(50);
  const [years, setYears] = useState<number[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Schedule a drive
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule a drive</DialogTitle>
          <DialogDescription>Eligible students are computed from verified evidence and notified as soon as you save.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createDriveAction({
                ...form,
                location: form.location || undefined,
                eligibility: {
                  minProofScore: minScore || undefined,
                  graduationYears: years.length ? years : undefined,
                  branches: branches.length ? branches : undefined,
                  skills: skills.length ? skills : undefined,
                },
              });
              if (!res.ok) return setErrors(res.fieldErrors ?? { companyName: res.error });
              toast.success(`Drive scheduled. ${res.data.eligible} eligible student${res.data.eligible === 1 ? "" : "s"} notified.`);
              setOpen(false);
              router.push(`/college/drives/${res.data.id}`);
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company" htmlFor="d-company" error={errors.companyName}>
              <Input id="d-company" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} aria-invalid={!!errors.companyName} />
            </Field>
            <Field label="Date" htmlFor="d-date" error={errors.scheduledAt}>
              <Input id="d-date" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} aria-invalid={!!errors.scheduledAt} />
            </Field>
            <Field label="Title" htmlFor="d-title" error={errors.title}>
              <Input id="d-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="SDE campus drive" aria-invalid={!!errors.title} />
            </Field>
            <Field label="Location" htmlFor="d-loc">
              <Input id="d-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Seminar Hall 2 / Online" />
            </Field>
          </div>
          <fieldset className="grid gap-3 rounded-xl border border-line bg-surface-2/50 p-4">
            <legend className="px-1 font-mono text-[11px] tracking-wider text-subtle uppercase">Eligibility</legend>
            <label className="grid gap-1.5 text-sm">
              <span className="flex justify-between">
                Minimum Proof Score <span className="font-mono">{minScore}+</span>
              </span>
              <input type="range" min={0} max={95} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="accent-[var(--lime)]" />
            </label>
            <Chips label="Graduation year" options={facets.years.map((y) => ({ value: y, label: String(y) }))} value={years} onToggle={(v) => setYears((l) => toggle(l, v))} />
            {facets.branches.length > 0 && (
              <Chips label="Branch" options={facets.branches.map((b) => ({ value: b, label: b }))} value={branches} onToggle={(v) => setBranches((l) => toggle(l, v))} />
            )}
            <Chips
              label="Verified skills (all required)"
              options={facets.skills.slice(0, 18).map((s) => ({ value: s.slug, label: s.name }))}
              value={skills}
              onToggle={(v) => setSkills((l) => toggle(l, v))}
            />
          </fieldset>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              Schedule & notify
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Chips<T extends string | number>({
  label,
  options,
  value,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                on ? "border-verified/50 bg-verified-soft font-medium text-verified" : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {on && <Check className="size-3" aria-hidden />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
