# Build status

Last updated: 2026-10-24 (foundation, engines, all four portals, public site, production deploy).

**Live:** https://proof-pink-eta.vercel.app (Vercel `proof` + Neon `proof-db`, seeded demo).
Demo logins (password `proof-demo-2026` for all): student `ishita@spit-surat.example`, recruiter
`meera@kitecode.example`, placement cell `placements@spit-surat.example`, mentor
`anand.mehta@spit-surat.example`, admin `admin@proof.example`. Full table in the README.
Smoke-tested 2026-10-24: `/`, `/login`, `/u/ishita-varma`, `/verify`, `/for-recruiters`, `/pricing`
return 200; email sign-in as the demo student succeeds and `/student` returns 200.

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

## Verification engine, credentials, scoring, student + mentor portals (built)

Engines (contract for other areas):

- **Credentials** `src/server/credentials/index.ts`: `issueCredential({ userId, type, claim, evidenceId })`
  and `verifyCredential(id) -> { valid, credential, subject, issuedAt, reason?, checks[] }`, plus
  `verifyCredentialDocument(vc)` (signature only, for pasted JSON) and `getIssuerPublicKey()`.
  W3C VC v2 JSON with an `eddsa-jcs-2022` Data Integrity proof (JCS canonicalisation, Ed25519 via
  WebCrypto, base58btc `proofValue`); issuer `urn:proof:platform`, key from
  `getOrCreateSecret(SECRET_KEYS.credentialKeypair)`. Verification checks signature, id binding,
  subject binding, revocation and expiry. Pure helpers in `vc.ts`.
- **Scoring** `src/server/scoring/index.ts`: `computeProofScore(userId) -> { overall, breakdown,
  perSkill[{ skill, score, evidenceCount, breakdown }], explanation[] }` (read-only) and
  `recomputeProofScore(userId)` (writes `student_profiles` + upserts `profile_skills`). Pure engine in
  `engine.ts`: authorship 35 (log volume + active weeks x share, red-flagged repos excluded and
  listed), deployments 20 (8 live, +2 homepage match, 3 if down), checks 25 (best passing attempt per
  check, 5/8/11 by level x score), endorsements 20 (8 per distinct mentor, +2 repeats), recency 10
  (halves every 90 days). `nextBestProofs()` drives the dashboard's "next best proof".
- **Evidence recorder** `src/server/verify/evidence.ts`: `recordVerifiedEvidence()` upserts the
  evidence row, signs its credential, rescores and notifies; `revokeEvidence()` undoes it. Every
  verification path (and mentor endorsements) goes through it.
- **Verification** `src/server/verify/`: `github.ts` (gist `proof.md` with handle + nonce via
  `/users/{u}/gists`; conditional requests with an in-memory ETag body cache + `github_accounts.etag`;
  optional `GITHUB_TOKEN`; repo import with own commits by author, totals from the Link header,
  languages, red flags `all_commits_one_day`, `bulk_import`, `backdated_history`,
  `fork_without_own_commits`, soft `low_authorship`), `deployments.ts` (meta tag or
  `/.well-known/proof.txt`; SSRF guard: public hosts only incl. DNS resolution, manual re-validated
  redirects, 8 s timeout, 512 KB cap; health re-checks), `sandbox.ts` (QuickJS WASM per test: 24 MB
  memory, 512 KB stack, 1.5 s deadline, no fetch/fs/timers; expected values never enter the sandbox;
  implements `{__failTimes}`, `{__double}` with a concurrency-limit check, expected `{__throws}`),
  `checks.ts` (timed attempts with 30 s grace, invited attempts picked up, paste/blur signals stored),
  `domain.ts` (generic institutional-email magic link for `mentor | company | college`, stored hashed
  in `verifications`, 30 min, single use; Resend when `RESEND_API_KEY` is set, otherwise the link is
  shown on screen; free-mail domains rejected). Pure rules in `rules.ts`, `domain-rules.ts`.
- **Seed** issues a credential for every verified evidence row and recomputes every score with the
  real engine (Ishita now scores 83, not the old hard-coded 82).
- `next.config.ts` lists the QuickJS packages in `serverExternalPackages` (WASM loaded at runtime).

