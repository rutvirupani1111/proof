import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium select-none",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** The verified lime. One per view. */
        primary:
          "bg-lime text-lime-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)] hover:brightness-[1.04] hover:shadow-[inset_0_-2px_0_rgb(0_0_0/0.12),0_6px_20px_-8px_var(--lime)]",
        secondary:
          "border border-line-strong bg-surface text-ink shadow-[0_1px_0_var(--line)] hover:bg-surface-2",
        ghost: "text-muted hover:bg-surface-2 hover:text-ink",
        ink: "bg-ink text-canvas hover:bg-ink/90",
        violet: "bg-violet text-white hover:bg-violet/90",
        danger: "bg-coral text-white hover:bg-coral/90",
        link: "h-auto px-0 text-violet-text underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-10 rounded-xl px-4 text-sm [&_svg]:size-4",
        lg: "h-12 rounded-2xl px-6 text-[15px] [&_svg]:size-[18px]",
        icon: "size-9 rounded-xl [&_svg]:size-[18px]",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a <Link>) with button styles. */
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <LoaderCircle className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
