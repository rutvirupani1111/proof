import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getChecksList, getProofsHub } from "@/server/student/proofs";
import { ProofsHub, type HubTab } from "./proofs-hub";

export const metadata: Metadata = { title: "Proofs hub" };

const TABS: HubTab[] = ["github", "repos", "deployments", "checks", "endorsements"];

export default async function ProofsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole("student", "/student/proofs");
  const [{ tab }, hub, checks] = await Promise.all([searchParams, getProofsHub(user.id), getChecksList(user.id)]);
  const initial = TABS.includes(tab as HubTab) ? (tab as HubTab) : hub.github?.status === "verified" ? "repos" : "github";

  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Proofs hub"
        description="Turn real work into signed evidence. Each verification stamps a seal, issues a W3C credential and updates your Proof Score."
      />
      <ProofsHub hub={hub} checks={checks.map((c) => ({ slug: c.slug, title: c.title, level: c.level, best: c.best, passed: c.passed, attempts: c.attempts }))} initialTab={initial} />
    </>
  );
}
