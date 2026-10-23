import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { emailDomain } from "@/lib/handle";
import { requireRole } from "@/server/auth/guard";
import { getMentorForUser } from "@/server/mentor/queries";
import { institutionalEmailProblem } from "@/server/verify/domain";
import { DomainCard } from "../_components/domain-card";
import { MentorProfileForm } from "../_components/profile-form";

export const metadata: Metadata = { title: "Domain & profile" };

export default async function MentorSettingsPage() {
  const user = await requireRole("mentor", "/mentor/settings");
  const mentor = await getMentorForUser(user.id);
  const domain = mentor?.emailDomain ?? emailDomain(user.email);

  return (
    <>
      <PageHeader
        eyebrow="Mentor"
        title="Domain & profile"
        description="Who you are, where you mentor, and proof that you really are there. Recruiters see this next to every endorsement you sign."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>{mentor ? "Mentor profile" : "Create your mentor profile"}</CardTitle>
            <CardDescription>Shown with your endorsements as &ldquo;{user.name}, Title at Institution&rdquo;.</CardDescription>
          </CardHeader>
          <CardContent>
            <MentorProfileForm
              isNew={!mentor}
              domain={domain}
              initial={{
                title: mentor?.title ?? "",
                organization: mentor?.organization ?? "",
                orgType: mentor?.orgType ?? "college",
                bio: mentor?.bio ?? "",
              }}
            />
          </CardContent>
        </Card>
        <div className="lg:sticky lg:top-20">
          <DomainCard
            email={user.email}
            domain={domain}
            hasProfile={!!mentor}
            verifiedAt={mentor?.domainVerifiedAt ?? null}
            problem={institutionalEmailProblem(user.email)}
          />
        </div>
      </div>
    </>
  );
}
