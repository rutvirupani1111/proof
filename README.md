# Proof

> Resumes are claims. Proof is evidence.

Hiring on verified work, not resumes. Students prove their skills with real code, live projects,
skill checks and mentor endorsements; recruiters search the evidence; colleges see who is truly
job-ready. Product spec: [`SPEC.md`](SPEC.md). Architecture and conventions:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Build state: [`docs/STATUS.md`](docs/STATUS.md).

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

## Demo logins

Every seeded account uses the password **`proof-demo-2026`** (local and the deployed showcase).

| Role | Email | Lands on |
|---|---|---|
| Student | `ishita@spit-surat.example` | `/student` (Proof Score 82, public profile `/u/ishita-varma`) |
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

Vercel project `proof` + Neon Postgres. Set `DATABASE_URL`; everything else is optional
(`BETTER_AUTH_SECRET` falls back to a generated secret stored in the database). The
`vercel-build` script runs migrations before `next build`. Seed the showcase once with
`PROOF_SEED_REMOTE=1 DATABASE_URL=... npm run db:seed`.

## Ports

Dev and start: 5190. Tests: 5191.
