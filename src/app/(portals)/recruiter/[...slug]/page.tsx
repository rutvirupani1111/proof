import { ComingSoon } from "@/components/shell/coming-soon";
import { requireRole } from "@/server/auth/guard";

/** Placeholder for recruiter pages not built yet. A real route (e.g. ./jobs/page.tsx) takes precedence. */
export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  await requireRole("recruiter");
  const { slug } = await params;
  return <ComingSoon portal="recruiter" slug={slug} />;
}
