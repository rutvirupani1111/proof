#!/usr/bin/env node
/**
 * Responsive audit. Run against `npm run build && npm start` (port 5190) on the local PGlite seed:
 *
 *   node scripts/screens.mjs [--base http://localhost:5190] [--only public,student,...]
 *
 * For every public page and every portal page (one sign-in per role, spaced 4.5 s apart for the
 * sign-in rate limit) it screenshots 375x812, 768x1024 and 1280x820 into docs/screens/ and records
 * horizontal overflow (document.scrollWidth > innerWidth, with the widest offenders), console
 * errors, and visible tap targets under 40 px at 375. Writes docs/screens/report.json and exits 1
 * when any page overflows.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:5190");
const ONLY = arg("only", "")?.split(",").filter(Boolean);
const OUT = join(process.cwd(), "docs", "screens");
// Seeded demo accounts (README "Demo logins"); the shared demo password is public.
const PASSWORD = process.env.PROOF_DEMO_PASSWORD ?? "proof-demo-2026";
const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 820 },
];

const ROLES = [
  { role: "public", pages: ["/", "/about", "/for-recruiters", "/for-colleges", "/pricing", "/u/ishita-varma", "/verify", "@verify", "/login", "/signup"] },
  {
    role: "student",
    email: "ishita@spit-surat.example",
    pages: ["/student", "/student/onboarding", "/student/proofs", "/student/checks", "@check", "/student/profile", "/student/jobs", "/student/applications"],
  },
  {
    role: "recruiter",
    email: "meera@kitecode.example",
    pages: ["/recruiter", "/recruiter/search", "@candidate", "/recruiter/shortlists", "/recruiter/pipeline", "/recruiter/compare", "/recruiter/jobs", "/recruiter/messages", "/recruiter/company"],
  },
  {
    role: "college",
    email: "placements@spit-surat.example",
    pages: ["/college", "/college/cohort", "/college/drives", "@drive", "/college/nudges", "/college/stats", "/college/settings"],
  },
  {
    role: "mentor",
    email: "anand.mehta@spit-surat.example",
    pages: ["/mentor", "/mentor/requests", "/mentor/endorsements", "/mentor/verify", "/mentor/settings"],
  },
];

/** Dynamic routes resolve to the first matching link on a listing page. */
const DYNAMIC = {
  "@verify": { from: "/u/ishita-varma", match: /^\/verify\/[^/]+$/ },
  "@check": { from: "/student/checks", match: /^\/student\/checks\/[^/]+$/ },
  "@candidate": { from: "/recruiter/search", match: /^\/recruiter\/candidates\/[^/]+$/ },
  "@drive": { from: "/college/drives", match: /^\/college\/drives\/[^/]+$/ },
};

function chromePath() {
  const local = process.env.LOCALAPPDATA ?? "";
  const candidates = [
    process.env.CHROME_PATH,
    join(local, "ms-playwright", "chromium-1228", "chrome-win64", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((p) => p && existsSync(p));
}

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ executablePath: chromePath() });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastSignIn = 0;

async function signIn(context, email) {
  const wait = 4500 - (Date.now() - lastSignIn);
  if (wait > 0) await sleep(wait);
  lastSignIn = Date.now();
  const res = await context.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email, password: PASSWORD },
    headers: { origin: BASE },
  });
  if (!res.ok()) throw new Error(`sign-in ${email} failed: HTTP ${res.status()}`);
}

async function resolveDynamic(page, key) {
  const { from, match } = DYNAMIC[key];
  await page.goto(`${BASE}${from}`, { waitUntil: "networkidle" });
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  return hrefs.find((h) => h && match.test(h.split("?")[0])) ?? null;
}

