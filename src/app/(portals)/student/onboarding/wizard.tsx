"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, Check, GraduationCap, Plus, Sparkles, Target } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { springs } from "@/components/motion/transitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  finishOnboarding,
  saveOnboardingCollege,
  saveOnboardingRoles,
  saveOnboardingSkills,
} from "@/server/student/profile-actions";

type College = { id: string; name: string; shortName: string; city: string };
type Skill = { id: string; slug: string; name: string; category: "language" | "framework" | "tooling" | "data" | "concept" };
type Initial = {
  collegeId: string;
  graduationYear: number;
  degree: string;
  branch: string;
  targetRoles: string[];
  skillIds: string[];
};

const STEPS = [
  { key: "college", label: "College", icon: GraduationCap },
  { key: "roles", label: "Roles", icon: Target },
  { key: "skills", label: "Skills", icon: Sparkles },
  { key: "done", label: "Ready", icon: BadgeCheck },
] as const;

const ROLE_SUGGESTIONS = [
  "Frontend engineer",
  "Backend engineer",
  "Full-stack engineer",
  "SDE",
  "Data analyst",
  "ML engineer",
  "DevOps engineer",
  "Mobile developer",
  "QA engineer",
  "Product engineer",
];

const BRANCH_SUGGESTIONS = ["Computer Engineering", "Information Technology", "Electronics & Communication", "AI & Data Science"];

const CATEGORY_LABEL: Record<Skill["category"], string> = {
  language: "Languages",
  framework: "Frameworks",
  data: "Data",
  tooling: "Tooling",
  concept: "Concepts",
};

