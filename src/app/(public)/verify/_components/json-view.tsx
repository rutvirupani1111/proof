"use client";

import { Check, ChevronDown, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** Read-only, syntax-highlighted JSON with copy. Collapsed to ~14 lines until expanded. */
export function JsonView({ value, label = "Raw credential JSON" }: { value: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const parts = useMemo(() => {
    const out: { t: string; c?: string }[] = [];
    let last = 0;
    for (const m of text.matchAll(TOKEN)) {
      const i = m.index ?? 0;
      if (i > last) out.push({ t: text.slice(last, i) });
      const tok = m[0];
      const c = m[2]
        ? "text-violet-text"
        : tok.startsWith('"')
          ? "text-verified"
          : /true|false|null/.test(tok)
            ? "text-coral-text"
            : "text-ink";
      out.push({ t: tok, c });
      last = i + tok.length;
    }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out;
  }, [text]);
  const long = text.split("\n").length > 14;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2/70">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="font-mono text-[11px] tracking-[0.12em] text-subtle uppercase">{label}</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(text).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy JSON"}
        </Button>
      </div>
      <div className="relative">
        <pre
          className={cn(
            "overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-muted",
            !open && long && "max-h-[19rem] overflow-y-hidden",
          )}
          tabIndex={0}
          aria-label={label}
        >
          <code>
            {parts.map((p, i) =>
              p.c ? (
                <span key={i} className={p.c}>
                  {p.t}
                </span>
              ) : (
                p.t
              ),
            )}
          </code>
        </pre>
        {long && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface-2 to-transparent" />}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-center gap-1 border-t border-line py-2 text-xs text-muted hover:bg-surface-2 hover:text-ink"
        >
          {open ? "Collapse" : "Show the whole document"}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
    </div>
  );
}