Student portal: `/student` (score dial, "Why N?" drawer with every capped signal + the engine's
reasons + per-skill scores, next best proof, recent credentials; redirects to onboarding until step 4),
`/student/onboarding` (4 steps, resumable), `/student/proofs` (tabs: GitHub gist flow, repo import with
authorship cards + red flags, deployments with token instructions + health, checks summary,
endorsement requests to verified mentors), `/student/checks` + `/student/checks/[slug]` (lazy Monaco,
countdown, run examples, submit, per-test results; hidden tests show pass/fail only), `/student/profile`
(headline, about, accent token, up to 3 pinned verified evidence, visibility public / recruiters /
hidden, live preview, rebuilds `search_text`), `/student/jobs` (filters, evidence match meter, apply
sheet), `/student/applications` (stage stepper, withdraw). Every successful verification plays the
Seal stamp moment (`student/_components/seal-moment.tsx`) with the score delta.

Mentor portal: `/mentor` (setup flow when no `mentors` row), `/mentor/settings` (profile + domain magic
link, dev link on screen), `/mentor/verify?token=` (explicit confirm, then seal), `/mentor/requests`
(endorse with a 40-600 char statement, or decline), `/mentor/endorsements` (given, revoke, endorse a
student directly by handle). Only domain-verified mentors can endorse.

Tests (`npm test`): `credentials/vc.test.ts` (JCS, base58, sign/verify, tamper, wrong key),
`scoring/engine.test.ts` (caps, sums, best-attempt, diminishing endorsements, per-skill, exclusions),
`verify/rules.test.ts` (gist, authorship flags, meta/proof.txt, SSRF), `verify/sandbox.test.ts`
(reference solutions pass all 12 seeded checks; infinite loop, memory, no host globals, hidden values
not exposed, concurrency limit), `verify/domain.test.ts`.

For other builders: recruiter/college domain verification can call `createDomainMagicLink({ purpose:
"company" | "college" })` and `consumeDomainMagicLink(token)`; links point at `/recruiter/verify-domain`
and `/college/verify-domain`, which those portals still need to add.

## Student messages, settings, drives; org domain verification; phone tap targets (built)

- **Student messages** (`/student/messages`): thread list (`recruiter/messages/thread-list.tsx`, shared
  with the recruiter page) + the reusable `ThreadView`. Students reply only; `assertCanMessage`
  still enforces it server-side, the composer shows why it is locked.
- **Student settings** (`/student/settings`): account (name; password via Better Auth
  `changePassword`, other sessions revoked), privacy (visibility radio + open to work), notification
  categories (`NOTIFICATION_CATEGORIES` in `validation/student.ts`). Muted categories live in
  `student_profiles.muted_notifications` (migration `0001`) and are filtered out of the bell list and
  unread count in `getShellNotifications`; they are still stored.
- **Drive registration** (`/student/jobs#drives`): `server/student/drives.ts` lists the student's
  college's planned/open drives plus any drive they are on (results stay visible), with each
  criterion met / not met. `registerForDrive` re-checks eligibility with the placement cell's
  `eligibilityWhere`, refuses other colleges' drives, flips `eligible` to `registered` (or inserts),
  and notifies the drive's creator. `drive.eligible` / `drive.selected` notifications link here.
  Tests: `server/student/drives.test.ts`.
- **Company / college domain verification**: `server/verify/org-domain-actions.ts`
  (`requestOrgDomainLink`, `confirmOrgDomain`) over `createDomainMagicLink` / `consumeDomainMagicLink`.
  The address must be at `companies.domain` / `colleges.domain`. Request buttons on
  `/recruiter/company` and `/college/settings` (dev link on screen without `RESEND_API_KEY`); landing
  pages `/recruiter/verify-domain` and `/college/verify-domain` confirm explicitly, then stamp the seal.
- **Phone tap targets**: below `sm` (`globals.css`) buttons, tabs, selects, inputs and non-inline
  links get a 40 x 40 px minimum through zero-specificity `:where()`; checkboxes / radios grow to
  20 px and their wrapping label is the target. `npm run screens` now prints the total under 40 px
  and treats a label-wrapped toggle as its label.

## Public site: landing v2, dossier, verify, marketing pages (built)

Server: `src/server/public/` (`queries.ts` dossier + landing reads, `score.ts` wraps
`computeProofScore`, `verify.ts` wraps `verifyCredential` / `verifyCredentialDocument`,
`actions.ts` the public paste-verifier action, `site.ts` request origin + QR SVG via `qrcode`).
Components: `src/components/landing/`, `src/components/profile/`; verify-only pieces live in
`src/app/(public)/verify/_components/`. The public layout now uses `landing/site-header.tsx`
(nav + mobile sheet) and `landing/site-footer.tsx`; `components/marketing/*` is no longer used.

