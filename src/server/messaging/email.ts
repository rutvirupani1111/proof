/**
 * Optional email when a student receives an in-app message. Respects the student's notification
 * settings: muting "Messages" (student_profiles.muted_notifications) also stops the email. The
 * adapter's rate limit (1 per 15 minutes per student) turns a burst of messages into one email.
 * Only real sends matter here: there is no on-screen fallback for a notification email.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, studentProfiles, users } from "@/db/schema";
import { newMessageEmail, sendEmail } from "@/server/email";

export async function emailNewMessage(input: {
  senderId: string;
  senderName: string;
  companyId?: string | null;
  recipientUserId: string;
  body: string;
  origin: string;
}): Promise<"sent" | "skipped" | "not_sent"> {
  const db = await getDb();
  const recipient = await db.query.users.findFirst({
    where: eq(users.id, input.recipientUserId),
    columns: { email: true, role: true, emailVerified: true },
  });
  if (!recipient || recipient.role !== "student" || !recipient.emailVerified) return "skipped";
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, input.recipientUserId),
    columns: { mutedNotifications: true },
  });
  if (profile?.mutedNotifications.includes("message")) return "skipped";
  const company = input.companyId
    ? await db.query.companies.findFirst({ where: eq(companies.id, input.companyId), columns: { name: true } })
    : null;
  const res = await sendEmail({
    to: recipient.email,
    template: "new-message",
    ...newMessageEmail({
      senderName: input.senderName,
      senderOrg: company?.name,
      preview: input.body,
      threadUrl: `${input.origin}/student/messages?with=${encodeURIComponent(input.senderId)}`,
      settingsUrl: `${input.origin}/student/settings`,
    }),
  });
  return res.status === "sent" ? "sent" : "not_sent";
}
