import "server-only";
import type { SessionUser } from "@/server/auth/auth";

/** A placement officer reads and writes only their own college. Built from the session only. */
export type CollegeScope = { userId: string; collegeId: string };

export function collegeScopeOf(user: SessionUser): CollegeScope | null {
  const collegeId = user.collegeId as string | null | undefined;
  return collegeId ? { userId: user.id, collegeId } : null;
}
