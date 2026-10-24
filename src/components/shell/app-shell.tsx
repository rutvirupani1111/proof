"use client";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { DemoRoleSwitcher } from "@/components/demo/demo-role-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Portal } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { NAV, PORTAL_TITLE } from "./nav-config";
import { NotificationsBell, type ShellNotification } from "./notifications-bell";
import { useLiveNotifications } from "./use-live-notifications";
import { UserMenu, type ShellUser } from "./user-menu";

export type AppShellProps = {
  portal: Portal;
  user: ShellUser;
  notifications: ShellNotification[];
  unreadCount: number;
  /** Server render time: the live stream starts from here so nothing between render and connect is lost. */
  notificationsSince: string;
  children: ReactNode;
};

function isActive(pathname: string, href: string, portal: Portal) {
  return href === `/${portal}` ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({ portal, onNavigate }: { portal: Portal; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label={`${PORTAL_TITLE[portal]} navigation`} className="flex flex-col gap-5">
      {NAV[portal].map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-0.5">
          {section.title && (
            <p className="mb-1 px-3 font-mono text-[10.5px] tracking-[0.14em] text-subtle uppercase">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const active = isActive(pathname, item.href, portal);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-2.5 rounded-xl lg:h-9 px-3 text-sm font-medium transition-colors",
                  active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-lime" aria-hidden />}
                <Icon className={cn("size-4 shrink-0", active ? "text-ink" : "text-subtle group-hover:text-ink")} aria-hidden />
                <span className="truncate">{item.label}</span>
                {item.soon && (
                  <span className="ml-auto font-mono text-[9.5px] tracking-wider text-subtle uppercase">soon</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ portal, user, notifications, unreadCount, notificationsSince, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const live = useLiveNotifications(notifications, unreadCount, notificationsSince);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-canvas px-3 pt-4 pb-3 lg:flex print:hidden">
        <div className="flex items-center justify-between px-2 pb-6">
          <Logo href={`/${portal}`} />
          <Badge variant="outline" mono className="text-[10px] tracking-wider uppercase">
            {PORTAL_TITLE[portal]}
          </Badge>
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <SidebarNav portal={portal} />
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <UserMenu user={user} variant="sidebar" />
        </div>
      </aside>

      {/* Mobile nav */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="px-3 pt-4 pb-3">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">{PORTAL_TITLE[portal]} portal pages</SheetDescription>
          <div className="px-2 pb-6">
            <Logo href={`/${portal}`} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav portal={portal} onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <UserMenu user={user} variant="sidebar" />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64 print:pl-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-canvas/80 px-4 backdrop-blur-md sm:px-6 print:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <Logo href={`/${portal}`} className="lg:hidden" />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-10 min-w-10 items-center justify-center gap-2 sm:h-9 sm:justify-start rounded-xl border border-line bg-surface px-3 text-sm text-subtle transition-colors hover:border-line-strong hover:text-muted sm:w-72 lg:ml-0"
            aria-label="Open command palette"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search or jump to…</span>
            <span className="ml-auto hidden items-center gap-0.5 sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>

          <div className="flex items-center gap-1 lg:ml-auto">
            <ThemeToggle />
            <NotificationsBell items={live.items} unreadCount={live.unreadCount} />
            <UserMenu user={user} variant="avatar" />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>

      <CommandPalette portal={portal} open={paletteOpen} onOpenChange={setPaletteOpen} />
      <DemoRoleSwitcher email={user.email} />
    </div>
  );
}
