"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCheck, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { sendMessageAction } from "@/server/messaging/actions";
import type { ThreadMessage } from "@/server/messaging/queries";

/** A two-person thread with an optimistic composer. Reusable by any portal's messages page. */
export function ThreadView({
  other,
  initial,
  canSend,
  backHref,
  lockedHint = "This profile is hidden; you can't start a conversation.",
}: {
  other: { id: string; name: string; image: string | null; subtitle: string | null; profileHref: string | null };
  initial: ThreadMessage[];
  canSend: boolean;
  backHref: string;
  /** Composer placeholder while sending is not allowed. */
  lockedHint?: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const temp: ThreadMessage = { id: `temp-${Date.now()}`, body, createdAt: new Date().toISOString(), fromMe: true, readAt: null };
    setMessages((m) => [...m, temp]);
    setDraft("");
    start(async () => {
      const res = await sendMessageAction({ recipientUserId: other.id, body });
      if (res.ok) setMessages((m) => m.map((x) => (x.id === temp.id ? res.data : x)));
      else {
        setMessages((m) => m.filter((x) => x.id !== temp.id));
        setDraft(body);
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href={backHref} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 md:hidden" aria-label="All conversations">
          <ArrowLeft className="size-4" />
        </Link>
        <Avatar name={other.name} src={other.image} size="sm" />
        <div className="min-w-0 flex-1">
          {other.profileHref ? (
            <Link href={other.profileHref} className="block truncate text-sm font-semibold hover:underline">
              {other.name}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold">{other.name}</p>
          )}
          {other.subtitle && <p className="truncate text-xs text-muted">{other.subtitle}</p>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-ledger px-4 py-4" role="log" aria-live="polite" aria-label={`Conversation with ${other.name}`}>
        {messages.length === 0 && <p className="mx-auto max-w-xs py-10 text-center text-sm text-muted">Say hello. Mention the evidence that caught your eye; specifics get replies.</p>}
        <ul className="grid gap-2">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.li
                key={m.id}
                layout="position"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={springs.snappy}
                className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[70%]",
                    m.fromMe ? "rounded-br-md bg-ink text-canvas" : "rounded-bl-md border border-line bg-surface",
                    m.id.startsWith("temp-") && "opacity-70",
                  )}
                >
                  <p className="whitespace-pre-wrap text-pretty break-words">{m.body}</p>
                  <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", m.fromMe ? "text-canvas/60" : "text-subtle")}>
                    {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {m.fromMe && m.readAt && <CheckCheck className="size-3" aria-label="Read" />}
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor="composer" className="sr-only">
          Message {other.name}
        </label>
        <textarea
          id="composer"
          rows={1}
          value={draft}
          disabled={!canSend}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={canSend ? "Write a message… (Enter to send)" : lockedHint}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm placeholder:text-subtle focus-visible:border-violet focus-visible:ring-4 focus-visible:ring-violet/20 focus-visible:outline-none disabled:opacity-60"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={!canSend || !draft.trim() || pending}>
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}
