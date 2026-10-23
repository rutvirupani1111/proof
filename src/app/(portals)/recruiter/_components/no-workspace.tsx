import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/** Shown when the signed-in account has no company (e.g. an admin browsing the recruiter portal). */
export function NoWorkspace() {
  return (
    <EmptyState
      icon={Building2}
      title="No company workspace"
      description="Recruiter tools are scoped to a company. Sign in with a recruiter account that belongs to one."
    />
  );
}
