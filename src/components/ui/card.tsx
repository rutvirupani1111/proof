import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const cardVariants = cva("relative rounded-[var(--radius-card)] border text-ink", {
  variants: {
    variant: {
      default: "border-line bg-surface shadow-card",
      /** Ruled paper: for evidence and dossier-style content. */
      ledger: "border-line bg-surface bg-ledger shadow-card",
      /** Lime edge for verified items. */
      verified: "border-verified/40 bg-surface shadow-card ring-1 ring-lime/30",
      flat: "border-line bg-surface-2",
      ghost: "border-dashed border-line-strong bg-transparent",
    },
    interactive: {
      true: "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Card({
  className,
  variant,
  interactive,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ variant, interactive }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("font-display text-base font-semibold leading-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm leading-relaxed text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-line px-5 py-3.5", className)}
      {...props}
    />
  );
}
