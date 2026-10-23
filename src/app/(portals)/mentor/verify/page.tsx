import { LinkIcon, MailWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { requireRole } from "@/server/auth/guard";
import { getMentorForUser } from "@/server/mentor/queries";
import { peekDomainMagicLink } from "@/server/verify/domain";
import { ConfirmDomain } from "../_components/confirm-domain";

export const metadata: Metadata = { title: "Confirm your domain" };

/** Magic-link landing page. Nothing is consumed on GET: the mentor confirms with a button. */
export default async function MentorVerifyPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw : "";
  const user = await requireRole("mentor", token ? `/mentor/verify?token=${encodeURIComponent(token)}` : "/mentor/verify");
  const [mentor, peek] = await Promise.all([getMentorForUser(user.id), token ? peekDomainMagicLink(token) : null]);

  const backToSettings = (
    <Button asChild variant="secondary">
      <Link href="/mentor/settings">Request a new link</Link>
    </Button>
  );

  let body: React.ReactNode;
  if (mentor?.domainVerifiedAt) {
    body = (
      <EmptyState
        title={`Already verified at @${mentor.emailDomain}`}
        description="Nothing more to do here. Your endorsements already carry your institution's name."
        action={
          <Button asChild>
            <Link href="/mentor/requests">Go to requests</Link>
          </Button>
        }
      />
    );
  } else if (!token || !peek || peek.purpose !== "mentor") {
    body = (
      <EmptyState
        icon={MailWarning}
        title="This link has expired or was already used"
        description="Magic links work once and expire after 30 minutes. Request a fresh one from Domain & profile."
        action={backToSettings}
      />
    );
  } else if (peek.userId !== user.id) {
    body = (
      <EmptyState
        icon={LinkIcon}
        title="This link belongs to another account"
        description="Sign out and sign in as the mentor the link was sent to."
        action={backToSettings}
      />
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
            Confirm that you, {user.name}, mentor at this institution. Your endorsements will show &ldquo;Verified mentor
            at @{peek.domain}&rdquo;.
          </p>
          <div className="mt-6">
            <ConfirmDomain token={token} domain={peek.domain} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Mentor" title="Confirm your domain" description="The last step of institutional email verification." />
      {body}
    </>
  );
}
