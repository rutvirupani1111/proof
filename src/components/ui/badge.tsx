import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { SealGlyph } from "./seal-glyph";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-line bg-surface-2 text-muted",
        verified: "border-verified/30 bg-verified-soft text-verified",
        violet: "border-violet/25 bg-violet-soft text-violet-text",
        coral: "border-coral/25 bg-coral-soft text-coral-text",
        outline: "border-line-strong bg-transparent text-ink",
        solid: "border-transparent bg-ink text-canvas",
      },
      mono: { true: "font-mono tracking-tight" },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  mono,
  children,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant, mono }), className)} {...props}>
      {variant === "verified" && <SealGlyph className="size-3" />}
      {children}
    </span>
  );
}
