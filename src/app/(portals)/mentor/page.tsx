import { Award, Inbox, MailCheck, PenLine, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { RoadmapCard } from "@/components/shell/roadmap-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/server/auth/guard";
import { getMentorDashboard } from "@/server/mentor/queries";

export const metadata: Metadata = { title: "Mentor dashboard" };

export default async function MentorDashboard() {
  const user = await requireRole("mentor", "/mentor");
  const data = await getMentorDashboard(user.id);
  const verified = !!data.mentor?.domainVerifiedAt;

  return (
    <>
      <PageHeader
        eyebrow={data.mentor?.organization ?? "Mentor"}
        title="Vouch for real work"
        description="Your endorsement carries your institution's name. Endorse specific skills and projects you have seen first-hand."
        actions={
          verified ? (
            <Badge variant="verified">Verified mentor at @{data.mentor?.emailDomain}</Badge>
          ) : (
            <Badge variant="coral">Domain verification pending</Badge>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Pending requests" value={data.requested} icon={Inbox} />
        <Stat label="Endorsements given" value={data.endorsed} tone="verified" icon={Award} />
        <Stat label="Domain" value={data.mentor ? `@${data.mentor.emailDomain}` : "—"} icon={ShieldCheck} className="col-span-2 lg:col-span-1 [&_span.font-display]:text-xl" />
      </div>
      <div className="mt-6">
        <RoadmapCard
          title="What lives here"
          description="Mentor attestations are one of the five kinds of evidence behind a Proof Score."
          items={[
            { icon: MailCheck, title: "Domain verification", description: "Prove your institutional email with a magic link; shown as \"Verified mentor at @domain\"." },
            { icon: Inbox, title: "Endorsement requests", description: "Students ask you to vouch for a skill or project; accept or decline." },
            { icon: PenLine, title: "Write an attestation", description: "A short statement on what you saw them build. Signed as a credential." },
            { icon: Award, title: "Your endorsements", description: "Everything you have vouched for, with the option to revoke." },
          ]}
        />
      </div>
    </>
  );
}
