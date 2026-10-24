import "server-only";
import { and, asc, count, desc, eq, gt, isNull, notLike, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, studentProfiles, type Notification } from "@/db/schema";
import type { ShellNotification } from "@/components/shell/notifications-bell";

/**
 * Filters that hide the categories a student muted in /student/settings
 * (`student_profiles.muted_notifications`). Muted rows are still stored, just never shown.
 */
async function visibilityFilters(userId: string): Promise<SQL[]> {
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, userId),
    columns: { mutedNotifications: true },
  });
  const muted = (profile?.mutedNotifications ?? []).filter((k) => /^[a-z]+$/.test(k));
  return muted.map((k) => notLike(notifications.type, `${k}.%`));
}

export function toShellNotification(n: Notification): ShellNotification {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

async function unreadCountFor(userId: string, visible: SQL[]): Promise<number> {
  const db = await getDb();
  const [unread] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), ...visible));
  return unread?.n ?? 0;
}

/**
 * Latest notifications for the bell, scoped to the signed-in user only. Categories a student muted
 * are left out of the list and the count.
 */
export async function getShellNotifications(userId: string, limit = 8) {
  const db = await getDb();
  const visible = await visibilityFilters(userId);
  const [rows, unreadCount] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), ...visible))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    unreadCountFor(userId, visible),
  ]);
  return { items: rows.map(toShellNotification), unreadCount };
}

/**
 * Notifications created after `since` (oldest first) plus the fresh unread count, for the live
 * stream. Same user scoping and mute rules as the bell. The unread count is only computed when
 * something new arrived, so an idle poll is a single indexed query (plus the mute lookup).
 */
export async function getNotificationsSince(userId: string, since: Date, limit = 20) {
  const db = await getDb();
  const visible = await visibilityFilters(userId);
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), gt(notifications.createdAt, since), ...visible))
    .orderBy(asc(notifications.createdAt))
    .limit(limit);
  if (!rows.length) return { items: [] as ShellNotification[], unreadCount: null };
  return { items: rows.map(toShellNotification), unreadCount: await unreadCountFor(userId, visible) };
}
