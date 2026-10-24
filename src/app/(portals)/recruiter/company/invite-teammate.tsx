"use client";

import { Copy, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { inviteTeammateAction } from "@/server/recruiter/actions";

/** Invite stub: validates the domain and hands back a sign-up link to share until email is configured. */
export function InviteTeammate({ domain }: { domain: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="p-4">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium">
        <UserPlus className="size-4 text-subtle" aria-hidden /> Invite a teammate
      </p>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await inviteTeammateAction({ email });
            if (!res.ok) {
              setError(res.fieldErrors?.email ?? res.error);
              setLink(null);
              return;
            }
            setError(undefined);
            setLink(`${window.location.origin}${res.data.link}`);
            toast.success("Invite link ready");
          });
        }}
      >
        <Field label="Work email" htmlFor="invite-email" error={error} hint={`Must be an @${domain} address.`}>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${domain}`}
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false} aria-invalid={!!error} />
        </Field>
        <Button type="submit" variant="secondary" loading={pending}>
          Create invite
        </Button>
      </form>
      {link && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-xs text-muted">No email provider is configured, so share this link yourself:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Copy invite link"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success("Copied");
              }}
            >
              <Copy />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
