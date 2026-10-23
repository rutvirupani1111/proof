"use client";

import { Building2, GraduationCap } from "lucide-react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { saveMentorProfile } from "@/server/mentor/actions";

type Initial = { title: string; organization: string; orgType: "college" | "company"; bio: string };

const ORG_TYPES = [
  { value: "college", label: "College", hint: "Professor, lecturer, lab head", icon: GraduationCap },
  { value: "company", label: "Company", hint: "Engineer, lead, founder", icon: Building2 },
] as const;

export function MentorProfileForm({ initial, domain, isNew }: { initial: Initial; domain: string; isNew: boolean }) {
  const [orgType, setOrgType] = useState<Initial["orgType"]>(initial.orgType);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      title: String(form.get("title") ?? ""),
      organization: String(form.get("organization") ?? ""),
      orgType,
      bio: String(form.get("bio") ?? ""),
    };
    start(async () => {
      const res = await saveMentorProfile(input);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        if (res.error) toast.error(res.error);
        return;
      }
      setErrors({});
      toast.success(res.created ? "Mentor profile created. Next: verify your domain." : "Profile saved.");
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-[13px] font-medium">You mentor at a</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {ORG_TYPES.map(({ value, label, hint, icon: Icon }) => {
            const active = orgType === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setOrgType(value)}
                className={cn(
                  "relative flex min-h-16 items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active ? "border-violet bg-violet-soft" : "border-line-strong bg-surface hover:bg-surface-2",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="org-type-ring"
                    className="absolute inset-0 rounded-xl ring-2 ring-violet/40"
                    transition={springs.snappy}
                  />
                )}
                <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-violet-text" : "text-muted")} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <Field label="Title" htmlFor="title" error={errors.title}>
        <Input id="title" name="title" defaultValue={initial.title} placeholder="Associate Professor, Computer Engineering" aria-invalid={!!errors.title} />
      </Field>
      <Field
        label={orgType === "college" ? "College" : "Company"}
        htmlFor="organization"
        error={errors.organization}
        hint={`Your account email is at @${domain}; that is the domain we verify.`}
      >
        <Input id="organization" name="organization" defaultValue={initial.organization} placeholder={orgType === "college" ? "Sardar Patel Institute of Technology, Surat" : "Kitecode Labs"} aria-invalid={!!errors.organization} />
      </Field>
      <Field label="Short bio" htmlFor="bio" error={errors.bio} hint="Optional. Shown next to your endorsements.">
        <Textarea id="bio" name="bio" defaultValue={initial.bio} maxLength={400} placeholder="Teaches distributed systems; guides final-year projects." />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending} variant={isNew ? "primary" : "secondary"} className="w-full sm:w-auto">
          {isNew ? "Create mentor profile" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
