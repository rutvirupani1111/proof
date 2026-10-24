import { Briefcase, GraduationCap, School, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/auth/roles";

export const ROLE_ICON: Record<Role, LucideIcon> = {
  student: GraduationCap,
  recruiter: Briefcase,
  college: School,
  mentor: Sparkles,
  admin: ShieldCheck,
};
