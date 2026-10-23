/**
 * In-app direct messages. A thread is the unordered pair (me, other). Every read is keyed by the
 * session user's id: you only ever see messages you sent or received.
 *
 * Who may start a thread: a recruiter, with a student whose profile is visible to recruiters.
 * Everyone else may only reply to someone who wrote to them first.
 */
import "server-only";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, messages, notifications, studentProfiles, users } from "@/db/schema";
import type { Role } from "@/lib/auth/roles";
import { canSeeCandidate } from "@/server/recruiter/queries";
import { ScopeError } from "@/server/recruiter/scope";

export type ThreadSummary = {
  otherUserId: string;
  name: string;
  image: string | null;
  role: string;
  subtitle: string | null;
  lastBody: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
};

export async function listThreads(userId: string): Promise<ThreadSummary[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(or(eq(messages.senderUserId, userId), eq(messages.recipientUserId, userId)))
    .orderBy(desc(messages.createdAt))
    .limit(600);
  const threads = new Map<string, { last: (typeof rows)[number]; unread: number }>();
  for (const m of rows) {
    const other = m.senderUserId === userId ? m.recipientUserId : m.senderUserId;
    const t = threads.get(other) ?? { last: m, unread: 0 };
    if (m.recipientUserId === userId && !m.readAt) t.unread += 1;
    threads.set(other, t);
  }
  if (!threads.size) return [];
  const people = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      role: users.role,
      headline: studentProfiles.headline,
      companyName: companies.name,
    })
    .from(users)
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(inArray(users.id, [...threads.keys()]));
  const byId = new Map(people.map((p) => [p.id, p]));
  return [...threads.entries()].flatMap(([other, t]) => {
    const p = byId.get(other);
    if (!p) return [];
    return [
      {
        otherUserId: other,
        name: p.name,
        image: p.image,
        role: p.role,
        subtitle: p.role === "student" ? p.headline : p.companyName,
        lastBody: t.last.body,
        lastAt: t.last.createdAt.toISOString(),
        lastFromMe: t.last.senderUserId === userId,
        unread: t.unread,
      },
    ];
  });
}

export type ThreadMessage = { id: string; body: string; createdAt: string; fromMe: boolean; readAt: string | null };

/** Messages between the session user and one other person (oldest first). Marks theirs as read. */
export async function getThread(userId: string, otherUserId: string) {
  const db = await getDb();
  const other = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      role: users.role,
      handle: studentProfiles.handle,
      headline: studentProfiles.headline,
      companyName: companies.name,
    })
    .from(users)
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, otherUserId))
    .limit(1);
  const person = other[0];
  if (!person) return null;
  const rows = await db
    .select()
    .from(messages)
    .where(
      or(
        and(eq(messages.senderUserId, userId), eq(messages.recipientUserId, otherUserId)),
        and(eq(messages.senderUserId, otherUserId), eq(messages.recipientUserId, userId)),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(400);
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.senderUserId, otherUserId), eq(messages.recipientUserId, userId), isNull(messages.readAt)));
  const list: ThreadMessage[] = rows.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    fromMe: m.senderUserId === userId,
    readAt: m.readAt?.toISOString() ?? null,
  }));
  return { other: person, messages: list };
}

/** May `sender` write to `recipient`? Throws ScopeError with a human reason when not. */
export async function assertCanMessage(
  sender: { id: string; role: Role; companyId?: string | null },
  recipientUserId: string,
) {
  if (sender.id === recipientUserId) throw new ScopeError("You cannot message yourself.");
  const db = await getDb();
  const prior = await db.query.messages.findFirst({
    where: and(eq(messages.senderUserId, recipientUserId), eq(messages.recipientUserId, sender.id)),
    columns: { id: true },
  });
  if (prior) return;
  if ((sender.role === "recruiter" || sender.role === "admin") && sender.companyId) {
    const recipient = await db.query.users.findFirst({ where: eq(users.id, recipientUserId), columns: { role: true } });
    if (
      recipient?.role === "student" &&
      (await canSeeCandidate({ userId: sender.id, companyId: sender.companyId }, recipientUserId))
    ) {
      return;
    }
  }
  throw new ScopeError("You can reply once they have written to you.");
}

export async function sendMessage(
  sender: { id: string; name: string; role: Role; companyId?: string | null },
  input: { recipientUserId: string; body: string },
) {
  await assertCanMessage(sender, input.recipientUserId);
  const db = await getDb();
  const [msg] = await db
    .insert(messages)
    .values({
      senderUserId: sender.id,
      recipientUserId: input.recipientUserId,
      companyId: sender.companyId ?? null,
      body: input.body,
    })
    .returning();
  const recipient = await db.query.users.findFirst({ where: eq(users.id, input.recipientUserId), columns: { role: true } });
  const portal = recipient?.role === "recruiter" ? "recruiter" : recipient?.role === "student" ? "student" : recipient?.role ?? "student";
  await db.insert(notifications).values({
    userId: input.recipientUserId,
    type: "message.new",
    title: `New message from ${sender.name}`,
    body: input.body.length > 120 ? `${input.body.slice(0, 117)}…` : input.body,
    href: `/${portal}/messages?with=${sender.id}`,
  });
  const out: ThreadMessage = {
    id: msg!.id,
    body: msg!.body,
    createdAt: msg!.createdAt.toISOString(),
    fromMe: true,
    readAt: null,
  };
  return out;
}
