import { AuthError, assertRole } from "@/server/auth/guard";
import { getCollege, getPlacementStats, placementsCsv } from "@/server/college/queries";
import { collegeCanExport } from "@/server/billing/queries";
import { collegeScopeOf } from "@/server/college/scope";

export const dynamic = "force-dynamic";

/** CSV of this college's placements. Scoped by the session; no ids are read from the request. */
export async function GET() {
  try {
    const user = await assertRole("college");
    const scope = collegeScopeOf(user);
    if (!scope) return new Response("No college linked to this account.", { status: 403 });
    if (!(await collegeCanExport({ type: "college", id: scope.collegeId }))) {
      return new Response("CSV export is part of the College Campus plan. Upgrade in Billing.", { status: 402 });
    }
    const [college, stats] = await Promise.all([getCollege(scope), getPlacementStats(scope)]);
    const slug = college?.slug ?? "college";
    const date = new Date().toISOString().slice(0, 10);
    return new Response(placementsCsv(stats.placements), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="proof-placements-${slug}-${date}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return new Response(err.message, { status: err.status });
    throw err;
  }
}
