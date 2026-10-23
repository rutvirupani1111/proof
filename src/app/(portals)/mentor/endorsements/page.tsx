import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getMentorForUser, listMentorAttestations, listSkillOptions } from "@/server/mentor/queries";
import { DirectEndorseForm } from "../_components/direct-endorse-form";
import { EndorsementsList } from "../_components/endorsements-list";
import { VerifyBanner } from "../_components/verify-banner";

export const metadata: Metadata = { title: "Endorsements given" };

export default async function MentorEndorsementsPage() {
  const user = await requireRole("mentor", "/mentor/endorsements");
  const mentor = await getMentorForUser(user.id);
  const [rows, skills] = await Promise.all([
    mentor ? listMentorAttestations(mentor.id, "given") : Promise.resolve([]),
    listSkillOptions(),
  ]);
  const verified = !!mentor?.domainVerifiedAt;

  return (
    <>
      <PageHeader
        eyebrow="Endorsements"
        title="Given"
        description="Everything you have vouched for. Each endorsement is a signed credential; revoke it if it no longer holds."
      />
      {!verified && <VerifyBanner hasProfile={!!mentor} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <EndorsementsList rows={rows} />
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Endorse a student directly</CardTitle>
            <CardDescription>No request needed when you supervised the work yourself.</CardDescription>
          </CardHeader>
          <CardContent>
            <DirectEndorseForm skills={skills} disabled={!verified} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
