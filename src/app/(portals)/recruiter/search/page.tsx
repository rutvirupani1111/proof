import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getSavedSearches } from "@/server/recruiter/queries";
import { recruiterScopeOf } from "@/server/recruiter/scope";
import { getSearchFacets, normalizeFilters, searchCandidates } from "@/server/search/engine";
import { SearchView } from "./search-view";

export const metadata: Metadata = { title: "Evidence search" };

function parseF(raw: string | string[] | undefined): unknown {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole("recruiter", "/recruiter/search");
  const scope = recruiterScopeOf(user);
  const sp = await searchParams;
  const filters = normalizeFilters(parseF(sp.f));
  const [facets, initial, saved] = await Promise.all([
    getSearchFacets(),
    searchCandidates(filters),
    scope ? getSavedSearches(scope) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Talent"
        title="Evidence search"
        description="Every filter here is backed by verified evidence: real commits, live apps, passed checks and endorsements from verified mentors."
      />
      <SearchView
        facets={facets}
        initial={initial}
        canSave={!!scope}
        saved={saved.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      />
    </>
  );
}
