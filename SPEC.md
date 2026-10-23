# Proof: hiring on verified work, not resumes

> Resumes are claims. Proof is evidence.

Every year ~1 crore graduates in India apply with near-identical, increasingly AI-written
resumes, and recruiters cannot tell real skill from keyword stuffing. Proof turns a
student's real work into **verified evidence** (code they actually wrote, projects that are
actually live, endorsements from real mentors, skill checks they actually passed) and gives
recruiters a search engine over that evidence. Colleges get a placement cell that sees who is
truly job-ready.

Owner: Rutvi Rupani. Repo `rutvirupani1111/proof` (public). Deploy: Vercel project `proof` +
Neon Postgres. Everything free-tier; no API keys required for core features.

## Users and portals

| Portal | Who | Core jobs |
|---|---|---|
| Student | final-year students, freshers | build a verified profile, apply, track applications |
| Recruiter | startups, HR, hiring managers | search verified skills, shortlist, run a pipeline, invite to skill checks |
| College | placement cell officers | cohort readiness, company drives, placement stats |
| Mentor | professors, seniors, employers | endorse specific skills/projects with their verified email domain |
| Public | anyone | view a shareable Proof profile, verify a credential by link/QR |

## Verification engine (the heart; each produces an Evidence row + a signed Credential)

1. **GitHub ownership (Keybase-style, no OAuth needed):** student creates a public gist named
   `proof.md` containing a statement with their Proof handle and a one-time nonce; Proof fetches
   `GET https://api.github.com/users/{u}/gists` and verifies. Optional `GITHUB_TOKEN` env raises
   rate limits; always cache and use conditional requests (ETag).
2. **Code authorship:** for repos the student selects: not a fork (or fork with own commits),
   commits authored by that GitHub user (`/repos/{o}/{r}/commits?author=`), authorship share,
   active weeks, languages (`/languages`), first/last commit. Red flags: all commits on one day,
   bulk-imported history, repo created days ago with years of commits.
3. **Live deployment:** student adds a URL; verified by `<meta name="proof-verification"
   content="<token>">` or `/.well-known/proof.txt`; bonus if the repo `homepage` matches. Store a
   screenshot-free health check (status, response time, last checked).
4. **Skill checks:** timed, in-browser coding tasks (Monaco editor, lazy-loaded). JavaScript tasks
   are verified **server-side** inside a QuickJS WASM sandbox (`quickjs-emscripten`: no network,
   no fs, memory + time limits) against hidden tests. Seed 12 tasks across levels (arrays,
   strings, async, data transforms, a small React-logic task as pure functions). Results:
   score, time taken, attempts, plagiarism signals (paste events, tab blur count; shown, not
   auto-penalised).
5. **Mentor attestations:** mentor signs up with an institutional email (college or company
   domain), verifies via magic link (in development, show the link on screen when no email
   provider is configured), then endorses a specific skill or project with a short statement.
   Displayed as "Verified mentor at @iitb.ac.in".
6. **Credentials:** each verified item becomes a W3C Verifiable Credential (JSON-LD shape,
   Ed25519 signature via WebCrypto). The platform keypair is generated once and stored in the DB
   (no typed secrets). Public `/verify/{credentialId}` page + QR; tamper shows red.

**Proof Score** (0-100) per skill and overall: weighted evidence (authorship volume and recency,
live deployments, passed checks, mentor endorsements), with an explanation drawer ("why 82?").
Never a black box.

## Feature map

Student: onboarding wizard (college, graduation year, roles, skills to prove), proofs hub
(connect GitHub, import repos, add deployments, take skill checks, request endorsements),
profile builder (headline, about, pinned evidence, theme accent), job board + applications
tracker (stages), notifications, privacy controls (public / recruiters only / hidden).

Recruiter: company workspace (verify company email domain; invite teammates), **evidence
search** (filters: skill, minimum Proof Score, has live deployment, minimum own commits, passed
check, mentor-endorsed, college, graduation year, location; full-text over profiles; saved
searches), candidate view (evidence-first, compare up to 3 side by side), shortlists, job posts,
pipeline kanban (drag and drop: Sourced, Contacted, Skill check, Interview, Offer, Hired,
Rejected), invite to a skill check, in-app messages, notes.

College: verify college domain; cohort dashboard (verified skill distribution, readiness funnel,
top skills gap), company drives (schedule, eligible students, results), placement stats with CSV
export, nudges to students with incomplete proofs.

Public: profile `/u/{handle}` as a "verified dossier" with a skill constellation, timeline of
work, evidence cards with seals; `/verify/{id}`; landing; pricing; for colleges; for recruiters.

## Tech

- Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, Motion (framer-motion), Radix
  primitives with our own styled components, lucide icons, React Three Fiber + drei for the
  landing hero only (lazy), Recharts or visx for dashboards, dnd-kit for the kanban, cmdk ⌘K.
- **Drizzle ORM** over Postgres: **PGlite** (in-process, file under `.data/`) for local dev and
  tests, **Neon** (`DATABASE_URL`) in production. Same SQL, migrations with drizzle-kit.
- Auth: Better Auth (email + password, roles) with a DB-persisted secret fallback when
  `BETTER_AUTH_SECRET` is missing (nobody types secrets into Vercel). GitHub OAuth can be added
  later; ownership is proven by the gist proof regardless.
- Server Actions + route handlers; Zod everywhere; every query scoped by role and ownership.
- Testing: Vitest (engine, scoring, credentials, sandbox), Playwright smoke tests.
- Ports: dev 5190, tests 5191. Never 3000 or 4576.

## Design direction (must feel premium and original)

- Concept: **"evidence, not claims."** Seals, stamps, ledger lines, and a living constellation
  of skills where every star is a piece of evidence.
- Palette: deep "ink" night `#0A0B10` with warm paper `#F6F3EC` light theme; primary
  "verified" electric lime `#C6F432`, accent violet `#7C5CFF`, signal coral `#FF6B4A`,
  neutrals with a slight warm tint. Verified states always lime + a seal glyph.
- Type: "Clash Display"-like display (use **Bricolage Grotesque** or **Unbounded** via
  @fontsource), body **Inter**, data **JetBrains Mono**.
- Signature moments: the landing hero where scattered resume claims collapse into stamped
  seals as you scroll; the verification moment (a seal stamps onto the card with a satisfying
  spring + subtle haptic-like shake); the constellation on profiles (hover a star to see the
  commit/deploy/check behind it); the recruiter search where results re-sort with layout
  animations as filters change.
- Motion: purposeful, 150-400 ms, spring-based, honours prefers-reduced-motion.
- Flawless at 375 px, keyboard accessible, WCAG AA contrast, dark and light.

## Demo data

Seed fictional colleges (e.g. "Sardar Patel Institute of Technology, Surat"), ~40 students with
realistic but fictional names and evidence, 6 companies, 3 recruiters, 2 placement officers,
mentors, jobs and pipelines. Demo logins documented in README (local and the deployed showcase).
Never fabricate real people or real companies' endorsements.
