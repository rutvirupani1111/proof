import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const fieldBase = [
  "w-full rounded-xl border border-line-strong bg-surface text-ink placeholder:text-subtle",
  "shadow-[inset_0_1px_0_rgb(0_0_0/0.03)] transition-[border-color,box-shadow] duration-150",
  "hover:border-ink/30 focus-visible:border-violet focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/20",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-invalid:border-coral aria-invalid:ring-coral/15",
];

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldBase, "h-10 px-3.5 text-sm", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBase, "min-h-24 px-3.5 py-2.5 text-sm leading-relaxed", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-[13px] font-medium text-ink select-none", className)}
      {...props}
    />
  );
}

/** Label + control + hint/error, wired for accessibility. Pass the control's id as `htmlFor`. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-coral-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
