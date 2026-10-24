"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import type { ShellNotification } from "./notifications-bell";

type Payload = { item: ShellNotification; unreadCount: number | null };

const MAX_ITEMS = 8;

/**
 * Keeps the bell live: subscribes to `/api/notifications/stream` (Server-Sent Events), prepends
 * each new notification, updates the unread badge and shows a toast. The server closes the stream
 * on a time budget; EventSource reconnects by itself with `Last-Event-ID`, so nothing is missed.
 * Server-rendered props (after a navigation or `router.refresh()`) reset the state.
 */
export function useLiveNotifications(initialItems: ShellNotification[], initialUnread: number, since: string) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [prev, setPrev] = useState({ initialItems, initialUnread });
  const routerRef = useRef(router);
  // The stream is opened once per mount; later re-renders keep it (and its own cursor).
  const sinceRef = useRef(since);
  const seen = useRef(new Set<string>());

  // Fresh server props win (derived-state pattern, no effect needed).
  if (prev.initialItems !== initialItems || prev.initialUnread !== initialUnread) {
    setPrev({ initialItems, initialUnread });
    setItems(initialItems);
    setUnreadCount(initialUnread);
  }

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource(`/api/notifications/stream?since=${encodeURIComponent(sinceRef.current)}`);
    const onNotification = (e: MessageEvent<string>) => {
      let data: Payload;
      try {
        data = JSON.parse(e.data) as Payload;
      } catch {
        return;
      }
      const { item, unreadCount: count } = data;
      if (count != null) setUnreadCount(count);
      if (seen.current.has(item.id)) return;
      seen.current.add(item.id);
      setItems((list) => (list.some((n) => n.id === item.id) ? list : [item, ...list].slice(0, MAX_ITEMS)));
      toast(item.title, {
        id: `notification-${item.id}`,
        description: item.body ?? undefined,
        action: item.href
          ? { label: "Open", onClick: () => routerRef.current.push(item.href as string) }
          : undefined,
      });
    };
    source.addEventListener("notification", onNotification as EventListener);
    return () => {
      source.removeEventListener("notification", onNotification as EventListener);
      source.close();
    };
  }, []);

  return { items, unreadCount };
}
