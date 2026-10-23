"use client";

import { MailCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { confirmOrgDomain, requestOrgDomainLink } from "@/server/verify/org-domain-actions";
import { SealMoment, type SealMomentData } from "../../student/_components/seal-moment";

type Purpose = "company" | "college";

/** "Send verification link" for a recruiter's company or a placement officer's college. */
export function RequestOrgDomainLink({ purpose, domain }: { purpose: Purpose; domain: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sent, setSent] = useState<{ email: string; link: string | null } | null>(null);

  return (
    <div className="mt-4 grid gap-3">
      <Button
        className="w-full sm:w-auto sm:justify-self-start"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await requestOrgDomainLink(purpose);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            if (res.alreadyVerified) {
              toast.success("Already verified");
              router.refresh();
              return;
            }
            setSent({ email: res.email, link: res.link });
            toast.success(res.delivered ? `Link sent to ${res.email}` : "Verification link ready");
          })
        }
      >
        <MailCheck aria-hidden />
        Send a link to my @{domain} address
      </Button>
      {sent && (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
          {sent.link ? (
            <>
              <p className="font-medium">No email provider is configured, so here is the link (valid 30 minutes, single use):</p>
              <Link href={sent.link} className="mt-1 inline-flex items-center font-mono text-xs break-all text-violet-text hover:underline">
                {sent.link}
              </Link>
            </>
          ) : (
            <p>
              Check <span className="font-medium">{sent.email}</span>. The link works once and expires in 30 minutes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Explicit confirm on the magic-link landing page (nothing is consumed on GET). */
export function ConfirmOrgDomain({ purpose, token, domain, next }: { purpose: Purpose; token: string; domain: string; next: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moment, setMoment] = useState<SealMomentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-3">
        <Button
          size="lg"
          className="w-full"
          loading={pending}
          disabled={!!moment}
          onClick={() =>
            start(async () => {
              const res = await confirmOrgDomain(purpose, { token });
              if (!res.ok) {
                setError(res.error);
                toast.error(res.error);
                return;
              }
              setMoment({
                title: `${res.name} verified at @${res.domain}`,
                detail:
                  purpose === "company"
                    ? "Candidates now see your messages and skill-check invites as coming from a verified company."
                    : "Recruiters now see your drives as coming from a verified placement cell.",
              });
            })
          }
        >
          <ShieldCheck aria-hidden />
          Confirm @{domain}
        </Button>
        {error && (
          <p role="alert" className="rounded-xl border border-coral/30 bg-coral-soft px-3 py-2 text-sm text-coral-text">
            {error}
          </p>
        )}
      </div>
      <SealMoment
        data={moment}
        onClose={() => {
          setMoment(null);
          router.push(next);
          router.refresh();
        }}
      />
    </>
  );
}
