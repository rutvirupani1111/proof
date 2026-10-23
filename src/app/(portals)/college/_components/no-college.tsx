import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function NoCollege() {
  return (
    <EmptyState
      icon={GraduationCap}
      title="No college linked yet"
      description="Placement-cell tools are scoped to one college. Sign in with a placement officer account that belongs to one."
    />
  );
}
