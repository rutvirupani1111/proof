"use client";

import { BookCheck, FileSignature, GitBranch, GitCommitHorizontal, Globe, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { springs } from "@/components/motion/transitions";
import { Seal, useStampShake } from "@/components/ui/seal";
import { cn } from "@/lib/utils";

type Step = { icon: LucideIcon; title: string; body: string; Demo: () => ReactNode };

const STEP_MS = 5600;

const STEPS: Step[] = [
  {
    icon: GitBranch,
    title: "Prove the GitHub account is yours",
    body: "Post a public proof.md gist with your Proof handle and a one-time nonce. We fetch it from GitHub's API. No OAuth, no screenshots.",
    Demo: GistDemo,
  },
  {
    icon: GitCommitHorizontal,
    title: "Measure what you actually wrote",
    body: "For each repo you pick: your own commits, authorship share, active weeks and languages. Bulk-imported or backdated history gets flagged.",
    Demo: AuthorshipDemo,
  },
  {
    icon: Globe,
    title: "Confirm the project is live",
    body: "Add a meta tag or /.well-known/proof.txt to your site. We fetch it, match the token, and keep checking it stays up.",
    Demo: DeployDemo,
  },
  {
    icon: BookCheck,
    title: "Pass a timed skill check",
    body: "Write code in the browser; it runs server-side in a QuickJS sandbox against hidden tests. Paste and tab-switch signals are shown, never auto-penalised.",
    Demo: CheckDemo,
  },
  {
    icon: FileSignature,
    title: "Get a signed, checkable seal",
    body: "Each verified item becomes an Ed25519-signed W3C Verifiable Credential with a public /verify link and QR. Mentors can endorse on top.",
    Demo: CredentialDemo,
  },
];

/** Five verification steps, each with a small live demo. Auto-advances while visible. */
export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const playing = auto && inView && !reduce;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % STEPS.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, active]);

  const step = STEPS[active]!;
  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10">
      <div role="tablist" aria-label="Verification steps" aria-orientation="vertical" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {STEPS.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.title}
              role="tab"
              type="button"
              id={`hiw-tab-${i}`}
              aria-selected={on}
              aria-controls="hiw-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => {
                setActive(i);
                setAuto(false);
              }}
              onKeyDown={(e) => {
                if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) {
                  e.preventDefault();
                  const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
                  const next = (active + d + STEPS.length) % STEPS.length;
                  setActive(next);
                  setAuto(false);
                  document.getElementById(`hiw-tab-${next}`)?.focus();
                }
              }}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-2xl border text-left transition-colors lg:w-full",
                on ? "border-line-strong bg-surface shadow-card" : "border-transparent hover:bg-surface-2/70",
              )}
            >
              <div className="flex items-center gap-3 px-4 py-3 lg:items-start lg:py-4">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-xl font-mono text-xs transition-colors",
                    on ? "bg-lime text-lime-ink" : "bg-surface-2 text-muted",
                  )}
                >
                  0{i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-semibold whitespace-nowrap lg:whitespace-normal", !on && "text-muted")}>{s.title}</span>
                  <span className={cn("hidden text-[13px] leading-relaxed text-muted", on && "lg:mt-1 lg:block")}>{s.body}</span>
                </span>
              </div>
              {on && playing && (
                <motion.span
                  key={`bar-${active}`}
                  className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-lime"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div id="hiw-panel" role="tabpanel" aria-labelledby={`hiw-tab-${active}`} className="min-w-0">
        <p className="mb-4 text-sm leading-relaxed text-muted lg:hidden">{step.body}</p>
        <div className="relative overflow-hidden rounded-[1.4rem] border border-line bg-surface bg-ledger p-4 shadow-pop sm:p-6">
          <div className="mb-4 flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="ml-3 font-mono text-[11px] text-subtle">proof · step {active + 1} of 5</span>
          </div>
          <div className="min-h-[17.5rem]">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
                <step.Demo />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- demos ---------------------------------- */

const appear = (delay: number) => ({
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0 },
  transition: { delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
});

function Ok({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <motion.p {...appear(delay)} className="flex items-center gap-2 font-mono text-[12.5px] text-verified">
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springs.stamp, delay }} className="grid size-4 place-items-center rounded-full bg-lime text-[10px] text-lime-ink">
        ✓
      </motion.span>
      {children}
    </motion.p>
  );
}

function Typed({ text, delay, className }: { text: string; delay: number; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((ch, i) => (
        <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + i * 0.022, duration: 0.01 }} aria-hidden>
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

function GistDemo() {
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-line bg-surface-2/60 p-4">
        <p className="font-mono text-[11px] text-subtle">gist.github.com/proofdemo-ishita · proof.md</p>
        <p className="mt-3 font-mono text-[13px] leading-relaxed">
          <Typed text="I am @ishita-varma on Proof." delay={0.1} />
          <br />
          <span className="text-subtle">nonce: </span>
          <Typed text="7f3k-92ab-qx4d" delay={0.8} className="rounded bg-violet-soft px-1 text-violet-text" />
        </p>
      </div>
      <div className="grid gap-2">
        <Ok delay={1.3}>GET api.github.com/users/proofdemo-ishita/gists</Ok>
        <Ok delay={1.7}>proof.md found · handle matches</Ok>
        <Ok delay={2.1}>nonce matches · ETag cached</Ok>
      </div>
    </div>
  );
}

const WEEKS = [3, 5, 2, 7, 6, 9, 4, 8, 10, 6, 7, 11, 5, 9, 12, 8];

function AuthorshipDemo() {
  return (
    <div className="grid gap-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[12px] text-subtle">proofdemo-ishita/tiffin-tracker</p>
        <p className="font-mono text-[11px] text-subtle">16 weeks</p>
      </div>
      <div className="flex h-28 items-end gap-1.5" aria-hidden>
        {WEEKS.map((v, i) => (
          <motion.span
            key={i}
            className="flex-1 origin-bottom rounded-t-md bg-lime"
            style={{ height: `${(v / 12) * 100}%`, opacity: 0.45 + (v / 12) * 0.55 }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ ...springs.gentle, delay: 0.1 + i * 0.05 }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-dashed border-line-strong pt-3">
        {[
          ["own commits", "41"],
          ["authorship", "87%"],
          ["active weeks", "22"],
        ].map(([k, v], i) => (
          <motion.div key={k} {...appear(0.9 + i * 0.12)}>
            <dt className="text-[11px] text-subtle">{k}</dt>
            <dd className="font-display text-2xl font-semibold tabular">{v}</dd>
          </motion.div>
        ))}
      </dl>
      <Ok delay={1.4}>no bulk import · no backdated history</Ok>
    </div>
  );
}

function DeployDemo() {
  return (
    <div className="grid gap-4">
      <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2/60 p-4 font-mono text-[12px] leading-relaxed">
        <span className="text-subtle">&lt;!-- tiffin-tracker.example/index.html --&gt;</span>
        {"\n"}
        <span className="text-violet-text">&lt;meta</span> name=<span className="text-verified">&quot;proof-verification&quot;</span>
        {"\n      "}content=<Typed text={'"prf_8c1e02d94ab7"'} delay={0.2} className="text-verified" />
        <span className="text-violet-text"> /&gt;</span>
      </pre>
      <motion.div {...appear(0.9)} className="flex items-center justify-between rounded-xl border border-line bg-surface p-3">
        <span className="flex min-w-0 items-center gap-2 font-mono text-[12px]">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-lime" />
          </span>
          <span className="truncate">GET https://tiffin-tracker.example</span>
        </span>
        <span className="shrink-0 font-mono text-[12px] text-verified">200 OK · 182 ms</span>
      </motion.div>
      <div className="grid gap-2">
        <Ok delay={1.3}>token matches · repo homepage matches</Ok>
        <Ok delay={1.7}>health re-checked daily</Ok>
      </div>
    </div>
  );
}

const TESTS = ["returns [] for empty input", "retries a failing call 3 times", "gives up after the limit", "keeps original order", "handles 10k items under 50 ms", "rejects non-array input"];

function CheckDemo() {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[12px] text-subtle">Async retry · intermediate · hidden tests</p>
        <p className="font-mono text-[12px] text-subtle">14:02</p>
      </div>
      <ul className="grid gap-1.5">
        {TESTS.map((t, i) => (
          <motion.li key={t} {...appear(0.15 + i * 0.22)} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12px]">
            <motion.span
              initial={{ backgroundColor: "var(--surface-2)" }}
              animate={{ backgroundColor: "var(--lime)" }}
              transition={{ delay: 0.3 + i * 0.22, duration: 0.2 }}
              className="grid size-4 shrink-0 place-items-center rounded-full text-[10px] text-lime-ink"
            >
              ✓
            </motion.span>
            <span className="truncate">{t}</span>
          </motion.li>
        ))}
      </ul>
      <Ok delay={1.8}>6/6 passed in the QuickJS sandbox · score 100</Ok>
    </div>
  );
}

function CredentialDemo() {
  const [scope, shake] = useStampShake();
  return (
    <div ref={scope} className="relative grid gap-3">
      <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2/60 p-4 font-mono text-[11.5px] leading-relaxed text-muted">
        {"{\n"}
        {'  "type": ['}
        <span className="text-verified">&quot;VerifiableCredential&quot;</span>
        {"],\n"}
        {'  "issuer": { "id": '}
        <span className="text-verified">&quot;urn:proof:platform&quot;</span>
        {" },\n"}
        {'  "credentialSubject": {\n    "claim": '}
        <span className="text-verified">&quot;41 own commits in tiffin-tracker&quot;</span>
        {"\n  },\n"}
        {'  "proof": { "cryptosuite": '}
        <span className="text-verified">&quot;eddsa-jcs-2022&quot;</span>
        {",\n    "}
        {'"proofValue": '}
        <span className="text-violet-text">&quot;z3FXQjecWufY46…&quot;</span>
        {" }\n}"}
      </pre>
      <motion.p {...appear(1.2)} className="font-mono text-[12px] text-subtle">
        proof.example/verify/<span className="text-ink">c_8f1e…</span> · QR attached
      </motion.p>
      <div className="absolute -right-1 -bottom-3 sm:right-2">
        <Seal size={104} stamp="mount" delay={0.55} onLand={shake} />
      </div>
    </div>
  );
}
