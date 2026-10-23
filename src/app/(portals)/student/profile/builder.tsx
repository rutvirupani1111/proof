"use client";

import {
  ArrowDown,
  ArrowUp,
  Building2,
  Code2,
  EyeOff,
  GitBranch,
  Globe,
  MapPin,
  Pin,
  PinOff,
  Plus,
  Save,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Accent } from "@/lib/validation/student";
import { saveProfile } from "@/server/student/profile-actions";

type Visibility = "public" | "recruiters" | "hidden";
type EvidenceKind = "github_ownership" | "repo_authorship" | "deployment" | "skill_check" | "attestation";
type EvidenceRow = {
  id: string;
  kind: EvidenceKind;
  title: string;
  summary: string | null;
  skillSlugs: string[];
  verifiedAt: string | null;
};
type FormState = {
  headline: string;
  about: string;
  location: string;
  targetRoles: string[];
  openToWork: boolean;
  accentColor: Accent;
  visibility: Visibility;
  pinnedEvidenceIds: string[];
};

const ACCENT_STYLES: Record<Accent, { label: string; swatch: string; band: string }> = {
  lime: { label: "Verified lime", swatch: "bg-lime", band: "bg-lime text-lime-ink" },
  violet: { label: "Violet", swatch: "bg-violet", band: "bg-violet text-white" },
  coral: { label: "Signal coral", swatch: "bg-coral", band: "bg-coral text-white" },
  ink: { label: "Ink", swatch: "bg-ink", band: "bg-ink text-canvas" },
};

const VISIBILITY: Record<Visibility, { label: string; icon: LucideIcon; copy: string }> = {
  public: {
    label: "Public",
    icon: Globe,
    copy: "Anyone with the link sees your dossier at /u/handle. Recruiters can find you in search.",
  },
  recruiters: {
    label: "Recruiters only",
    icon: Building2,
    copy: "Only signed-in recruiters from verified companies and your placement cell. The public link shows nothing.",
  },
  hidden: {
    label: "Hidden",
    icon: EyeOff,
    copy: "Nobody can find or open your profile. Jobs you apply to still see what you send them.",
  },
};

const KIND_ICON: Record<EvidenceKind, LucideIcon> = {
  github_ownership: GitBranch,
  repo_authorship: Code2,
  deployment: Globe,
  skill_check: Code2,
  attestation: Users,
};

