import { LinkIcon, MailWarning } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { requireRole } from "@/server/auth/guard";
import { peekDomainMagicLink } from "@/server/verify/domain";
import { orgOf } from "@/server/verify/org-domain";
import { ConfirmOrgDomain } from "./org-domain";

const COPY = {
  company: { role: "recruiter", path: "/recruiter/verify-domain", home: "/recruiter/company", homeLabel: "Company workspace", eyebrow: "Workspace" },
  college: { role: "college", path: "/college/verify-domain", home: "/college/settings", homeLabel: "College settings", eyebrow: "Placement cell" },
} as const;

/** Magic-link landing page for company / college domains. Nothing is consumed on GET. */
export async function OrgVerifyPage({ purpose, rawToken }: { purpose: "company" | "college"; rawToken: string | string[] | undefined }) {
  const c = COPY[purpose];
  const token = typeof rawToken === "string" ? rawToken : "";
  const user = await requireRole(c.role, token ? `${c.path}?token=${encodeURIComponent(token)}` : c.path);
  const [org, peek] = await Promise.all([
    orgOf(purpose, user),
    token ? peekDomainMagicLink(token) : Promise.resolve(null),
  ]);

  const back = (
    <Button asChild variant="secondary">
      <Link href={c.home}>Request a new link</Link>
    </Button>
  );

  let body: ReactNode;
  if (org?.domainVerifiedAt && user.domainVerification === "verified") {
    body = (
      <EmptyState
        title={`Already verified at @${org.domain}`}
        description="Nothing more to do here."
        action={
          <Button asChild>
            <Link href={c.home}>Back to {c.homeLabel}</Link>
          </Button>
        }
      />
    );
  } else if (!token || !peek || peek.purpose !== purpose) {
    body = (
      <EmptyState
        icon={MailWarning}
        title="This link has expired or was already used"
        description={`Magic links work once and expire after 30 minutes. Request a fresh one from ${c.homeLabel}.`}
        action={back}
      />
    );
  } else if (peek.userId !== user.id) {
    body = (
      <EmptyState icon={LinkIcon} title="This link belongs to another account" description="Sign out and sign in as the person the link was sent to." action={back} />
    );
  } else {
    body = (
      <Card variant="ledger" className="mx-auto w-full max-w-md">
        <CardContent className="p-6 text-center sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-verified/30 bg-verified-soft">
            <SealGlyph className="size-7 text-verified" />
          </span>
          <p className="mt-5 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">One last step</p>
          <p className="mt-1 font-display text-2xl font-semibold break-words">@{peek.domain}</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-pretty text-muted">
            Confirm that you, {user.name}, work at {org?.name ?? "this organisation"}. Its profile will carry the verified seal.
          </p>
          <div className="mt-6">
            <ConfirmOrgDomain purpose={purpose} token={token} domain={peek.domain} next={c.home} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader eyebrow={c.eyebrow} title="Confirm your domain" description="The last step of email domain verification." />
      {body}
    </>
  );
}
