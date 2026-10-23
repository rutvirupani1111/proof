"use client";

import { ClipboardPaste, FileJson } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { verifyPastedCredential } from "@/server/public/actions";
import type { VerifyView } from "@/server/public/verify";
import { VerifyResult } from "./verify-result";

/**
 * Paste a credential JSON (e.g. one a candidate emailed you) and Proof checks it against what it
 * issued and against the signature. Any edited field turns it coral.
 */
export function PasteVerifier({ initial = "" }: { initial?: string }) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [result, setResult] = useState<VerifyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    start(async () => {
      const r = await verifyPastedCredential({ document: text });
      if ("error" in r) {
        setResult(null);
        setError(r.error);
      } else {
        setResult(r);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
            <FileJson className="size-4 text-subtle" aria-hidden /> Credential JSON
          </label>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={async () => {
              try {
                setText(await navigator.clipboard.readText());
              } catch {
                setError("Clipboard access was blocked. Paste with Ctrl/⌘ + V instead.");
              }
            }}
          >
            <ClipboardPaste /> Paste
          </Button>
        </div>
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={9}
          placeholder={'{\n  "@context": ["https://www.w3.org/ns/credentials/v2"],\n  "id": "urn:proof:credential:…",\n  "proof": { "proofValue": "z…" }\n}'}
          className="block w-full resize-y bg-surface-2/40 p-4 font-mono text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-subtle focus-visible:bg-surface"
        />
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-subtle">Checked against Proof&apos;s record and the Ed25519 signature. Nothing is stored.</p>
          <Button onClick={run} loading={pending} disabled={text.trim().length < 2}>
            Verify document
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-sm text-coral-text">
          {error}
        </p>
      )}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div key={`${result.status}-${result.credentialId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <VerifyResult view={result} compact />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
