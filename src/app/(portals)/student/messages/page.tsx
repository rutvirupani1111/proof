import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getThread, listThreads } from "@/server/messaging/queries";
import { ThreadList } from "../../recruiter/messages/thread-list";
import { ThreadView } from "../../recruiter/messages/thread-view";

export const metadata: Metadata = { title: "Messages" };

export default async function StudentMessagesPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const user = await requireRole("student", "/student/messages");
  const { with: withId } = await searchParams;
  const [threads, thread] = await Promise.all([
    listThreads(user.id),
    withId && withId !== user.id ? getThread(user.id, withId) : Promise.resolve(null),
  ]);
  // Students reply; they never cold-message. The server re-checks this in `assertCanMessage`.
  const canReply = !!thread && thread.messages.some((m) => !m.fromMe);

  return (
    <>
      <PageHeader
        eyebrow="Opportunities"
        title="Messages"
        description="Recruiters who found your evidence write here. You can reply to any thread they start; nothing leaves Proof."
      />
      <div className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card md:h-[min(70dvh,44rem)] md:grid-cols-[18rem_minmax(0,1fr)]">
        <ThreadList
          threads={threads}
          activeId={withId}
          basePath="/student/messages"
          emptyText="No messages yet. When a recruiter writes about your work, the thread shows up here."
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
                subtitle: thread.other.role === "recruiter" ? thread.other.companyName : thread.other.headline,
                profileHref: null,
              }}
              initial={thread.messages}
              canSend={canReply}
              lockedHint="You can reply once they have written to you."
              backHref="/student/messages"
            />
          ) : (
            <EmptyState
              icon={MessageSquare}
              title={threads.length ? "Pick a conversation" : "Your inbox is empty"}
              description="Verified proofs are what recruiters search on. Add one from the Proofs hub to get found."
              className="m-6 border-none bg-transparent"
            />
          )}
        </div>
      </div>
    </>
  );
}