export function ProfileBuilder({
  name,
  image,
  handle,
  college,
  graduationYear,
  proofScore,
  topSkills,
  evidence,
  initial,
}: {
  name: string;
  image: string | null;
  handle: string;
  college: string | null;
  graduationYear: number | null;
  proofScore: number;
  topSkills: { name: string; slug: string; score: number }[];
  evidence: EvidenceRow[];
  initial: FormState;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [saved, setSaved] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [roleDraft, setRoleDraft] = useState("");
  const [pending, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const pinned = form.pinnedEvidenceIds.map((id) => evidence.find((e) => e.id === id)).filter((e): e is EvidenceRow => !!e);

  const togglePin = (id: string) =>
    setForm((f) => {
      if (f.pinnedEvidenceIds.includes(id)) return { ...f, pinnedEvidenceIds: f.pinnedEvidenceIds.filter((x) => x !== id) };
      if (f.pinnedEvidenceIds.length >= 3) {
        toast.message("Pin up to 3 pieces of evidence. Unpin one first.");
        return f;
      }
      return { ...f, pinnedEvidenceIds: [...f.pinnedEvidenceIds, id] };
    });
  const move = (index: number, delta: -1 | 1) =>
    setForm((f) => {
      const ids = [...f.pinnedEvidenceIds];
      const target = index + delta;
      if (target < 0 || target >= ids.length) return f;
      [ids[index], ids[target]] = [ids[target]!, ids[index]!];
      return { ...f, pinnedEvidenceIds: ids };
    });
  const addRole = () => {
    const v = roleDraft.trim();
    if (v.length < 2 || form.targetRoles.length >= 6) return;
    if (!form.targetRoles.some((r) => r.toLowerCase() === v.toLowerCase())) set("targetRoles", [...form.targetRoles, v]);
    setRoleDraft("");
  };

  const onSave = () =>
    start(async () => {
      const res = await saveProfile(form);
      if (!res.ok) {
        setErrors(res.errors);
        toast.error(res.errors.form ?? Object.values(res.errors)[0] ?? "Could not save your profile.");
        return;
      }
      setErrors({});
      setSaved(form);
      toast.success("Profile saved");
      router.refresh();
    });

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0">
      <div className="grid min-w-0 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>Short and specific beats long and generic. Your evidence does the rest.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Headline" htmlFor="headline" error={errors.headline} hint={`${form.headline.length}/120`}>
              <Input
                id="headline"
                value={form.headline}
                maxLength={120}
                onChange={(e) => set("headline", e.target.value)}
                placeholder="Full-stack builder: Node, Postgres and React"
              />
            </Field>
            <Field label="About" htmlFor="about" error={errors.about} hint={`${form.about.length}/1200`}>
              <Textarea
                id="about"
                rows={5}
                maxLength={1200}
                value={form.about}
                onChange={(e) => set("about", e.target.value)}
                placeholder="What you build, what you are learning, what you want to work on next."
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location" htmlFor="location" error={errors.location}>
                <Input id="location" value={form.location} maxLength={80} onChange={(e) => set("location", e.target.value)} placeholder="Surat" />
              </Field>
              <div className="grid gap-1.5">
                <span className="text-[13px] font-medium" id="otw-label">
                  Open to work
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.openToWork}
                  aria-labelledby="otw-label"
                  onClick={() => set("openToWork", !form.openToWork)}
                  className="flex h-10 items-center gap-3 rounded-xl border border-line-strong bg-surface px-3 text-left text-sm"
                >
                  <span
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      form.openToWork ? "bg-lime" : "bg-surface-3",
                    )}
                  >
                    <motion.span
                      className="absolute top-0.5 size-4 rounded-full bg-surface shadow-card"
                      animate={{ left: form.openToWork ? 18 : 2 }}
                      transition={springs.snappy}
                    />
                  </span>
                  <span className="text-muted">{form.openToWork ? "Recruiters see an open-to-work tag" : "Not looking right now"}</span>
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <span className="text-[13px] font-medium">Target roles</span>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence initial={false}>
                  {form.targetRoles.map((r) => (
                    <motion.span
                      key={r}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={springs.snappy}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-violet/25 bg-violet-soft pr-1 pl-3 text-[13px] font-medium text-violet-text"
                    >
                      {r}
                      <button
                        type="button"
                        onClick={() => set("targetRoles", form.targetRoles.filter((x) => x !== r))}
                        className="grid size-6 place-items-center rounded-full hover:bg-violet/15"
                        aria-label={`Remove ${r}`}
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="Add a target role"
                  value={roleDraft}
                  maxLength={48}
                  onChange={(e) => setRoleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRole();
                    }
                  }}
                  placeholder={form.targetRoles.length >= 6 ? "Up to 6 roles" : "Add a role"}
                  disabled={form.targetRoles.length >= 6}
                />
                <Button type="button" variant="secondary" onClick={addRole} disabled={roleDraft.trim().length < 2 || form.targetRoles.length >= 6}>
                  <Plus aria-hidden />
                  Add
                </Button>
              </div>
              {errors.targetRoles && <p role="alert" className="text-xs text-coral-text">{errors.targetRoles}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pinned evidence</CardTitle>
            <CardDescription>Up to 3 verified items shown first on your dossier, in this order.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {evidence.length === 0 ? (
              <EmptyState
                icon={Pin}
                title="Nothing to pin yet"
                description="Verified evidence appears here once you connect GitHub, verify a deployment or pass a skill check."
                action={
                  <Button asChild variant="secondary">
                    <Link href="/student/proofs">Add your first proof</Link>
                  </Button>
                }
              />
            ) : (
              <LayoutGroup>
                {pinned.length > 0 && (
                  <ol className="grid gap-2" aria-label="Pinned evidence order">
                    {pinned.map((e, i) => (
                      <motion.li
                        key={e.id}
                        layout
                        layoutId={`pin-${e.id}`}
                        transition={springs.layout}
                        className="flex items-center gap-3 rounded-xl border border-verified/40 bg-verified-soft/60 p-3"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lime font-mono text-xs font-semibold text-lime-ink">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{e.title}</span>
                          {e.summary && <span className="block truncate text-xs text-muted">{e.summary}</span>}
                        </span>
                        <span className="flex shrink-0 items-center">
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.title} up`}>
                            <ArrowUp aria-hidden />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => move(i, 1)} disabled={i === pinned.length - 1} aria-label={`Move ${e.title} down`}>
                            <ArrowDown aria-hidden />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => togglePin(e.id)} aria-label={`Unpin ${e.title}`}>
                            <PinOff aria-hidden />
                          </Button>
                        </span>
                      </motion.li>
                    ))}
                  </ol>
                )}
                <ul className="grid gap-1.5" aria-label="Verified evidence">
                  {evidence
                    .filter((e) => !form.pinnedEvidenceIds.includes(e.id))
                    .map((e) => {
                      const Icon = KIND_ICON[e.kind];
                      return (
                        <motion.li key={e.id} layout layoutId={`pin-${e.id}`} transition={springs.layout}>
                          <button
                            type="button"
                            onClick={() => togglePin(e.id)}
                            className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                          >
                            <Icon className="size-4 shrink-0 text-subtle" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{e.title}</span>
                              {e.summary && <span className="block truncate text-xs text-muted">{e.summary}</span>}
                            </span>
                            <Pin className="size-4 shrink-0 text-subtle" aria-hidden />
                            <span className="sr-only">Pin</span>
                          </button>
                        </motion.li>
                      );
                    })}
                </ul>
              </LayoutGroup>
            )}
            {errors.pinnedEvidenceIds && <p role="alert" className="text-xs text-coral-text">{errors.pinnedEvidenceIds}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Look and privacy</CardTitle>
            <CardDescription>Your accent colours the dossier header. Privacy decides who can open it at all.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-[13px] font-medium">Accent</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
                {(Object.keys(ACCENT_STYLES) as Accent[]).map((key) => {
                  const active = form.accentColor === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set("accentColor", key)}
                      className={cn(
                        "flex h-10 items-center gap-2 rounded-xl border px-3 text-[13px] font-medium transition-colors",
                        active ? "border-ink bg-surface-2 text-ink" : "border-line-strong text-muted hover:text-ink",
                      )}
                    >
                      <span className={cn("size-4 rounded-full ring-1 ring-line-strong", ACCENT_STYLES[key].swatch)} />
                      {ACCENT_STYLES[key].label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-[13px] font-medium">Who can see your profile</legend>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Profile visibility">
                {(Object.keys(VISIBILITY) as Visibility[]).map((key) => {
                  const v = VISIBILITY[key];
                  const active = form.visibility === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set("visibility", key)}
                      className={cn(
                        "relative grid gap-1.5 rounded-xl border p-3 text-left transition-colors",
                        active ? "border-violet bg-violet-soft" : "border-line-strong hover:bg-surface-2",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="visibility-ring"
                          transition={springs.snappy}
                          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-violet/50"
                        />
                      )}
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <v.icon className={cn("size-4", active ? "text-violet-text" : "text-subtle")} aria-hidden />
                        {v.label}
                      </span>
                      <span className="text-xs leading-relaxed text-muted">{v.copy.replace("handle", handle || "handle")}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="Live preview">
        <p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Live preview</p>
        <motion.div layout transition={springs.gentle} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
          <motion.div layout className={cn("relative h-20 transition-colors duration-300", ACCENT_STYLES[form.accentColor].band)}>
            <span className="absolute top-3 right-3 font-mono text-[10px] tracking-[0.16em] uppercase opacity-80">Proof dossier</span>
          </motion.div>
          <div className="-mt-8 px-5 pb-5">
            <Avatar name={name} src={image} size="lg" verified={proofScore > 0} className="ring-4 ring-surface rounded-full" />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold">{name}</p>
                <p className="text-sm text-pretty text-muted">{form.headline || "Your headline appears here"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[10px] tracking-wider text-subtle uppercase">Score</p>
                <p className="font-display text-2xl font-semibold text-verified tabular">{proofScore}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {college && <span>{college}{graduationYear ? ` · ${graduationYear}` : ""}</span>}
              {form.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" aria-hidden />
                  {form.location}
                </span>
              )}
              {form.openToWork && <Badge variant="verified">Open to work</Badge>}
            </div>
            {topSkills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {topSkills.slice(0, 4).map((s) => (
                  <Badge key={s.slug} variant={s.score >= 70 ? "verified" : "neutral"} mono>
                    {s.name} {s.score}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-2">
              <AnimatePresence initial={false}>
                {pinned.map((e) => (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={springs.gentle}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 bg-ledger px-3 py-2 text-xs"
                  >
                    <SealGlyph className="size-4 shrink-0 text-lime" />
                    <span className="truncate">{e.title}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {pinned.length === 0 && <p className="text-xs text-subtle">Pinned evidence shows here.</p>}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
              {(() => {
                const V = VISIBILITY[form.visibility];
                return (
                  <>
                    <V.icon className="size-3.5" aria-hidden />
                    {V.label}
                  </>
                );
              })()}
              <span className="ml-auto truncate font-mono">/u/{handle}</span>
            </div>
          </div>
        </motion.div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 px-4 py-3 backdrop-blur lg:static lg:col-span-2 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <AnimatePresence>
            {dirty && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-muted"
                role="status"
              >
                Unsaved changes
              </motion.span>
            )}
          </AnimatePresence>
          <Button variant="ghost" onClick={() => setForm(saved)} disabled={!dirty || pending}>
            Discard
          </Button>
          <Button onClick={onSave} loading={pending} disabled={!dirty}>
            {!pending && <Save aria-hidden />}
            Save profile
          </Button>
        </div>
      </div>
    </div>
  );
}
