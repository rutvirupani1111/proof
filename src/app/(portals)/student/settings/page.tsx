import type { Metadata } from "next";
import { StampSoundSetting } from "@/components/student/stamp-sound-setting";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getStudentSettings } from "@/server/student/settings";
import { SettingsForms } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function StudentSettingsPage() {
  const user = await requireRole("student", "/student/settings");
  const profile = await getStudentSettings(user.id);

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" description="Your account, who can see your dossier, and what the bell tells you about." />
      <SettingsForms
        account={{ name: user.name, email: user.email }}
        privacy={{ visibility: profile?.visibility ?? "recruiters", openToWork: profile?.openToWork ?? true, handle: profile?.handle ?? null }}
        muted={profile?.mutedNotifications ?? []}
      />
      <div className="mt-5">
        <StampSoundSetting />
      </div>
    </>
  );
}
