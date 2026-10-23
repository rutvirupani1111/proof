import { describe, expect, it } from "vitest";
import { SKILL_CHECKS } from "../../../scripts/seed-data";
import { gradeSubmission } from "./sandbox";

/** Reference solutions for all twelve seeded checks: every one must score 100. */
const SOLUTIONS: Record<string, string> = {
  "chunk-array": `function chunk(items, size) { const out = []; for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size)); return out; }`,
  "is-anagram": `function isAnagram(a, b) { const n = (s) => s.toLowerCase().replace(/\\s+/g, "").split("").sort().join(""); return n(a) === n(b); }`,
  "title-case": `const titleCase = (s) => s.split(" ").map((w) => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(" ");`,
  "group-by": `function groupBy(rows, key) { const out = {}; for (const r of rows) (out[r[key]] ??= []).push(r); return out; }`,
  "flatten-deep": `function flattenDeep(arr) { const out = []; for (const x of arr) Array.isArray(x) ? out.push(...flattenDeep(x)) : out.push(x); return out; }`,
  rle: `function encode(s) { let out = ""; for (let i = 0; i < s.length;) { let j = i; while (s[j] === s[i]) j++; out += (j - i) + s[i]; i = j; } return out; }`,
  "invoice-totals": `function invoiceTotals(items) { const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0); const gst = Math.round(subtotal * 0.18); return { subtotal, gst, total: subtotal + gst }; }`,
  "retry-async": `async function retry(fn, attempts) { let last; for (let i = 0; i < attempts; i++) { try { return await fn(); } catch (e) { last = e; } } throw last; }`,
  "promise-pool": `async function mapLimit(items, limit, fn) { const out = new Array(items.length); let next = 0; async function worker() { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } } await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return out; }`,
  "debounce-pure": `function debounceTimeline(calls, wait) { const out = []; for (let i = 0; i < calls.length; i++) { const next = calls[i + 1]; if (next === undefined || next - calls[i] >= wait) out.push(calls[i] + wait); } return out; }`,
  "cart-reducer": `function cartReducer(state, action) { switch (action.type) { case "add": return { items: { ...state.items, [action.id]: (state.items[action.id] || 0) + 1 } }; case "remove": { const items = { ...state.items }; const q = (items[action.id] || 0) - 1; if (q <= 0) delete items[action.id]; else items[action.id] = q; return { items }; } case "clear": return { items: {} }; default: return state; } }`,
  "derive-visible-todos": `function visibleTodos(todos, filter) { return filter === "all" ? todos : todos.filter((t) => (filter === "done" ? t.done : !t.done)); }`,
};

const grade = (slug: string, code: string) => {
  const c = SKILL_CHECKS.find((x) => x.slug === slug)!;
  return gradeSubmission(code, c.entry, { visible: c.sample, hidden: c.hidden });
};

describe("seeded skill checks", () => {
  for (const c of SKILL_CHECKS) {
    it(`reference solution passes ${c.slug}`, async () => {
      const r = await grade(c.slug, SOLUTIONS[c.slug]!);
      expect(r.results.filter((x) => !x.passed)).toEqual([]);
      expect(r.score).toBe(100);
    });
  }
  it("the starter code fails", async () => {
    const c = SKILL_CHECKS[0]!;
    const r = await grade(c.slug, c.starter);
    expect(r.score).toBeLessThan(70);
  });
});

describe("sandbox safety", () => {
  it("stops infinite loops at the deadline", async () => {
    const r = await gradeSubmission("function f() { while (true) {} }", "f", { visible: [{ name: "x", args: [], expected: 1 }], hidden: [] });
    expect(r.results[0]!.passed).toBe(false);
    expect(r.results[0]!.error).toMatch(/Time limit/);
  });

  it("caps memory", async () => {
    const r = await gradeSubmission("function f() { const a = []; while (true) a.push(new Array(1e5).fill(1)); }", "f", { visible: [{ name: "x", args: [], expected: 1 }], hidden: [] });
    expect(r.results[0]!.passed).toBe(false);
  });

  it("has no network, fs or host access", async () => {
    const code = `function f() { return [typeof fetch, typeof require, typeof process, typeof setTimeout, typeof XMLHttpRequest]; }`;
    const r = await gradeSubmission(code, "f", { visible: [{ name: "x", args: [], expected: ["undefined", "undefined", "undefined", "undefined", "undefined"] }], hidden: [] });
    expect(r.results[0]!.passed).toBe(true);
  });

  it("never exposes hidden expected values", async () => {
    const code = `function f() { return JSON.stringify(globalThis).length; }`;
    const r = await gradeSubmission(code, "f", { visible: [], hidden: [{ name: "secret", args: [], expected: "the-answer" }] });
    expect(r.results[0]).not.toHaveProperty("got");
    expect(r.results[0]).not.toHaveProperty("expected");
  });

  it("flags a pool that ignores the concurrency limit", async () => {
    const naive = `async function mapLimit(items, limit, fn) { return Promise.all(items.map(fn)); }`;
    const r = await gradeSubmission(naive, "mapLimit", { visible: [{ name: "limit one", args: [[5, 6], 1, { __double: true }], expected: [10, 12] }], hidden: [] });
    expect(r.results[0]!.passed).toBe(false);
    expect(r.results[0]!.error).toMatch(/limit was 1/);
  });

  it("reports a missing entry function", async () => {
    const r = await gradeSubmission("const x = 1;", "chunk", { visible: [{ name: "x", args: [], expected: 1 }], hidden: [] });
    expect(r.results[0]!.error).toMatch(/Define a function named chunk/);
  });

  it("captures console.log for visible runs", async () => {
    const r = await gradeSubmission("function f(a) { console.log('got', a); return a; }", "f", { visible: [{ name: "x", args: [3], expected: 3 }], hidden: [] });
    expect(r.logs).toEqual(["got 3"]);
  });

  it("rejects an invalid entry name", async () => {
    await expect(gradeSubmission("", "x; evil()", { visible: [], hidden: [] })).rejects.toThrow();
  });
});
