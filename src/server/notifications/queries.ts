import "server-only";
import { and, count, desc, eq, isNull, notLike } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, studentProfiles } from "@/db/schema";
import type { ShellNotification } from "@/components/shell/notifications-bell";

/**
 * Latest notifications for the bell, scoped to the signed-in user only. Categories a student muted
 * in /student/settings (`student_profiles.muted_notifications`) are left out of the list and count.
 */
export async function getShellNotifications(userId: string, limit = 8) {
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, userId),
    columns: { mutedNotifications: true },
  });
  const muted = (profile?.mutedNotifications ?? []).filter((k) => /^[a-z]+$/.test(k));
  const visible = muted.map((k) => notLike(notifications.type, `${k}.%`));
  const [rows, [unread]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), ...visible))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), ...visible)),
  ]);
  const items: ShellNotification[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
  return { items, unreadCount: unread?.n ?? 0 };
}
