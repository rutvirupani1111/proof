import { Building2, Globe, MapPin, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Seal } from "@/components/ui/seal";
import { timeAgo } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getCompanyWorkspace } from "@/server/recruiter/queries";
import { recruiterScopeOf } from "@/server/recruiter/scope";
import { NoWorkspace } from "../_components/no-workspace";
import { InviteTeammate } from "./invite-teammate";

export const metadata: Metadata = { title: "Company workspace" };

export default async function CompanyPage() {
  const user = await requireRole("recruiter", "/recruiter/company");
  const scope = recruiterScopeOf(user);
  if (!scope) {
    return (
      <>
        <PageHeader eyebrow="Workspace" title="Company" />
        <NoWorkspace />
      </>
    );
  }
  const { company, teammates } = await getCompanyWorkspace(scope);
  if (!company) return <NoWorkspace />;
  const verified = !!company.domainVerifiedAt || user.domainVerification === "verified";

  return (
    <>
      <PageHeader eyebrow="Workspace" title={company.name} description={company.about ?? "Your company workspace on Proof."} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-6">
          <Card variant={verified ? "verified" : "default"} className="overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              {verified ? (
                <Seal size={84} stamp="mount" label="Verified company · Proof ·" title="Company domain verified" />
              ) : (
                <span className="grid size-20 shrink-0 place-items-center rounded-full border-2 border-dashed border-coral/50 bg-coral-soft">
                  <ShieldAlert className="size-8 text-coral-text" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Email domain</p>
                <p className="mt-1 font-display text-2xl font-semibold">@{company.domain}</p>
                {verified ? (
                  <p className="mt-1 text-sm text-muted">
                    Verified{company.domainVerifiedAt ? ` ${timeAgo(company.domainVerifiedAt)}` : ""}. Candidates see your messages and invites as coming from a verified company.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    Pending. Until your domain is verified, candidates see an “unverified company” label on messages and skill-check invites. Domain verification by magic link to an @{company.domain} address is coming; your Proof admin can verify you meanwhile.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>Everyone here shares shortlists, the pipeline, saved searches and notes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-line">
                {teammates.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={t.name} src={t.image} size="sm" verified={t.domainVerification === "verified"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.name} {t.id === user.id && <span className="font-normal text-subtle">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{t.email}</p>
                    </div>
                    {t.domainVerification === "verified" ? <Badge variant="verified">Verified</Badge> : <Badge variant="coral">Pending</Badge>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-4">
          <InviteTeammate domain={company.domain} />
          <Card variant="flat" className="grid gap-2 p-4 text-sm">
            <p className="inline-flex items-center gap-2">
              <Building2 className="size-4 text-subtle" aria-hidden /> {company.industry ?? "Industry not set"}
              {company.size && <span className="text-subtle">· {company.size}</span>}
            </p>
            {company.city && (
              <p className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-subtle" aria-hidden /> {company.city}
              </p>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-violet-text hover:underline">
                <Globe className="size-4" aria-hidden /> {company.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
