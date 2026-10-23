"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/handle";
import { SealGlyph } from "./seal-glyph";

const tints = [
  "bg-violet-soft text-violet-text",
  "bg-verified-soft text-verified",
  "bg-coral-soft text-coral-text",
  "bg-surface-3 text-ink",
];

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return tints[h % tints.length];
}

const sizes = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base", xl: "size-20 text-xl" };

export function Avatar({
  name,
  src,
  size = "md",
  verified,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  /** Adds the seal glyph at the corner. */
  verified?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <AvatarPrimitive.Root
        className={cn("inline-flex overflow-hidden rounded-full ring-1 ring-line", sizes[size])}
      >
        {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
        <AvatarPrimitive.Fallback
          delayMs={src ? 300 : 0}
          className={cn("grid size-full place-items-center font-display font-semibold", tintFor(name))}
        >
          {initials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {verified && (
        <SealGlyph className="absolute -right-0.5 -bottom-0.5 size-[38%] min-w-3.5 text-lime drop-shadow-sm" />
      )}
    </span>
  );
}
