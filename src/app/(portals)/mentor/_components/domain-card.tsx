"use client";

import { Check, Copy, ExternalLink, MailCheck, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Seal } from "@/components/ui/seal";
import { toast } from "@/components/ui/toast";
import { requestDomainLink } from "@/server/mentor/actions";

type Props = {
  email: string;
  domain: string;
  hasProfile: boolean;
  verifiedAt: Date | null;
  /** Non-null when the email is a personal mailbox that cannot prove an institution. */
  problem: string | null;
};

type Sent = { delivered: boolean; link: string | null; email: string };

export function DomainCard({ email, domain, hasProfile, verifiedAt, problem }: Props) {
  const [sent, setSent] = useState<Sent | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      const res = await requestDomainLink();
      if (!res.ok) return void toast.error(res.error ?? "Could not create the link.");
      if (res.alreadyVerified) return void toast.success("Your domain is already verified.");
      setSent(res);
      if (res.delivered) toast.success(`Magic link sent to ${res.email}`);
    });
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed; select the link instead.");
    }
  }

  if (verifiedAt) {
    return (
      <Card variant="verified" className="overflow-hidden">
        <CardContent className="flex items-center gap-4 p-5">
          <Seal size={76} label="Domain · Verified ·" title={`Verified mentor at @${domain}`} />
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Domain verified</p>
            <p className="mt-1 font-display text-lg font-semibold break-words">Verified mentor at @{domain}</p>
            <p className="mt-0.5 text-xs text-muted">
              Since {verifiedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. Every
              endorsement you sign carries this line.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify @{domain}</CardTitle>
        <CardDescription>
          We email a one-time magic link to <span className="font-medium text-ink break-all">{email}</span>. Opening it
          proves you control an inbox at your institution. Links expire after 30 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {problem ? (
          <p role="alert" className="flex gap-2 rounded-xl border border-coral/30 bg-coral-soft px-3 py-2.5 text-sm text-coral-text">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{problem} Create a new mentor account with your institutional email.</span>
          </p>
        ) : (
          <Button onClick={send} loading={pending} disabled={!hasProfile} className="w-full sm:w-fit">
            <MailCheck aria-hidden />
            {sent ? "Send a new link" : "Email me a magic link"}
          </Button>
        )}
        {!hasProfile && !problem && <p className="text-xs text-muted">Save your profile first; the link verifies it.</p>}

        <AnimatePresence mode="wait">
          {sent && (
            <motion.div
              key={sent.link ?? "delivered"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={springs.gentle}
            >
              {sent.delivered ? (
                <p className="rounded-xl border border-verified/30 bg-verified-soft px-3 py-2.5 text-sm text-verified">
                  Sent. Check your inbox at {sent.email} and open the link on this device.
                </p>
              ) : (
                <div className="rounded-xl border border-dashed border-violet/40 bg-violet-soft p-3.5">
                  <p className="font-mono text-[11px] tracking-[0.12em] text-violet-text uppercase">Development mode</p>
                  <p className="mt-1 text-sm text-ink">Email not configured yet, so here is your link:</p>
                  <code className="mt-2 block rounded-lg border border-line bg-surface px-2.5 py-2 font-mono text-[11px] leading-relaxed break-all text-muted">
                    {sent.link}
                  </code>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm" variant="violet">
                      <Link href={sent.link!}>
                        <ExternalLink aria-hidden />
                        Open link
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => copy(sent.link!)}>
                      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
