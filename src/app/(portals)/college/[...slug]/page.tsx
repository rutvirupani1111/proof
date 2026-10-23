import { ComingSoon } from "@/components/shell/coming-soon";
import { requireRole } from "@/server/auth/guard";

/** Placeholder for college pages not built yet. A real route (e.g. ./jobs/page.tsx) takes precedence. */
export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  await requireRole("college");
  const { slug } = await params;
  return <ComingSoon portal="college" slug={slug} />;
}