- **Landing** (`/`): R3F hero (`landing/hero-canvas.tsx`, its own chunk via `next/dynamic`,
  `ssr: false`, mounted on `requestIdleCallback` only when WebGL is available and Save-Data is off).
  Fourteen resume claims float as paper fragments (canvas textures); scrolling the 220svh runway
  strikes them through (coral), flies them into formation and stamps them into lime seals joined as
  a constellation. Scroll progress is a Motion value read inside `useFrame` (no React re-renders);
  the frame loop stops when the hero is off-screen. The headline is server-rendered HTML (LCP);
  reduced motion, no WebGL or Save-Data get a static SVG constellation and no runway. Then: live
  evidence ticker (CSS-only marquee of the latest verified evidence from PUBLIC profiles only,
  first name + initial), students / recruiters / colleges sections with product vignettes,
  "How verification works" (5 steps, each with an animated mini demo, auto-advancing tabs with
  arrow-key support), live ledger numbers (no testimonials), FAQ (`<details>`), CTA. Ticker,
  numbers and the featured-dossier link stream in behind the hero via `Suspense`.
- **Dossier** (`/u/[handle]`): header with Proof Score ring (live from `computeProofScore`) and a
  stamped seal with the seal count, evidence-by-kind strip, skill constellation
  (`profile/skill-constellation.tsx`: d3-force layout on a dark "night sky" island, skills are
  hubs sized by score, each star is one evidence item, kinds told apart by shape; hover / focus /
  tap shows the commit, deploy, check or endorsement facts with source + credential links; keyboard
  operable), evidence cards ("slips" with facts, skills, source and `/verify` links; pinned first),
  work timeline (grouped by month, repo spans from first to last commit), "Why N?" breakdown
  against the engine's caps + its explanation lines, live per-skill scores, share panel with QR.
  **Privacy:** hidden profiles 404 for everyone but the owner; recruiters-only profiles show a
  sign-in prompt to non-recruiters; the owner sees a banner. `opengraph-image.tsx` renders a 1200x630
  card for PUBLIC profiles only (generic card otherwise); `generateMetadata` only names public
  profiles (others are `noindex`).
- **Verify** (`/verify/[id]`, `/verify`): lime seal + "Authentic. Signature verified." or a coral
  broken seal for tampered / revoked / expired / unknown, the engine's individual checks as a
  pass/fail ledger, claim, subject (linked only if their profile is public), issuer + key id,
  issued / expiry, the Ed25519 `proofValue`, raw JSON (highlighted, copy), QR to the page.
  The paste-JSON verifier checks the pasted document's own signature first (no trust in our DB),
  then the record (revocation, expiry), and names the top-level fields that differ from what Proof
  issued. `/verify` also takes an id or a full verify link.
- **Marketing**: `/for-recruiters` (interactive fictional evidence search whose results re-sort
  with layout animations), `/for-colleges` (readiness vignette, features, rollout), `/pricing`
  (Free for students forever; Hiring team per seat; Placement cell per campus; monthly / yearly
  toggle; prices are illustrative), `/about` (story, principles, demo-data note).

## Not built yet (by area)

| Area | Next steps |
|---|---|
| Verification engine | Built (see above). Left: scheduled health re-checks for all deployments (cron), re-import to refresh repo stats. |
| Skill checks | Built. Left: more tasks and languages; plagiarism similarity across submissions. |
| Credentials | Built, including the public `/verify/[id]` page, paste-JSON verifier and QR. Left: publish the issuer key at a `.well-known` URL, status list for revocation. |
| Scoring | Built; recomputed on every verification and in the seed. |
| Student | Built, including messages (reply-only), settings and drive registration. |
| Recruiter | Built, including company domain verification by magic link. Left: emailed teammate invites, saved-search alerts when new evidence matches. |
| College | Built, including college domain verification by magic link; students register for drives themselves. Left: offer CTC captured as a number for package stats. |
| Mentor | Built. |
| Public | Built (see "Public site" above). Left: Playwright visual checks of the hero at 375 px, a downloadable credential JSON button, publishing the issuer key for offline verification. |
| Testing | Vitest engines + scoping tests done. Left: Playwright smoke on port 5191. |
| Deploy | Live at https://proof-pink-eta.vercel.app. `vercel-build` runs `scripts/db-deploy.mjs` (migrate, seed once when `SEED_DEMO=true` and no users). Left: connect the GitHub repo for push-to-deploy, set `BETTER_AUTH_SECRET` in Vercel env. |

## Known caveats

- PGlite is single-process: stop the server before `db:seed` / `db:migrate`.
- Better Auth rate-limits sign-in in production (3 per 10 s per IP); scripted smoke tests must pace logins.
- `user.companyId` / `user.collegeId` come from Better Auth `additionalFields` typed as string; cast
  as `string | null | undefined` when passing on.
