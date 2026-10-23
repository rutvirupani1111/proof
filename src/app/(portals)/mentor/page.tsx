import { ArrowRight, Award, Inbox, MailCheck, PenLine, ShieldCheck, UserRoundPen, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { cn, timeAgo } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getMentorDashboard, listMentorAttestations } from "@/server/mentor/queries";
import { subjectLabel } from "./_components/subject";
import { VerifyBanner } from "./_components/verify-banner";

export const metadata: Metadata = { title: "Mentor dashboard" };

const STEPS = [
  { icon: UserRoundPen, title: "Tell us where you mentor", description: "Title and institution. Your account email's domain is what we verify." },
  { icon: MailCheck, title: "Verify your domain", description: "Open a one-time magic link sent to your institutional inbox." },
  { icon: PenLine, title: "Vouch for real work", description: "Endorse specific skills and projects you have seen first-hand." },
];

export default async function MentorDashboard() {
  const user = await requireRole("mentor", "/mentor");
  const data = await getMentorDashboard(user.id);

  if (!data.mentor) {
    return (
      <>
        <PageHeader eyebrow="Mentor" title="Vouch for real work" description="Your endorsement carries your institution's name, so we verify it first. Three steps, about two minutes." />
        <Card variant="ledger" className="overflow-hidden">
          <CardContent className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <ol className="grid gap-4 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, description }, i) => (
                <li key={title} className="relative rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <span className="font-mono text-[11px] text-subtle">0{i + 1}</span>
                  <Icon className={cn("mt-2 size-5", i === 0 ? "text-violet-text" : "text-muted")} aria-hidden />
                  <p className="mt-2 text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
                </li>
              ))}
            </ol>
            <Button asChild size="lg" className="w-full lg:w-auto">
              <Link href="/mentor/settings">
                Set up mentor profile
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const verified = !!data.mentor.domainVerifiedAt;
  const [requests, given] = await Promise.all([
    listMentorAttestations(data.mentor.id, "requests", 3),
    listMentorAttestations(data.mentor.id, "given", 3),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={data.mentor.organization}
        title="Vouch for real work"
        description="Endorse specific skills and projects you have seen first-hand. Each endorsement is signed into a credential anyone can verify."
        actions={
          verified ? (
            <Badge variant="verified">Verified mentor at @{data.mentor.emailDomain}</Badge>
          ) : (
            <Badge variant="coral">Domain verification pending</Badge>
          )
        }
      />
      {!verified && <VerifyBanner hasProfile />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending requests" value={data.requested} icon={Inbox} />
        <Stat label="Endorsements given" value={data.endorsed} tone="verified" icon={Award} />
        <Stat label="Students vouched for" value={data.students} icon={Users} />
        <Stat label="Domain" value={`@${data.mentor.emailDomain}`} icon={ShieldCheck} className="col-span-2 lg:col-span-1 [&_span.font-display]:text-lg [&_span.font-display]:break-all" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Waiting for you</CardTitle>
              <Button variant="link" size="sm" asChild>
                <Link href="/mentor/requests">Open inbox</Link>
              </Button>
            </div>
            <CardDescription>Students who asked you to vouch for their work.</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <EmptyState className="py-8" title="No open requests" description="New requests appear here and in your notifications." />
            ) : (
              <ul className="divide-y divide-line">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={r.studentName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.studentName}</p>
                      <p className="truncate text-xs text-muted">
                        {subjectLabel(r)} · {timeAgo(r.requestedAt)}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href="/mentor/requests">Review</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Recently endorsed</CardTitle>
              <Button variant="link" size="sm" asChild>
                <Link href="/mentor/endorsements">All endorsements</Link>
              </Button>
            </div>
            <CardDescription>Signed credentials carrying your name.</CardDescription>
          </CardHeader>
          <CardContent>
            {given.length === 0 ? (
              <EmptyState className="py-8" title="Nothing signed yet" description="Your first endorsement will appear here with its credential." />
            ) : (
              <ul className="divide-y divide-line">
                {given.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={r.studentName} size="sm" verified={r.status === "endorsed"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.studentName}</p>
                      <p className="truncate text-xs text-muted">
                        {subjectLabel(r)} · {timeAgo(r.respondedAt)}
                      </p>
                    </div>
                    {r.status === "revoked" ? <Badge variant="coral">Revoked</Badge> : <Badge variant="verified">Signed</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
