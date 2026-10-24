"use client";

import { ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { STATEMENT_MAX, STATEMENT_MIN } from "@/lib/validation/mentor";
import { cn } from "@/lib/utils";
import { endorseStudentDirect } from "@/server/mentor/actions";
import { SealMoment, type SealMomentData } from "../../student/_components/seal-moment";

/** Vouch for a student without waiting for a request: handle + skill + statement. */
export function DirectEndorseForm({ skills, disabled }: { skills: { slug: string; name: string }[]; disabled: boolean }) {
  const [skill, setSkill] = useState("");
  const [statement, setStatement] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [moment, setMoment] = useState<SealMomentData | null>(null);
  const [pending, start] = useTransition();
  const len = statement.trim().length;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    start(async () => {
      const res = await endorseStudentDirect({
        handle: String(form.get("handle") ?? ""),
        skillSlug: skill,
        relationship: String(form.get("relationship") ?? ""),
        statement,
      });
      if (!res.ok) {
        setErrors(res.errors ?? {});
        if (res.error) toast.error(res.error);
        return;
      }
      setErrors({});
      setStatement("");
      setSkill("");
      formEl.reset();
      setMoment({
        title: "Endorsement signed",
        detail: `${res.studentName}'s ${res.subject} work now carries your name, sealed into a verifiable credential.`,
        credentialId: res.credentialId,
      });
    });
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <fieldset disabled={disabled || pending} className="grid gap-4 disabled:opacity-60">
          <Field label="Student handle" htmlFor="handle" error={errors.handle} hint="From their profile link, e.g. /u/ishita-varma.">
            <Input id="handle" name="handle" placeholder="e.g. ishita-varma" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={!!errors.handle} />
          </Field>
          <Field label="Skill" htmlFor="skill" error={errors.skillSlug}>
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger id="skill" aria-invalid={!!errors.skillSlug}>
                <SelectValue placeholder="Choose a skill" />
              </SelectTrigger>
              <SelectContent>
                {skills.map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="How you know their work" htmlFor="direct-relationship" error={errors.relationship}>
            <Input id="direct-relationship" name="relationship" placeholder="e.g. Supervised their summer internship" autoComplete="off" aria-invalid={!!errors.relationship} />
          </Field>
          <Field label="Statement" htmlFor="direct-statement" error={errors.statement}>
            <Textarea
              id="direct-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              maxLength={STATEMENT_MAX}
              rows={4}
              placeholder="What did you see them build, first-hand?"
              aria-invalid={!!errors.statement}
            />
          </Field>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Min {STATEMENT_MIN} characters</span>
            <span className={cn("font-mono tabular", len < STATEMENT_MIN ? "text-subtle" : "text-verified")}>
              {len}/{STATEMENT_MAX}
            </span>
          </div>
          <Button type="submit" loading={pending} disabled={disabled || len < STATEMENT_MIN || !skill} className="w-full">
            <ShieldCheck aria-hidden />
            Sign endorsement
          </Button>
        </fieldset>
      </form>
      <SealMoment data={moment} onClose={() => setMoment(null)} />
    </>
  );
}