/** Runs in the page: overflow offenders and small tap targets. */
function measure() {
  const vw = window.innerWidth;
  const sw = document.documentElement.scrollWidth;
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 4).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 140);
  };
  const offenders = [];
  if (sw > vw) {
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      // Skip children of an element that already scrolls/clips horizontally.
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox !== "visible") { clipped = true; break; }
      }
      if (!clipped) offenders.push({ el: describe(el), right: Math.round(r.right) });
      if (offenders.length > 40) break;
    }
  }
  const small = [];
  for (const el of document.querySelectorAll("a[href], button, [role=button], input:not([type=hidden]), select, [role=tab], [role=checkbox], [role=switch]")) {
    // A visually hidden skip link is not a target until it is focused (then it is 40 px tall).
    if (el.classList.contains("sr-only")) continue;
    // A checkbox or radio inside a <label> is tapped through its label, so the label is the target.
    const isToggle = el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio");
    const r = (isToggle && el.closest("label") ? el.closest("label") : el).getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") continue;
    // Inline text links inside running copy are exempt (WCAG 2.5.8 inline exception).
    if (el.tagName === "A" && s.display === "inline") continue;
    if (r.height < 40 || r.width < 40) {
      const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      small.push(`${describe(el).slice(0, 60)} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  return { scrollWidth: sw, innerWidth: vw, overflow: sw > vw, offenders: offenders.slice(0, 6), smallTargets: small };
}

async function auditRole(browser, spec, report) {
  const context = await browser.newContext({ viewport: VIEWPORTS[0], reducedMotion: "reduce" });
  if (spec.email) await signIn(context, spec.email);
  const page = await context.newPage();
  let errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));

  for (const entry of spec.pages) {
    const path = entry.startsWith("@") ? await resolveDynamic(page, entry) : entry;
    if (!path) {
      report.push({ role: spec.role, path: entry, missing: true });
      console.log(`  ${spec.role} ${entry}: no link found`);
      continue;
    }
    for (const vp of VIEWPORTS) {
      errors = [];
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch((e) => ({ status: () => String(e) }));
      await sleep(400);
      const m = await page.evaluate(measure);
      const slug = `${spec.role}${path.replace(/[/?=&]+/g, "_")}`.replace(/_+$/, "");
      await page.screenshot({ path: join(OUT, `${slug}@${vp.name}.png`), fullPage: true });
      const row = {
        role: spec.role,
        path,
        viewport: vp.name,
        status: res?.status?.(),
        finalUrl: page.url().replace(BASE, ""),
        overflow: m.overflow,
        scrollWidth: m.scrollWidth,
        offenders: m.offenders,
        consoleErrors: errors,
        smallTargets: vp.name === "375" ? m.smallTargets : undefined,
      };
      report.push(row);
      const flag = m.overflow ? ` OVERFLOW ${m.scrollWidth}>${m.innerWidth}` : "";
      const err = errors.length ? ` errors:${errors.length}` : "";
      const tap = vp.name === "375" && m.smallTargets.length ? ` small:${m.smallTargets.length}` : "";
      console.log(`  ${vp.name.padStart(4)} ${spec.role} ${path} [${row.status}]${flag}${err}${tap}`);
    }
  }
  await context.close();
}

mkdirSync(OUT, { recursive: true });
const browser = await launch();
const report = [];
try {
  for (const spec of ROLES) {
    if (ONLY.length && !ONLY.includes(spec.role)) continue;
    console.log(`${spec.role}`);
    await auditRole(browser, spec, report);
  }
} finally {
  await browser.close();
}
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
const over = report.filter((r) => r.overflow);
const errs = report.filter((r) => r.consoleErrors?.length);
const smallTotal = report.reduce((n, r) => n + (r.smallTargets?.length ?? 0), 0);
console.log(`\n${report.length} captures, ${over.length} overflowing, ${errs.length} with console errors, ${smallTotal} tap targets under 40 px at 375`);
for (const r of over) console.log(`  overflow ${r.viewport} ${r.path}: ${r.offenders.map((o) => o.el).join(" | ")}`);
process.exit(over.length ? 1 : 0);
