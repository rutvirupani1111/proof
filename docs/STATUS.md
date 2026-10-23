# Build status

Last updated: 2026-10-23 (foundation).

## Done (foundation)

- Next.js 16 + TS strict + Tailwind v4 + Motion + Radix + lucide; `npm run build`, `tsc`, `eslint` clean.
- Design system: light "paper" / dark "ink" tokens, Bricolage Grotesque / Inter / JetBrains Mono
  via @fontsource, no-flash theme script + toggle.
- Component kit (`src/components/ui/`): Button, Input/Textarea/Label/Field, Select, Card, Badge,
  Seal (stamp animation + `useStampShake`), SealGlyph, Avatar, Tabs (sliding indicator), Dialog,
  Sheet, Tooltip, DropdownMenu, Toast (sonner), EmptyState, Stat, Skeleton, DataTable, PageHeader, Kbd.
- Motion primitives (`src/components/motion/`): FadeIn, Stagger/StaggerItem, NumberTicker, springs.
- Full Drizzle schema for the product + initial migration `drizzle/0000_init.sql`.
- `getDb()`: PGlite locally (auto-migrates), Neon when `DATABASE_URL` is set.
- Better Auth: email + password, role on sign-up, admin rejected, domain-verification stub
  (`pending` for recruiter/college/mentor), DB-persisted secret, student profile + handle on sign-up.
- Single guard (`src/server/auth/guard.ts`) + optimistic proxy.
- Portal shells for student / recruiter / college / mentor: sidebar, top bar, ⌘K palette,
  notifications bell (real data), user menu, mobile sheet nav; dashboards with real seeded stats
  and a "what lives here" card; `[...slug]` placeholders for unbuilt pages.
- Public: landing v1 (hero with claim-to-evidence animation and stamping seal, engine, audiences,
  score explainer), `/login`, `/signup` (role picker), `/u/[handle]` and `/verify/[id]` placeholders.
- Seed: 4 colleges, 6 companies, 40 students with coherent evidence, 3 recruiters, 2 placement
  officers, 4 mentors, 12 skill checks with hidden tests, 10 jobs, applications, pipeline,
  shortlist, saved search, drives, messages, notifications.

## Not built yet (by area)

| Area | Next steps |
|---|---|
| Verification engine | Gist ownership check (ETag cache, optional `GITHUB_TOKEN`), repo import + authorship stats + red flags, deployment verification + health checks. `src/server/verification/` |
| Skill checks | Monaco (lazy) runner page, QuickJS sandbox grading against `hidden_tests`, paste/blur signals. Seeded tests use small conventions for async tasks (`{ __failTimes }`, `{ __double }`, `{ __throws }`) that the grader harness must implement. |
| Credentials | Ed25519 keypair via `getOrCreateSecret(SECRET_KEYS.credentialKeypair)`, VC issuance per evidence row, real signature check + QR on `/verify/[id]`. Seed has no credentials yet; backfill after the engine lands. |
| Scoring | Real Proof Score engine writing `student_profiles.proof_score/score_breakdown` and `profile_skills`; "why 82?" drawer. Seeded scores are demo values. |
| Student | Onboarding wizard, proofs hub, profile builder, jobs board, applications tracker, privacy controls, messages. |
| Recruiter | Evidence search (filters + full text on `search_text`), candidate view + compare, shortlists, pipeline kanban (dnd-kit), skill-check invites, messages, notes, company domain verification + teammates. |
| College | Cohort dashboard charts, drives with eligibility, placement stats + CSV export, nudges. |
| Mentor | Magic-link domain verification (show the link on screen when no email provider), requests inbox, attestation form. |
| Public | Full dossier with skill constellation and timeline, pricing, for-colleges, for-recruiters pages, landing 3D hero (lazy R3F). |
| Testing | Vitest (engine, scoring, credentials, sandbox), Playwright smoke on port 5191. |
| Deploy | Vercel project `proof` + Neon; set `DATABASE_URL`; `vercel-build` migrates; seed showcase with `PROOF_SEED_REMOTE=1`. |

## Known caveats

- PGlite is single-process: stop the server before `db:seed` / `db:migrate`.
- Better Auth rate-limits sign-in in production (3 per 10 s per IP); scripted smoke tests must pace logins.
- `user.companyId` / `user.collegeId` come from Better Auth `additionalFields` typed as string; cast
  as `string | null | undefined` when passing on.
