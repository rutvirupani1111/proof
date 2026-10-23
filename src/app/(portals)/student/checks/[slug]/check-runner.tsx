"use client";

import { ArrowLeft, CheckCircle2, ClipboardPaste, Clock, EyeOff, Lock, Play, Send, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { useTheme } from "@/components/theme/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import { runSamplesAction, startAttemptAction, submitAttemptAction, type Moment } from "@/server/student/proof-actions";
import type { GradeResult } from "@/server/verify/sandbox";
import { SealMoment } from "../../_components/seal-moment";

/** Monaco is ~2 MB: loaded only when a check starts, never on the server. */
const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

type Check = {
  slug: string;
  title: string;
  level: string;
  prompt: string;
  starterCode: string;
  entryFunction: string;
  sampleTests: { name: string; args: unknown[]; expected: unknown }[];
  timeLimitSec: number;
  skill: string | null;
  hiddenCount: number;
};
type HistoryRow = { id: string; status: string; score: number | null; submittedAt: string | null; timeTakenSec: number | null };

function Prompt({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <p className="text-[15px] leading-relaxed text-pretty">
      {parts.map((p, i) =>
        p.startsWith("`") ? (
          <code key={i} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </p>
  );
}

const fmt = (v: unknown) => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

function useCountdown(startedAt: string | null, limitSec: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return limitSec;
  return Math.max(0, Math.round(limitSec - (now - new Date(startedAt).getTime()) / 1000));
}

export function CheckRunner({ check, initialCode, best, history }: { check: Check; initialCode: string; best: number | null; history: HistoryRow[] }) {
  const { resolved } = useTheme();
  const router = useRouter();
  const [attempt, setAttempt] = useState<{ id: string; startedAt: string } | null>(null);
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<(GradeResult & { kind: "samples" | "submit"; verdict?: boolean; overtime?: boolean }) | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const paste = useRef(0);
  const blurs = useRef(0);
  const [signals, setSignals] = useState({ paste: 0, blurs: 0 });
  const [starting, startStart] = useTransition();
  const [running, startRun] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const remaining = useCountdown(attempt?.startedAt ?? null, check.timeLimitSec);

  useEffect(() => {
    if (!attempt) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        blurs.current += 1;
        setSignals((s) => ({ ...s, blurs: blurs.current }));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [attempt]);

  const begin = useCallback(() => {
    startStart(async () => {
      const res = await startAttemptAction({ slug: check.slug });
      if (!res.ok) return void toast.error(res.error);
      paste.current = 0;
      blurs.current = 0;
      setSignals({ paste: 0, blurs: 0 });
      setResult(null);
      setAttempt({ id: res.attemptId, startedAt: res.startedAt });
    });
  }, [check.slug]);

  const runSamples = () =>
    startRun(async () => {
      const res = await runSamplesAction({ slug: check.slug, code });
      if (!res.ok) return void toast.error(res.error);
      setResult({ ...res.result, kind: "samples" });
    });

  const submit = () =>
    startSubmit(async () => {
      if (!attempt) return;
      const res = await submitAttemptAction({ attemptId: attempt.id, code, pasteEvents: paste.current, tabBlurs: blurs.current });
      if (!res.ok) return void toast.error(res.error);
      setResult({ ...res.result, kind: "submit", verdict: res.passed, overtime: res.overtime });
      setAttempt(null);
      if (res.passed && res.moment) setMoment(res.moment);
      else if (res.overtime) toast.warning("Submitted after the time limit: recorded, not counted.");
      router.refresh();
    });

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const low = attempt && remaining <= 60;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/student/checks">
            <ArrowLeft /> All checks
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {best != null && (
            <Badge variant={best >= 70 ? "verified" : "neutral"} mono>
              best {best}
            </Badge>
          )}
          <motion.div
            animate={low ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={low ? { repeat: Infinity, duration: 1 } : springs.snappy}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm tabular",
              low ? "border-coral/40 bg-coral-soft text-coral-text" : attempt ? "border-verified/30 bg-verified-soft text-verified" : "border-line bg-surface-2 text-muted",
            )}
            aria-live="polite"
            aria-label={`Time remaining ${mm}:${ss}`}
          >
            <Clock className="size-3.5" /> {mm}:{ss}
          </motion.div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Card variant="ledger" className="p-5">
            <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">
              {check.level} · {check.skill ?? "JavaScript"}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{check.title}</h1>
            <div className="mt-3">
              <Prompt text={check.prompt} />
            </div>
            <p className="mt-4 text-xs text-muted">
              Define <code className="font-mono">{check.entryFunction}</code>. {check.sampleTests.length} sample + {check.hiddenCount} hidden tests. Pass mark 70%.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-medium">Examples</h2>
            <ul className="mt-2 grid gap-2">
              {check.sampleTests.map((t) => (
                <li key={t.name} className="overflow-x-auto rounded-xl border border-line bg-surface-2 p-2.5 font-mono text-xs">
                  <span className="text-muted">{check.entryFunction}(</span>
                  {t.args.map((a) => fmt(a)).join(", ")}
                  <span className="text-muted">)</span>
                  <br />
                  <span className="text-subtle">→ </span>
                  {fmt(t.expected)}
                </li>
              ))}
            </ul>
          </Card>
          {attempt && (
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1">
                <ClipboardPaste className="size-3" /> {signals.paste} pastes
              </span>
              <span className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1">
                <EyeOff className="size-3" /> {signals.blurs} tab switches
              </span>
              <span className="text-subtle">Shown to recruiters, never penalised.</span>
            </div>
          )}
          {history.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-medium">Your attempts</h2>
              <ul className="mt-2 grid gap-1.5 text-xs">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <span className="capitalize text-muted">{h.status.replace("_", " ")}</span>
                    <span className="font-mono tabular">{h.score != null ? `${h.score}%` : "—"}</span>
                    <span className="text-subtle">{h.submittedAt ? timeAgo(h.submittedAt) : "open"}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Card className="relative overflow-hidden">
            <div className="h-[52vh] min-h-80 lg:h-[30rem]">
              {attempt ? (
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  value={code}
                  onChange={(v) => setCode(v ?? "")}
                  theme={resolved === "dark" ? "vs-dark" : "light"}
                  onMount={(editor) => {
                    editor.onDidPaste(() => {
                      paste.current += 1;
                      setSignals((s) => ({ ...s, paste: paste.current }));
                    });
                    editor.focus();
                  }}
                  options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: "JetBrains Mono Variable, monospace", scrollBeyondLastLine: false, tabSize: 2, automaticLayout: true, padding: { top: 12 } }}
                />
              ) : (
                <div className="grid h-full place-items-center bg-ledger p-6 text-center">
                  <div className="max-w-xs">
                    <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-line bg-surface shadow-card">
                      <Lock className="size-5 text-muted" />
                    </span>
                    <p className="font-display text-lg font-semibold">{Math.round(check.timeLimitSec / 60)} minutes on the clock</p>
                    <p className="mt-1 text-sm text-muted">The timer starts when you open the editor. You can run the examples as often as you like.</p>
                    <Button className="mt-5" size="lg" onClick={begin} loading={starting}>
                      {history.some((h) => h.status === "in_progress") ? "Resume attempt" : history.length ? "Start a new attempt" : "Start the check"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {attempt && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-3">
                <Button variant="secondary" onClick={runSamples} loading={running}>
                  <Play /> Run examples
                </Button>
                <Button onClick={submit} loading={submitting}>
                  <Send /> Submit for grading
                </Button>
              </div>
            )}
          </Card>

          <AnimatePresence mode="wait">
            {result && (
              <motion.div key={`${result.kind}-${result.verdict}-${result.score}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.gentle}>
                <Card variant={result.kind === "submit" && result.verdict ? "verified" : "default"} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-base font-semibold">
                      {result.kind === "samples" ? "Example run" : result.verdict ? "Passed" : result.overtime ? "Over time" : "Not passed yet"}
                    </h2>
                    <Badge variant={result.verdict || (result.kind === "samples" && result.score === 100) ? "verified" : "coral"} mono>
                      {result.passed} / {result.total} · {result.score}%
                    </Badge>
                  </div>
                  <ul className="mt-3 grid gap-1.5">
                    {result.results.map((r, i) => (
                      <motion.li
                        key={`${r.name}-${i}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...springs.snappy, delay: i * 0.04 }}
                        className="grid gap-1 rounded-xl border border-line px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {r.passed ? <CheckCircle2 className="size-4 text-verified" /> : <XCircle className="size-4 text-coral-text" />}
                          <span className="flex-1 truncate">{r.hidden ? `Hidden: ${r.name}` : r.name}</span>
                          <span className="font-mono text-[11px] text-subtle">{r.ms} ms</span>
                        </div>
                        {!r.passed && (
                          <p className="pl-6 font-mono text-xs break-all text-muted">
                            {r.error ?? (!r.hidden ? `got ${fmt(r.got)}, expected ${fmt(r.expected)}` : "")}
                          </p>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                  {result.logs.length > 0 && (
                    <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs">{result.logs.join("\n")}</pre>
                  )}
                  {result.kind === "submit" && !result.verdict && (
                    <Button className="mt-4" variant="secondary" onClick={begin} loading={starting}>
                      Try again
                    </Button>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <SealMoment data={moment} onClose={() => setMoment(null)} />
    </div>
  );
}
