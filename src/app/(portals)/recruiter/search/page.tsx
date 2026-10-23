import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getSavedSearches } from "@/server/recruiter/queries";
import { recruiterScopeOf } from "@/server/recruiter/scope";
import { getSearchFacets, normalizeFilters, searchCandidates } from "@/server/search/engine";
import { mergeFilters, parseTalentQuery } from "@/server/search/talent-query";
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
  const rail = normalizeFilters(parseF(sp.f));
  const text = typeof sp.t === "string" ? sp.t.slice(0, 300) : "";
  const [facets, saved] = await Promise.all([getSearchFacets(), scope ? getSavedSearches(scope) : Promise.resolve([])]);
  // Plain-English text (from the box or the command palette's "Find: ...") is parsed with the live vocabulary.
  const parsed = text ? parseTalentQuery(text, { skills: facets.skills, colleges: facets.colleges }) : null;
  const initial = await searchCandidates(parsed ? mergeFilters(rail, parsed.filters) : rail);

  return (
    <>
      <PageHeader
        eyebrow="Talent"
        title="Evidence search"
        description="Describe who you need in plain English, or use the filters. Every match is backed by verified evidence: real commits, live apps, passed checks and endorsements from verified mentors."
      />
      <SearchView
        facets={facets}
        initial={initial}
        canSave={!!scope}
        railFilters={rail}
        initialText={text}
        saved={saved.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      />
    </>
  );
}
