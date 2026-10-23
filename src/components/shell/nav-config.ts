import {
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarRange,
  ClipboardList,
  Code2,
  FileBarChart,
  GraduationCap,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Portal } from "@/lib/auth/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Not built yet: rendered muted with a "soon" tag, still navigable to its placeholder. */
  soon?: boolean;
};
export type NavSection = { title?: string; items: NavItem[] };

/**
 * Sidebar + command palette entries per portal. Add a page under src/app/(portals)/<portal>/...
 * and register it here; drop `soon` once it is real.
 */
export const NAV: Record<Portal, NavSection[]> = {
  student: [
    { items: [{ label: "Dashboard", href: "/student", icon: LayoutDashboard }] },
    {
      title: "Evidence",
      items: [
        { label: "Proofs hub", href: "/student/proofs", icon: BadgeCheck },
        { label: "Skill checks", href: "/student/checks", icon: Code2 },
        { label: "Profile", href: "/student/profile", icon: UserRound },
      ],
    },
    {
      title: "Hiring",
      items: [
        { label: "Jobs", href: "/student/jobs", icon: Briefcase },
        { label: "Applications", href: "/student/applications", icon: ClipboardList },
        { label: "Messages", href: "/student/messages", icon: MessageSquare },
      ],
    },
    { items: [{ label: "Settings", href: "/student/settings", icon: Settings }] },
  ],
  recruiter: [
    { items: [{ label: "Dashboard", href: "/recruiter", icon: LayoutDashboard }] },
    {
      title: "Talent",
      items: [
        { label: "Evidence search", href: "/recruiter/search", icon: Search },
        { label: "Shortlists", href: "/recruiter/shortlists", icon: ListChecks },
        { label: "Pipeline", href: "/recruiter/pipeline", icon: KanbanSquare },
      ],
    },
    {
      title: "Workspace",
      items: [
        { label: "Jobs", href: "/recruiter/jobs", icon: Briefcase },
        { label: "Messages", href: "/recruiter/messages", icon: MessageSquare },
        { label: "Company", href: "/recruiter/company", icon: Building2 },
      ],
    },
  ],
  college: [
    { items: [{ label: "Dashboard", href: "/college", icon: LayoutDashboard }] },
    {
      title: "Placement cell",
      items: [
        { label: "Cohort", href: "/college/cohort", icon: Users },
        { label: "Drives", href: "/college/drives", icon: CalendarRange },
        { label: "Placement stats", href: "/college/stats", icon: FileBarChart },
        { label: "Nudges", href: "/college/nudges", icon: Sparkles },
      ],
    },
    { items: [{ label: "College settings", href: "/college/settings", icon: GraduationCap }] },
  ],
  mentor: [
    { items: [{ label: "Dashboard", href: "/mentor", icon: LayoutDashboard }] },
    {
      title: "Endorsements",
      items: [
        { label: "Requests", href: "/mentor/requests", icon: Inbox },
        { label: "Given", href: "/mentor/endorsements", icon: Award },
      ],
    },
    { items: [{ label: "Domain & profile", href: "/mentor/settings", icon: Settings }] },
  ],
};

export const PORTAL_TITLE: Record<Portal, string> = {
  student: "Student",
  recruiter: "Recruiter",
  college: "Placement cell",
  mentor: "Mentor",
};
