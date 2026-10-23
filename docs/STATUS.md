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

## Recruiter + college (built)

Server: `src/server/search/engine.ts` (the search), `src/server/recruiter/{scope,queries,mutations,actions}.ts`,
`src/server/college/{scope,queries,mutations,actions}.ts`, `src/server/messaging/{queries,actions}.ts`.
Validation: `src/lib/validation/{recruiter,college}.ts` (also `ActionResult`, `PIPELINE_STAGES`).

- **Scope model.** `recruiterScopeOf(user)` / `collegeScopeOf(user)` build `{ userId, companyId }` /
  `{ userId, collegeId }` from the session only. Every query and mutation takes that scope and
  re-checks row ownership in its WHERE clause, so another company's card / list / job / search /
  note, or another college's drive, is "not found" (`ScopeError`). Admins without a company or
  college see an empty-state, never cross-tenant data.
- **Privacy.** Search, compare and shortlists only ever return `visibility in (public, recruiters)`
  (`RECRUITER_VISIBLE`). The dossier also opens for a hidden student who applied to one of the
  company's jobs (`canSeeCandidate`). Recruiters can start a message thread only with a student they
  can see; everyone else can only reply.
- **Evidence search** (`/recruiter/search`): one SQL query, every filter enforced by Postgres:
  verified skill (per-skill score > 0, all selected skills required), min Proof Score, live
  (verified) deployment, min own commits over verified repos, passed check, endorsement by a
  domain-verified mentor, college, graduation year, location (escaped ILIKE), prefix full-text over
  `search_text` (GIN). Sorts: score, relevance, skill match, commits, live apps. Results re-sort
  with Motion layout animations; filter state lives in `?f=<json>`; saved searches per company;
  compare tray (max 3); filter rail becomes a sheet below `lg`.
- **Dossier** (`/recruiter/candidates/[id]`): evidence first (score breakdown "why N?", verified
  skills, repos with authorship + red flags, deployments with status/latency, checks with paste/blur
  signals shown not penalised, mentor quotes, ledger with credential links) plus a team panel:
  pipeline, shortlist, skill-check invite (creates an `invited` attempt + notification and moves
  Sourced/Contacted cards to Skill check), message, private notes.
- **Compare** (`/recruiter/compare?ids=a,b,c`), **shortlists**, **jobs** (create/edit/close/reopen;
  editing never changes open/closed), **pipeline** (dnd-kit, mouse/touch/keyboard sensors, screen-reader
  announcements, a per-card "Move to" menu, optimistic moves with rollback, sparse-float positions via
  `positionBetween`, job filter), **messages** (`ThreadView` is reusable by other portals; marks read on
  open; notifies the recipient), **company** (domain state with seal, teammates, invite stub that
  validates the domain and returns a sign-up link to share).
- **College**: `/college/cohort` (hand-built SVG/Motion charts: verified skill distribution with the
  70+ share, readiness funnel, top skill gaps = open jobs' required skills vs. students at that bar),
  `/college/drives` + `/college/drives/[id]` (eligibility by min score / years / branches / verified
  skills; creating a drive adds and notifies eligible students; roster status + result editing;
  "add newly eligible"), `/college/stats` (placements = drive selections + offer/hired applications,
  by branch and year) with `/college/stats/export` CSV (formula-injection safe), `/college/nudges`
  (filter by missing proof, bulk notifications with a personalised next step), `/college/settings`.
- **Tests** (`npm test`): `src/server/search/engine.test.ts` (every filter, privacy, hostile input)
  and `src/server/search/scoping.test.ts` (cross-company pipeline/lists/jobs/notes/messages, cross-college
  drives/eligibility/nudges/stats/CSV). They run the real migrations on an in-memory PGlite
  (`test-fixtures.ts`) with `getDb` mocked, so they never touch `.data/`.

Schema notes (not changed; suggestions for whoever owns `schema.ts`): a `company_invites` table
(token, email, expires) for real teammate invites; `saved_searches.last_run_at` + a match count for
alerts; `drive_students.offer_ctc` (integer) so package stats are numeric rather than free text in
`result`; an index on `messages (least(sender, recipient), greatest(...), created_at)` once threads
grow.

## Not built yet (by area)

| Area | Next steps |
|---|---|
| Verification engine | Gist ownership check (ETag cache, optional `GITHUB_TOKEN`), repo import + authorship stats + red flags, deployment verification + health checks. `src/server/verification/` |
| Skill checks | Monaco (lazy) runner page, QuickJS sandbox grading against `hidden_tests`, paste/blur signals. Seeded tests use small conventions for async tasks (`{ __failTimes }`, `{ __double }`, `{ __throws }`) that the grader harness must implement. |
| Credentials | Ed25519 keypair via `getOrCreateSecret(SECRET_KEYS.credentialKeypair)`, VC issuance per evidence row, real signature check + QR on `/verify/[id]`. Seed has no credentials yet; backfill after the engine lands. |
| Scoring | Real Proof Score engine writing `student_profiles.proof_score/score_breakdown` and `profile_skills`; "why 82?" drawer. Seeded scores are demo values. |
| Student | Onboarding wizard, proofs hub, profile builder, jobs board, applications tracker, privacy controls, messages. |
| Recruiter | Built (see "Recruiter + college" below). Left: real company domain verification (magic link) instead of the pending/verified display, emailed teammate invites, saved-search alerts when new evidence matches. |
| College | Built (see below). Left: college domain verification flow, drive registration by students (student portal), offer CTC captured as a number for package stats. |
| Mentor | Magic-link domain verification (show the link on screen when no email provider), requests inbox, attestation form. |
| Public | Full dossier with skill constellation and timeline, pricing, for-colleges, for-recruiters pages, landing 3D hero (lazy R3F). |
| Testing | Vitest (engine, scoring, credentials, sandbox), Playwright smoke on port 5191. |
| Deploy | Vercel project `proof` + Neon; set `DATABASE_URL`; `vercel-build` migrates; seed showcase with `PROOF_SEED_REMOTE=1`. |

## Known caveats

- PGlite is single-process: stop the server before `db:seed` / `db:migrate`.
- Better Auth rate-limits sign-in in production (3 per 10 s per IP); scripted smoke tests must pace logins.
- `user.companyId` / `user.collegeId` come from Better Auth `additionalFields` typed as string; cast
  as `string | null | undefined` when passing on.
