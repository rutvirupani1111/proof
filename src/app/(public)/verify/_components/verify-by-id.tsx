"use client";

import { ArrowRight, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

/** Jump to /verify/{id}; accepts a bare id or a full /verify/ URL. */
export function VerifyById() {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const credentialId = value.trim().split(/[/:#?]/).filter(Boolean).at(-1) ?? "";
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (credentialId) router.push(`/verify/${encodeURIComponent(credentialId)}`);
      }}
    >
      <label htmlFor={id} className="sr-only">
        Credential id or link
      </label>
      <div className="relative flex-1">
        <Hash className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Credential id or verify link"
          autoComplete="off"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border border-line-strong bg-surface pr-4 pl-10 font-mono text-sm outline-none placeholder:font-sans placeholder:text-subtle focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <Button size="lg" type="submit" variant="ink" disabled={!credentialId}>
        Check <ArrowRight />
      </Button>
    </form>
  );
}
