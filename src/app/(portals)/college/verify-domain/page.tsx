import type { Metadata } from "next";
import { OrgVerifyPage } from "../../recruiter/_components/org-verify-page";

export const metadata: Metadata = { title: "Confirm your college domain" };
export const dynamic = "force-dynamic";

export default async function CollegeVerifyDomainPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <OrgVerifyPage purpose="college" rawToken={token} />;
}
