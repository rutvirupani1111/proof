/**
 * Role + portal map shared by client and server. The single source of truth for
 * "which role may open which portal" (used by the proxy, the server guard and the UI).
 */
export const ROLES = ["student", "recruiter", "college", "mentor", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles a person may pick on the sign-up form. Admins are provisioned, never self-served. */
export const SIGNUP_ROLES = ["student", "recruiter", "college", "mentor"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export type Portal = "student" | "recruiter" | "college" | "mentor";
export const PORTALS: Portal[] = ["student", "recruiter", "college", "mentor"];

/** Which roles may enter each portal. Admin may enter every portal. */
export const PORTAL_ACCESS: Record<Portal, Role[]> = {
  student: ["student", "admin"],
  recruiter: ["recruiter", "admin"],
  college: ["college", "admin"],
  mentor: ["mentor", "admin"],
};

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  recruiter: "Recruiter",
  college: "Placement cell",
  mentor: "Mentor",
  admin: "Admin",
};

/** Roles whose institutional email domain must be verified before trust-bearing actions. */
export const DOMAIN_VERIFIED_ROLES: Role[] = ["recruiter", "college", "mentor"];

export function homeFor(role: Role | string | null | undefined): string {
  switch (role) {
    case "recruiter":
      return "/recruiter";
    case "college":
      return "/college";
    case "mentor":
      return "/mentor";
    case "admin":
      return "/recruiter";
    default:
      return "/student";
  }
}

/** The portal a pathname belongs to, if any. */
export function portalForPath(pathname: string): Portal | null {
  const seg = pathname.split("/")[1];
  return PORTALS.includes(seg as Portal) ? (seg as Portal) : null;
}

export function canAccessPortal(role: Role | string | null | undefined, portal: Portal): boolean {
  return !!role && PORTAL_ACCESS[portal].includes(role as Role);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Only allow same-origin relative redirects after login. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
