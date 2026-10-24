"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Small icon button that copies `value` and flips to a check for a moment. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // Clipboard blocked (insecure origin or permissions): nothing to do.
        }
      }}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-ink",
        copied && "text-verified hover:text-verified",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}
