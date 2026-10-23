"use client";

import { Command } from "cmdk";
import { CornerDownLeft, LogOut, MoonStar, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { signOut } from "@/lib/auth/client";
import type { Portal } from "@/lib/auth/roles";
import { NAV } from "./nav-config";

const itemClass =
  "flex h-10 cursor-default items-center gap-3 rounded-lg px-3 text-sm text-ink outline-none data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-subtle";

/** ⌘K / Ctrl+K palette: jump to any page of the current portal, toggle theme, sign out. */
export function CommandPalette({
  portal,
  open,
  onOpenChange,
}: {
  portal: Portal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { resolved, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[14vh] max-w-xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search pages and actions</DialogDescription>
        <Command label="Command palette" loop className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="size-4 text-subtle" aria-hidden />
            <Command.Input
              autoFocus
              placeholder="Jump to a page or run an action…"
              className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
            />
            <Kbd>esc</Kbd>
          </div>
          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
              Nothing matches. Evidence search arrives with the recruiter portal.
            </Command.Empty>
            {NAV[portal].map((section, i) => (
              <Command.Group
                key={section.title ?? `g${i}`}
                heading={section.title ?? (i === 0 ? "Go to" : "More")}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-subtle [&_[cmdk-group-heading]]:uppercase"
              >
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={`${item.label} ${item.href}`}
                      onSelect={() => run(() => router.push(item.href))}
                      className={itemClass}
                    >
                      <Icon />
                      {item.label}
                      <CornerDownLeft className="ml-auto opacity-0 [[data-selected=true]_&]:opacity-100" />
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-subtle [&_[cmdk-group-heading]]:uppercase"
            >
              <Command.Item
                value="toggle theme dark light"
                onSelect={() => run(() => setTheme(resolved === "dark" ? "light" : "dark"))}
                className={itemClass}
              >
                <MoonStar />
                Switch to {resolved === "dark" ? "light" : "dark"} theme
              </Command.Item>
              <Command.Item
                value="sign out log out"
                onSelect={() =>
                  run(async () => {
                    await signOut();
                    router.push("/");
                    router.refresh();
                  })
                }
                className={itemClass}
              >
                <LogOut />
                Sign out
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
