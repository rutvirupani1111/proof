import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { Accent } from "@/lib/validation/student";
import { ACCENTS } from "@/lib/validation/student";
import { requireRole } from "@/server/auth/guard";
import { getProfileBuilderData } from "@/server/student/profile";
import { ProfileBuilder } from "./builder";

export const metadata: Metadata = { title: "Profile builder" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireRole("student", "/student/profile");
  const data = await getProfileBuilderData(user.id);
  const p = data.profile;
  const accent = (ACCENTS as readonly string[]).includes(p?.accentColor ?? "") ? (p!.accentColor as Accent) : "lime";

  return (
    <>
      <PageHeader
        eyebrow="Your dossier"
        title="Profile builder"
        description="What recruiters see first. Pin the evidence you are proudest of and decide who can see you."
        actions={
          p && (
            <Button variant="secondary" asChild>
              <Link href={`/u/${p.handle}`} target="_blank">
                View public profile
                <ExternalLink aria-hidden />
              </Link>
            </Button>
          )
        }
      />
      <ProfileBuilder
        name={data.user?.name ?? user.name}
        image={data.user?.image ?? null}
        handle={p?.handle ?? ""}
        college={p?.college?.shortName ?? p?.college?.name ?? null}
        graduationYear={p?.graduationYear ?? null}
        proofScore={p?.proofScore ?? 0}
        topSkills={data.topSkills}
        evidence={data.evidence.map((e) => ({ ...e, verifiedAt: e.verifiedAt?.toISOString() ?? null }))}
        initial={{
          headline: p?.headline ?? "",
          about: p?.about ?? "",
          location: p?.location ?? "",
          targetRoles: p?.targetRoles ?? [],
          openToWork: p?.openToWork ?? true,
          accentColor: accent,
          visibility: p?.visibility ?? "recruiters",
          pinnedEvidenceIds: (p?.pinnedEvidenceIds ?? []).filter((id) => data.evidence.some((e) => e.id === id)).slice(0, 3),
        }}
      />
    </>
  );
}
