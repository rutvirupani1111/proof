import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn, timeAgo } from "@/lib/utils";
import type { ThreadSummary } from "@/server/messaging/queries";

/** The conversation list beside a `ThreadView`. Reusable by any portal's messages page. */
export function ThreadList({
  threads,
  activeId,
  basePath,
  emptyText,
  hidden,
}: {
  threads: ThreadSummary[];
  activeId?: string;
  /** e.g. "/recruiter/messages"; each row links to `${basePath}?with=<id>`. */
  basePath: string;
  emptyText: string;
  /** Hide on phones while a thread is open (the thread has its own back link). */
  hidden?: boolean;
}) {
  return (
    <nav aria-label="Conversations" className={cn("min-h-0 overflow-y-auto border-line md:border-r", hidden && "hidden md:block")}>
      {threads.length === 0 ? (
        <p className="p-5 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-line">
          {threads.map((t) => {
            const active = t.otherUserId === activeId;
            return (
              <li key={t.otherUserId}>
                <Link
                  href={`${basePath}?with=${t.otherUserId}`}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2", active && "bg-violet-soft/60")}
                >
                  <Avatar name={t.name} src={t.image} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.name}</span>
                      <span className="shrink-0 text-[11px] text-subtle">{timeAgo(t.lastAt)}</span>
                    </span>
                    {t.subtitle && <span className="block truncate text-[11px] text-subtle">{t.subtitle}</span>}
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
  );
}
