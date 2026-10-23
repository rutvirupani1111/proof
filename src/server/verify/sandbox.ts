/**
 * Skill-check grader: runs a submission against tests inside a QuickJS WASM sandbox.
 * No network, no fs, no timers; a fresh runtime per test with a memory cap, a stack cap and a
 * wall-clock deadline. Expected values never enter the sandbox (the comparison happens here),
 * so a submission cannot read the hidden answers.
 *
 * Async conventions used by the seeded checks (materialised inside the sandbox):
 *   { __failTimes: n }  an async fn that rejects n times, then resolves "ok"
 *   { __double: true }  an async fn x => x * 2 that records concurrency; when the previous
 *                       argument is a positive integer it is the concurrency limit and exceeding
 *                       it fails the test
 *   expected { __throws: true }  the call must throw / reject
 *
 * No `server-only` so it can be unit-tested; only server code imports it.
 */
import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from "quickjs-emscripten";
import { canonicalize } from "@/server/credentials/vc";

export type SandboxTest = { name: string; args: unknown[]; expected: unknown };
export type TestOutcome = {
  name: string;
  passed: boolean;
  hidden: boolean;
  ms: number;
  /** Only for visible tests. */
  got?: unknown;
  expected?: unknown;
  error?: string;
};
export type GradeResult = { passed: number; total: number; score: number; results: TestOutcome[]; logs: string[] };

export const LIMITS = { memoryBytes: 24 * 1024 * 1024, stackBytes: 512 * 1024, perTestMs: 1500, maxCodeChars: 20_000, maxLogs: 40 };

let modulePromise: Promise<QuickJSWASMModule> | undefined;
function quickjs() {
  modulePromise ??= getQuickJS().catch((err) => {
    modulePromise = undefined;
    throw err;
  });
  return modulePromise;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

function harness(code: string, entry: string, args: unknown[]): string {
  return `"use strict";
const __logs = [];
const console = { log: (...a) => { if (__logs.length < ${LIMITS.maxLogs}) __logs.push(a.map((x) => { try { return typeof x === "string" ? x : JSON.stringify(x); } catch { return String(x); } }).join(" ").slice(0, 500)); } };
console.error = console.log; console.warn = console.log; console.info = console.log;
globalThis.__out = undefined;
globalThis.__logs = __logs;
${code}
;(async () => {
  const __stringify = JSON.stringify;
  let __active = 0, __maxActive = 0;
  const __args = ${JSON.stringify(args)}.map((a) => {
    if (a && typeof a === "object" && !Array.isArray(a)) {
      if (Object.prototype.hasOwnProperty.call(a, "__failTimes")) {
        let left = Number(a.__failTimes);
        return async () => { await null; if (left > 0) { left -= 1; throw new Error("transient failure"); } return "ok"; };
      }
      if (a.__double === true) {
        return async (x) => { __active += 1; __maxActive = Math.max(__maxActive, __active); await null; await null; __active -= 1; return x * 2; };
      }
    }
    return a;
  });
  const __fn = typeof ${entry} === "function" ? ${entry} : undefined;
  if (!__fn) { globalThis.__out = __stringify({ ok: false, error: "Define a function named ${entry}." }); return; }
  try {
    const value = await __fn(...__args);
    globalThis.__out = __stringify({ ok: true, value: value === undefined ? { __undefined: true } : value, maxActive: __maxActive });
  } catch (e) {
    globalThis.__out = __stringify({ ok: false, error: String((e && e.message) || e), maxActive: __maxActive });
  }
})();`;
}

type RawRun = { ok: boolean; value?: unknown; error?: string; maxActive?: number; logs: string[] };

async function runOne(code: string, entry: string, args: unknown[]): Promise<RawRun> {
  const QuickJS = await quickjs();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(LIMITS.memoryBytes);
  runtime.setMaxStackSize(LIMITS.stackBytes);
  const deadline = Date.now() + LIMITS.perTestMs;
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline));
  const vm = runtime.newContext();
  const readLogs = () => {
    const h = vm.getProp(vm.global, "__logs");
    try {
      const v = vm.dump(h);
      return Array.isArray(v) ? (v as string[]) : [];
    } finally {
      h.dispose();
    }
  };
  try {
    const result = vm.evalCode(harness(code, entry, args), "submission.js");
    if (result.error) {
      const err = vm.dump(result.error) as { message?: string; name?: string } | string;
      result.error.dispose();
      const message = typeof err === "string" ? err : `${err?.name ?? "Error"}: ${err?.message ?? "failed"}`;
      return { ok: false, error: Date.now() >= deadline ? "Time limit exceeded" : message, logs: [] };
    }
    result.value.dispose();
    for (let i = 0; i < 10_000; i++) {
      const jobs = runtime.executePendingJobs();
      if (jobs.error) {
        const err = vm.dump(jobs.error) as { message?: string } | string;
        jobs.error.dispose();
        return { ok: false, error: Date.now() >= deadline ? "Time limit exceeded" : typeof err === "string" ? err : (err?.message ?? "failed"), logs: readLogs() };
      }
      if (jobs.value === 0) break;
      if (Date.now() >= deadline) return { ok: false, error: "Time limit exceeded", logs: readLogs() };
    }
    const outHandle = vm.getProp(vm.global, "__out");
    const out = vm.dump(outHandle);
    outHandle.dispose();
    const logs = readLogs();
    if (typeof out !== "string") {
      const timedOut = Date.now() >= deadline;
      return { ok: false, error: timedOut ? "Time limit exceeded" : "The function never settled (a promise that never resolves?)", logs };
    }
    return { ...(JSON.parse(out) as Omit<RawRun, "logs">), logs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: /memory/i.test(msg) ? "Memory limit exceeded" : msg.slice(0, 200), logs: [] };
  } finally {
    try {
      vm.dispose();
      runtime.dispose();
    } catch {
      // A runtime that hit its memory cap can fail to dispose cleanly; it is garbage either way.
    }
  }
}

