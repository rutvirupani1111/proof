import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guard";
import { getOnboardingData } from "@/server/student/profile";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up your Proof profile" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireRole("student", "/student/onboarding");
  const data = await getOnboardingData(user.id);
  const p = data.profile;
  const step = p ? (p.onboardingStep >= 4 ? 0 : Math.min(p.onboardingStep, 3)) : 0;

  return (
    <OnboardingWizard
      firstName={user.name.split(" ")[0] ?? user.name}
      initialStep={step}
      revisiting={(p?.onboardingStep ?? 0) >= 4}
      colleges={data.colleges}
      skills={data.skills}
      initial={{
        collegeId: p?.collegeId ?? "",
        graduationYear: p?.graduationYear ?? new Date().getFullYear() + 1,
        degree: p?.degree ?? "B.Tech",
        branch: p?.branch ?? "",
        targetRoles: p?.targetRoles ?? [],
        skillIds: data.claimedSkillIds,
      }}
    />
  );
}
