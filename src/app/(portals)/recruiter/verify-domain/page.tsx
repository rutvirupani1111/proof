import type { Metadata } from "next";
import { OrgVerifyPage } from "../_components/org-verify-page";

export const metadata: Metadata = { title: "Confirm your company domain" };
export const dynamic = "force-dynamic";

export default async function RecruiterVerifyDomainPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <OrgVerifyPage purpose="company" rawToken={token} />;
}
