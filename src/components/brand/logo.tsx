import Link from "next/link";
import { cn } from "@/lib/utils";
import { SealGlyph } from "@/components/ui/seal-glyph";

/** Wordmark: seal glyph + "proof". */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2 rounded-lg font-display text-lg font-bold tracking-tight", className)}
      aria-label="Proof home"
    >
      <SealGlyph className="size-6 text-lime transition-transform duration-300 group-hover:-rotate-12" />
      <span>proof</span>
    </Link>
  );
}
