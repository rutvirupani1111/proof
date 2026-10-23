import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/server/auth/guard";
import { getMentorForUser, listMentorAttestations } from "@/server/mentor/queries";
import { RequestsInbox } from "../_components/requests-inbox";
import { VerifyBanner } from "../_components/verify-banner";

export const metadata: Metadata = { title: "Endorsement requests" };

export default async function MentorRequestsPage() {
  const user = await requireRole("mentor", "/mentor/requests");
  const mentor = await getMentorForUser(user.id);
  const rows = mentor ? await listMentorAttestations(mentor.id, "requests") : [];
  const verified = !!mentor?.domainVerifiedAt;

  return (
    <>
      <PageHeader
        eyebrow="Endorsements"
        title="Requests"
        description="Students asking you to vouch for a specific skill or project. Review their evidence, then endorse only what you have seen first-hand."
        actions={rows.length > 0 && <Badge mono>{rows.length} open</Badge>}
      />
      {!verified && <VerifyBanner hasProfile={!!mentor} />}
      <RequestsInbox rows={rows} canEndorse={verified} domain={mentor?.emailDomain ?? null} />
    </>
  );
}
