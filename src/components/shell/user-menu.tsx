"use client";

import { ChevronsUpDown, ExternalLink, LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/client";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";

export type ShellUser = {
  name: string;
  email: string;
  image: string | null;
  role: Role;
  domainVerification: string;
  /** Student handle, for the "view public profile" link. */
  handle?: string | null;
};

export function UserMenu({ user, variant }: { user: ShellUser; variant: "sidebar" | "avatar" }) {
  const router = useRouter();
  const pending = user.domainVerification === "pending";

  return (
    <DropdownMenu>
      {variant === "sidebar" ? (
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2">
          <Avatar name={user.name} src={user.image} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.email}</span>
          </span>
          <ChevronsUpDown className="size-4 text-subtle" aria-hidden />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="grid size-10 place-items-center rounded-full lg:hidden" aria-label="Account menu">
          <Avatar name={user.name} src={user.image} size="sm" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"}>
        <DropdownMenuLabel>{ROLE_LABEL[user.role]}</DropdownMenuLabel>
        <div className="px-2.5 pb-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        {pending && (
          <div className="mx-1 mb-1 flex items-start gap-2 rounded-lg bg-coral-soft px-2.5 py-2 text-xs text-coral-text">
            <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            Email domain not verified yet. Verification arrives soon.
          </div>
        )}
        <DropdownMenuSeparator />
        {user.handle && (
          <DropdownMenuItem asChild>
            <Link href={`/u/${user.handle}`}>
              <ExternalLink />
              View public profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          destructive
          onSelect={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