function concurrencyLimit(args: unknown[]): number | null {
  const i = args.findIndex((a) => !!a && typeof a === "object" && (a as Record<string, unknown>).__double === true);
  const prev = i > 0 ? args[i - 1] : undefined;
  return typeof prev === "number" && Number.isInteger(prev) && prev > 0 ? prev : null;
}

function isThrowsMarker(v: unknown) {
  return !!v && typeof v === "object" && (v as Record<string, unknown>).__throws === true;
}

/**
 * Grades `code` against tests. `visible` tests report what the code returned; hidden tests only
 * report pass/fail. Score is the percentage of all tests passed.
 */
export async function gradeSubmission(
  code: string,
  entry: string,
  tests: { visible: SandboxTest[]; hidden: SandboxTest[] },
): Promise<GradeResult> {
  if (!IDENT.test(entry)) throw new Error("Invalid entry function name.");
  if (code.length > LIMITS.maxCodeChars) {
    const all = [...tests.visible, ...tests.hidden];
    return { passed: 0, total: all.length, score: 0, logs: [], results: all.map((t, i) => ({ name: t.name, passed: false, hidden: i >= tests.visible.length, ms: 0, error: "Submission too large" })) };
  }
  const results: TestOutcome[] = [];
  let logs: string[] = [];
  const all = [...tests.visible.map((t) => ({ t, hidden: false })), ...tests.hidden.map((t) => ({ t, hidden: true }))];
  for (const { t, hidden } of all) {
    const started = Date.now();
    const run = await runOne(code, entry, t.args);
    const ms = Date.now() - started;
    if (!hidden && logs.length < LIMITS.maxLogs) logs = logs.concat(run.logs).slice(0, LIMITS.maxLogs);
    let passed: boolean;
    let error = run.error;
    if (isThrowsMarker(t.expected)) {
      passed = !run.ok && !/limit exceeded|Define a function/.test(run.error ?? "");
      if (run.ok) error = "Expected the call to throw, but it returned.";
      else if (passed) error = undefined;
    } else {
      passed = run.ok && canonicalize(run.value) === canonicalize(t.expected);
      const limit = concurrencyLimit(t.args);
      if (passed && limit != null && (run.maxActive ?? 0) > limit) {
        passed = false;
        error = `Ran ${run.maxActive} tasks at once; the limit was ${limit}.`;
      }
    }
    results.push({
      name: t.name,
      passed,
      hidden,
      ms,
      ...(hidden ? {} : { got: run.ok ? run.value : undefined, expected: t.expected }),
      ...(error && !passed ? { error: hidden && !/limit|Define/.test(error) ? "Wrong result on a hidden test" : error } : {}),
    });
  }
  const passedCount = results.filter((r) => r.passed).length;
  return {
    passed: passedCount,
    total: results.length,
    score: results.length ? Math.round((passedCount / results.length) * 100) : 0,
    results,
    logs,
  };
}
