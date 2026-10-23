import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { getDb } from "@/db";
import { studentProfiles } from "@/db/schema";
import { PORTAL_ACCESS, type Portal } from "@/lib/auth/roles";
import { requireRole } from "@/server/auth/guard";
import { getShellNotifications } from "@/server/notifications/queries";
import { AppShell } from "./app-shell";

/** Server wrapper used by every portal layout: guard, then load shell data, then render. */
export async function PortalLayout({ portal, children }: { portal: Portal; children: ReactNode }) {
  const user = await requireRole(PORTAL_ACCESS[portal], `/${portal}`);
  const db = await getDb();
  const [{ items, unreadCount }, profile] = await Promise.all([
    getShellNotifications(user.id),
    user.role === "student"
      ? db.query.studentProfiles.findFirst({
          where: eq(studentProfiles.userId, user.id),
          columns: { handle: true },
        })
      : Promise.resolve(undefined),
  ]);

  return (
    <AppShell
      portal={portal}
      user={{
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        role: user.role,
        domainVerification: String(user.domainVerification ?? "not_required"),
        handle: profile?.handle ?? null,
      }}
      notifications={items}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
