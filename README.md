# Proof

> Resumes are claims. Proof is evidence.

Hiring on verified work, not resumes. Students prove their skills with real code, live projects,
skill checks and mentor endorsements; recruiters search the evidence; colleges see who is truly
job-ready. Product spec: [`SPEC.md`](SPEC.md). Architecture and conventions:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Build state: [`docs/STATUS.md`](docs/STATUS.md).

**Live demo: https://proof-pink-eta.vercel.app** (fictional seeded showcase; sign in with any
account under [Demo logins](#demo-logins), password `proof-demo-2026`).

## Run locally

Requires Node 20.9+ and npm. No environment variables or API keys needed.

```bash
npm install
npm run db:migrate   # creates .data/pglite and applies drizzle/ migrations
npm run db:seed      # fictional demo data (stop the dev server first: PGlite is single-process)
npm run dev          # http://localhost:5190
```

Other scripts: `npm run build`, `npm start` (port 5190), `npm run typecheck`, `npm run lint`,
`npm run db:generate` (after schema changes), `npm run db:reset` (wipe local DB, migrate, seed).

### Local database (PGlite)

Without `DATABASE_URL` the app uses PGlite, an in-process Postgres stored in `.data/pglite`.
It is single-process: each Node process opens one shared instance, and a pid lock file
(`.data/pglite.lock`) stops a second process from opening the same directory. If you see
"in use by another process", stop the other dev server, `next start` or script first.

If the server crashes with `RuntimeError: Aborted()` or reports that the local database
"could not be opened", the data directory was corrupted (usually two processes writing it at
once, or a process killed mid-write). Stop the server and run `npm run db:reset`: it deletes
`.data/pglite`, re-applies the migrations and re-seeds the demo data.

## Demo logins

Every seeded account uses the password **`proof-demo-2026`** (local and the deployed showcase).

| Role | Email | Lands on |
|---|---|---|
| Student | `ishita@spit-surat.example` | `/student` (Proof Score computed by the scoring engine from her seeded evidence, public profile `/u/ishita-varma`) |
| Recruiter | `meera@kitecode.example` | `/recruiter` (Kitecode Labs, verified domain) |
| Recruiter (domain pending) | `arjun@monsoonpay.example` | `/recruiter` |
| Placement cell | `placements@spit-surat.example` | `/college` (SPIT Surat cohort) |
| Placement cell | `tpo@wgit-pune.example` | `/college` |
| Mentor | `anand.mehta@spit-surat.example` | `/mentor` (verified at @spit-surat.example) |
| Mentor (domain pending) | `vikram@paperkite.example` | `/mentor` |
| Admin | `admin@proof.example` | every portal |

All people, colleges and companies in the seed are fictional. Domains use the reserved
`.example` TLD and GitHub usernames use a `proofdemo-` prefix.

## Production

Live at **https://proof-pink-eta.vercel.app** (Vercel project `proof`, Neon Postgres `proof-db`).
`DATABASE_URL` comes from the Neon integration; everything else is optional
(`BETTER_AUTH_SECRET` falls back to a generated secret stored in the database, and the Better
Auth base URL resolves from the Vercel host). The `vercel-build` script runs
`scripts/db-deploy.mjs` before `next build`: it applies migrations and, because
`.env.production` sets `SEED_DEMO=true`, seeds the demo showcase once while the database has no
users. Deploy with `vercel deploy --prod` (remote build). To reseed by hand:
`PROOF_SEED_REMOTE=1 DATABASE_URL=... npm run db:seed`.

## Billing (Stripe, test mode)

Plans (INR, monthly): Recruiter Starter ₹2,999 per seat, Recruiter Growth ₹7,999 per seat,
College Campus ₹24,999 per campus. Recruiters on Free get 5 candidate unlocks a month (an unlock
reveals contact details and opens messaging); paid plans include 40 or 150 unlocks per seat and
bill extra unlocks at ₹49 through the Stripe meter `candidate_unlocks`. College stats CSV export
needs College Campus. Billing pages: `/recruiter/billing`, `/college/billing`.

- **Production:** `STRIPE_SECRET_KEY` (sk_test) lives in Vercel env;
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is committed in `.env.production`. Nothing else to set up:
  the production build runs `scripts/stripe-sync.ts`, which finds or creates the products, prices
  (by lookup key) and the meter, and registers the webhook endpoint
  `https://<VERCEL_PROJECT_PRODUCTION_URL>/api/stripe/webhook`, storing its signing secret in
  `app_secrets`. The same bootstrap runs on first checkout. `npm run stripe:sync` runs it by hand.
- **Plan state comes only from webhooks** (checkout, subscription and invoice events), applied
  once per event id. `GET /api/stripe/webhook` reports whether the endpoint is registered.
- **Local dev without a key:** checkout opens a clearly labelled demo checkout that feeds
  synthetic events through the same webhook handler. Nothing is charged.
- **Test card:** `4242 4242 4242 4242`, any future expiry, any CVC.

## Ports

Dev and start: 5190. Tests: 5191.