export function OnboardingWizard({
  firstName,
  initialStep,
  revisiting,
  colleges,
  skills,
  initial,
}: {
  firstName: string;
  initialStep: number;
  revisiting: boolean;
  colleges: College[];
  skills: Skill[];
  initial: Initial;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(initialStep);
  const [dir, setDir] = useState(1);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [collegeId, setCollegeId] = useState(initial.collegeId);
  const [graduationYear, setGraduationYear] = useState(String(initial.graduationYear));
  const [degree, setDegree] = useState(initial.degree);
  const [branch, setBranch] = useState(initial.branch);
  const [roles, setRoles] = useState<string[]>(initial.targetRoles);
  const [customRole, setCustomRole] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>(initial.skillIds);

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(thisYear - 1 + i));
  const college = colleges.find((c) => c.id === collegeId);
  const grouped = useMemo(() => {
    const map = new Map<Skill["category"], Skill[]>();
    for (const s of skills) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return (Object.keys(CATEGORY_LABEL) as Skill["category"][])
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
  }, [skills]);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setErrors({});
    setStep(next);
  };

  const toggleRole = (role: string) =>
    setRoles((r) => (r.includes(role) ? r.filter((x) => x !== role) : r.length >= 6 ? r : [...r, role]));
  const addCustomRole = () => {
    const v = customRole.trim();
    if (v.length < 2) return;
    if (!roles.some((r) => r.toLowerCase() === v.toLowerCase())) toggleRole(v);
    setCustomRole("");
  };
  const toggleSkill = (id: string) =>
    setSkillIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 12 ? s : [...s, id]));

  const next = () => {
    start(async () => {
      let res;
      if (step === 0) res = await saveOnboardingCollege({ collegeId, graduationYear, degree, branch });
      else if (step === 1) res = await saveOnboardingRoles({ targetRoles: roles });
      else if (step === 2) res = await saveOnboardingSkills({ skillIds });
      else {
        res = await finishOnboarding();
        if (res.ok) {
          toast.success("Profile set up. Time to add your first proof.");
          router.push("/student/proofs");
          router.refresh();
          return;
        }
      }
      if (!res.ok) {
        setErrors(res.errors);
        if (res.errors.form) toast.error(res.errors.form);
        return;
      }
      go(step + 1);
    });
  };

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -40 }),
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8">
        <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">
          {revisiting ? "Update your basics" : "Set up · about 2 minutes"}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {step === 3 ? `You are ready, ${firstName}.` : `Let's build your dossier, ${firstName}.`}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-pretty text-muted">
          Recruiters on Proof read evidence, not resumes. Tell us where you study and what you want to prove; the
          proofs come next.
        </p>
      </div>

      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Onboarding progress">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.key} className="grid gap-2" aria-current={current ? "step" : undefined}>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-lime"
                  initial={false}
                  animate={{ width: done ? "100%" : current ? "45%" : "0%" }}
                  transition={springs.gentle}
                />
              </div>
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  current ? "text-ink" : done ? "text-verified" : "text-subtle",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : <s.icon className="size-3.5" aria-hidden />}
                <span className="truncate">{s.label}</span>
                <span className="sr-only">{done ? "(done)" : current ? "(current)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={springs.gentle}
            className="p-5 sm:p-7"
            aria-labelledby={`step-${step}-title`}
          >
            {step === 0 && (
              <div className="grid gap-5">
                <StepTitle id="step-0-title" title="Where do you study?" hint="Your placement cell sees your readiness; nothing else about you changes." />
                <Field label="College" htmlFor="college" error={errors.collegeId}>
                  <Select value={collegeId} onValueChange={setCollegeId}>
                    <SelectTrigger id="college" aria-invalid={!!errors.collegeId}>
                      <SelectValue placeholder="Choose your college" />
                    </SelectTrigger>
                    <SelectContent>
                      {colleges.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Graduation year" htmlFor="grad" error={errors.graduationYear}>
                    <Select value={graduationYear} onValueChange={setGraduationYear}>
                      <SelectTrigger id="grad">
                        <SelectValue placeholder="Choose a year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Degree" htmlFor="degree" error={errors.degree}>
                    <Input id="degree" value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. B.Tech" autoComplete="off" aria-invalid={!!errors.degree} />
                  </Field>
                </div>
                <Field label="Branch" htmlFor="branch" error={errors.branch}>
                  <Input
                    id="branch"
                    list="branch-suggestions"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. Computer Engineering" autoComplete="off"
                    aria-invalid={!!errors.branch}
                  />
                  <datalist id="branch-suggestions">
                    {BRANCH_SUGGESTIONS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-5">
                <StepTitle id="step-1-title" title="Which roles are you aiming for?" hint="Pick up to 6. Jobs and recruiters match on these." />
                <div className="flex flex-wrap gap-2" role="group" aria-label="Role suggestions">
                  {[...new Set([...ROLE_SUGGESTIONS, ...roles])].map((role) => (
                    <Chip key={role} active={roles.includes(role)} onClick={() => toggleRole(role)}>
                      {role}
                    </Chip>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    aria-label="Add a custom role"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomRole();
                      }
                    }}
                    placeholder="Another role, e.g. Game developer"
                  autoComplete="off"
                    maxLength={48}
                  />
                  <Button type="button" variant="secondary" onClick={addCustomRole} disabled={customRole.trim().length < 2}>
                    <Plus aria-hidden />
                    Add
                  </Button>
                </div>
                {errors.targetRoles && (
                  <p role="alert" className="text-xs text-coral-text">
                    {errors.targetRoles}
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-5">
                <StepTitle
                  id="step-2-title"
                  title="What do you want to prove?"
                  hint="Claims start at a score of 0. Each one turns lime only when evidence backs it."
                />
                {grouped.map((g) => (
                  <div key={g.category} className="grid gap-2">
                    <p className="font-mono text-[11px] tracking-wider text-subtle uppercase">{CATEGORY_LABEL[g.category]}</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={CATEGORY_LABEL[g.category]}>
                      {g.items.map((s) => (
                        <Chip key={s.id} active={skillIds.includes(s.id)} onClick={() => toggleSkill(s.id)}>
                          {s.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted tabular">{skillIds.length} of 12 picked</p>
                {errors.skillIds && (
                  <p role="alert" className="text-xs text-coral-text">
                    {errors.skillIds}
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-5">
                <div className="flex items-start gap-4">
                  <motion.span
                    initial={reduce ? false : { scale: 0.4, rotate: -30, opacity: 0 }}
                    animate={{ scale: 1, rotate: -8, opacity: 1 }}
                    transition={springs.stamp}
                    className="grid size-14 shrink-0 place-items-center rounded-full bg-lime text-lime-ink shadow-card"
                  >
                    <SealGlyph className="size-8" />
                  </motion.span>
                  <StepTitle id="step-3-title" title="Your dossier is ready for evidence" hint="Here is what recruiters will see before any proof. Next: connect GitHub, verify a live site or pass a skill check." />
                </div>
                <dl className="grid gap-3 rounded-2xl border border-line bg-surface-2 bg-ledger p-4 text-sm">
                  <SummaryRow label="College" value={college ? college.name : "Not set"} />
                  <SummaryRow label="Graduating" value={`${degree || "Degree"} · ${branch || "Branch"} · ${graduationYear}`} />
                  <SummaryRow
                    label="Roles"
                    value={
                      <span className="flex flex-wrap gap-1.5">
                        {roles.map((r) => (
                          <Badge key={r} variant="violet">
                            {r}
                          </Badge>
                        ))}
                      </span>
                    }
                  />
                  <SummaryRow
                    label="To prove"
                    value={
                      <span className="flex flex-wrap gap-1.5">
                        {skills
                          .filter((s) => skillIds.includes(s.id))
                          .map((s) => (
                            <Badge key={s.id} variant="outline">
                              {s.name}
                            </Badge>
                          ))}
                      </span>
                    }
                  />
                </dl>
              </div>
            )}
          </motion.section>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-7">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || pending}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
          <Button onClick={next} loading={pending}>
            {step === 3 ? "Start proving" : "Continue"}
            {!pending && <ArrowRight aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ id, title, hint }: { id: string; title: string; hint: string }) {
  return (
    <div>
      <h2 id={id} className="font-display text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-pretty text-muted">{hint}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="font-mono text-[11px] tracking-wider text-subtle uppercase sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-ink">{value}</dd>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.95 }}
      transition={springs.snappy}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
        active
          ? "border-verified/40 bg-verified-soft text-verified"
          : "border-line-strong bg-surface text-muted hover:border-ink/30 hover:text-ink",
      )}
    >
      {active ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
      {children}
    </motion.button>
  );
}
