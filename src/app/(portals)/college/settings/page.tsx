import { MapPin, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Seal } from "@/components/ui/seal";
import { timeAgo } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getCollege } from "@/server/college/queries";
import { collegeScopeOf } from "@/server/college/scope";
import { NoCollege } from "../_components/no-college";

export const metadata: Metadata = { title: "College settings" };

export default async function CollegeSettingsPage() {
  const user = await requireRole("college", "/college/settings");
  const scope = collegeScopeOf(user);
  const college = scope ? await getCollege(scope) : null;
  if (!college) {
    return (
      <>
        <PageHeader eyebrow="Placement cell" title="College settings" />
        <NoCollege />
      </>
    );
  }
  const verified = !!college.domainVerifiedAt || user.domainVerification === "verified";
  return (
    <>
      <PageHeader eyebrow="Placement cell" title={college.name} description={`${college.city}, ${college.state}`} />
      <Card variant={verified ? "verified" : "default"} className="max-w-3xl">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          {verified ? (
            <Seal size={84} stamp="mount" label="Verified college · Proof ·" title="College domain verified" />
          ) : (
            <span className="grid size-20 shrink-0 place-items-center rounded-full border-2 border-dashed border-coral/50 bg-coral-soft">
              <ShieldAlert className="size-8 text-coral-text" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">College email domain</p>
            <p className="mt-1 font-display text-2xl font-semibold">@{college.domain}</p>
            <p className="mt-1 text-sm text-muted">
              {verified
                ? `Verified${college.domainVerifiedAt ? ` ${timeAgo(college.domainVerifiedAt)}` : ""}. Students who sign up with @${college.domain} join your cohort, and recruiters see your drives as coming from a verified placement cell.`
                : `Pending. Domain verification by magic link to an @${college.domain} address is coming; until then cohort data is visible to you but drives show an "unverified college" label.`}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-subtle">
              <MapPin className="size-3.5" aria-hidden /> {college.shortName} · {college.city}
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}
