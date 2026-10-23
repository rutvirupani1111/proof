import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getThread, listThreads } from "@/server/messaging/queries";
import { isMessageableStudent } from "@/server/recruiter/queries";
import { ThreadList } from "./thread-list";
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
        <ThreadList
          threads={threads}
          activeId={withId}
          basePath="/recruiter/messages"
          emptyText="No conversations yet. Message a candidate from their dossier."
          hidden={!!thread}
        />
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
