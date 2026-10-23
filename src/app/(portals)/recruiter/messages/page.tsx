import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn, timeAgo } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getThread, listThreads } from "@/server/messaging/queries";
import { isMessageableStudent } from "@/server/recruiter/queries";
import { ThreadView } from "./thread-view";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const user = await requireRole("recruiter", "/recruiter/messages");
  const { with: withId } = await searchParams;
  const [threads, thread] = await Promise.all([
    listThreads(user.id),
    withId && withId !== user.id ? getThread(user.id, withId) : Promise.resolve(null),
  ]);
  const canStart = thread && thread.messages.length === 0 ? await isMessageableStudent(thread.other.id) : true;

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Messages" description="Talk to candidates in-app. They get a notification; nothing leaves Proof." />
      <div className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card md:h-[min(70dvh,44rem)] md:grid-cols-[18rem_minmax(0,1fr)]">
        <nav aria-label="Conversations" className={cn("min-h-0 overflow-y-auto border-line md:border-r", thread && "hidden md:block")}>
          {threads.length === 0 ? (
            <p className="p-5 text-sm text-muted">No conversations yet. Message a candidate from their dossier.</p>
          ) : (
            <ul className="divide-y divide-line">
              {threads.map((t) => {
                const active = t.otherUserId === withId;
                return (
                  <li key={t.otherUserId}>
                    <Link
                      href={`/recruiter/messages?with=${t.otherUserId}`}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2", active && "bg-violet-soft/60")}
                    >
                      <Avatar name={t.name} src={t.image} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.name}</span>
                          <span className="shrink-0 text-[11px] text-subtle">{timeAgo(t.lastAt)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="truncate text-xs text-muted">
                            {t.lastFromMe ? "You: " : ""}
                            {t.lastBody}
                          </span>
                          {t.unread > 0 && (
                            <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-lime px-1 font-mono text-[10px] font-semibold text-lime-ink">
                              {t.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        <div className={cn("min-h-[60dvh] md:min-h-0", !thread && "hidden md:block")}>
          {thread ? (
            <ThreadView
              key={thread.other.id}
              other={{
                id: thread.other.id,
                name: thread.other.name,
                image: thread.other.image,
                subtitle: thread.other.role === "student" ? thread.other.headline : thread.other.companyName,
                profileHref: thread.other.role === "student" ? `/recruiter/candidates/${thread.other.id}` : null,
              }}
              initial={thread.messages}
              canSend={canStart}
              backHref="/recruiter/messages"
            />
          ) : (
            <EmptyState icon={MessageSquare} title="Pick a conversation" description="Or open a candidate's dossier and choose Message." className="m-6 border-none bg-transparent" />
          )}
        </div>
      </div>
    </>
  );
}
