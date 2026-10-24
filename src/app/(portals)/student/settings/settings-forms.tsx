"use client";

import { Bell, Eye, KeyRound, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { NOTIFICATION_CATEGORIES, VISIBILITIES } from "@/lib/validation/student";
import { saveStudentAccount, saveStudentNotifications, saveStudentPrivacy, type SettingsResult } from "@/server/student/settings-actions";

type Visibility = (typeof VISIBILITIES)[number];

const VISIBILITY_COPY: Record<Visibility, { label: string; hint: string }> = {
  public: { label: "Public", hint: "Anyone with the link can open your dossier, and search engines can index it." },
  recruiters: { label: "Recruiters only", hint: "Signed-in recruiters can find you in evidence search." },
  hidden: { label: "Hidden", hint: "Only you. A recruiter still sees you once you apply to their job." },
};

function Section({ icon: Icon, title, description, children }: { icon: typeof Bell; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="max-w-3xl">
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-soft text-violet-text">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </Card>
  );
}

function useSave() {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<SettingsResult>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setErrors({});
        toast.success(done);
      } else {
        setErrors(res.errors);
        toast.error(res.errors.form ?? Object.values(res.errors)[0] ?? "Could not save.");
      }
    });
  return { pending, errors, run };
}

export function SettingsForms({
  account,
  privacy,
  muted: initialMuted,
}: {
  account: { name: string; email: string };
  privacy: { visibility: Visibility; openToWork: boolean; handle: string | null };
  muted: string[];
}) {
  const [name, setName] = useState(account.name);
  const [savedName, setSavedName] = useState(account.name);
  const [visibility, setVisibility] = useState<Visibility>(privacy.visibility);
  const [openToWork, setOpenToWork] = useState(privacy.openToWork);
  const [muted, setMuted] = useState<string[]>(initialMuted);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwPending, startPw] = useTransition();
  const acc = useSave();
  const priv = useSave();
  const notif = useSave();

  return (
    <div className="grid gap-5">
      <Section icon={UserRound} title="Account" description="How you appear to recruiters, mentors and your placement cell.">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            acc.run(async () => {
              const res = await saveStudentAccount({ name });
              if (res.ok) setSavedName(name.trim());
              return res;
            }, "Name saved");
          }}
        >
          <Field label="Full name" htmlFor="settings-name" error={acc.errors.name}>
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Ishita Varma" required />
          </Field>
          <Field label="Email" htmlFor="settings-email" hint="Your sign-in email. It cannot be changed here.">
            <Input id="settings-email" type="email" value={account.email} autoComplete="email" readOnly disabled />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={acc.pending || name.trim() === savedName}>
              {acc.pending ? "Saving…" : "Save name"}
            </Button>
          </div>
        </form>
        <form
          className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            startPw(async () => {
              const { error } = await authClient.changePassword({
                currentPassword: pw.current,
                newPassword: pw.next,
                revokeOtherSessions: true,
              });
              if (error) toast.error(error.message ?? "Could not change the password.");
              else {
                setPw({ current: "", next: "" });
                toast.success("Password changed. Other devices were signed out.");
              }
            });
          }}
        >
          <p className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <KeyRound className="size-4 text-muted" aria-hidden /> Change password
          </p>
          <Field label="Current password" htmlFor="settings-pw-current">
            <PasswordInput
              id="settings-pw-current"
              autoComplete="current-password"
              placeholder="Your current password"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              required
            />
          </Field>
          <Field label="New password" htmlFor="settings-pw-new" hint="At least 8 characters.">
            <PasswordInput
              id="settings-pw-new"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary" disabled={pwPending || pw.next.length < 8 || !pw.current}>
              {pwPending ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </Section>

      <Section icon={Eye} title="Privacy" description="Verified evidence only helps if the right people can see it. You decide who.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            priv.run(() => saveStudentPrivacy({ visibility, openToWork }), "Privacy saved");
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Who can see your dossier</legend>
            {VISIBILITIES.map((v) => (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:bg-surface-2",
                  visibility === v && "border-violet bg-violet-soft/40",
                )}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  checked={visibility === v}
                  onChange={() => setVisibility(v)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--violet)] max-sm:size-5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{VISIBILITY_COPY[v].label}</span>
                  <span className="block text-xs text-muted">{VISIBILITY_COPY[v].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={openToWork}
              onChange={(e) => setOpenToWork(e.target.checked)}
              className="size-4 shrink-0 accent-[var(--violet)] max-sm:size-5"
            />
            Show recruiters I am open to work
          </label>
          {priv.errors.visibility && <p className="text-xs text-coral-text">{priv.errors.visibility}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={priv.pending}>
              {priv.pending ? "Saving…" : "Save privacy"}
            </Button>
            {privacy.handle && (
              <Link href={`/u/${privacy.handle}`} target="_blank" className="inline-flex items-center text-sm font-medium text-violet-text hover:underline">
                View my dossier
              </Link>
            )}
          </div>
        </form>
      </Section>

      <Section icon={Bell} title="Notifications" description="Muted categories stay in your history but stop showing in the bell.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            notif.run(() => saveStudentNotifications({ muted }), "Notification preferences saved");
          }}
        >
          <fieldset className="grid gap-1">
            <legend className="sr-only">Notify me about</legend>
            {NOTIFICATION_CATEGORIES.map((c) => {
              const on = !muted.includes(c.key);
              return (
                <label key={c.key} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setMuted((m) => (on ? [...m, c.key] : m.filter((k) => k !== c.key)))}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--violet)] max-sm:size-5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{c.label}</span>
                    <span className="block text-xs text-muted">{c.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div>
            <Button type="submit" disabled={notif.pending}>
              {notif.pending ? "Saving…" : "Save notifications"}
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
