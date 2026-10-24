# Proof demo guide

Live showcase: **https://proof-pink-eta.vercel.app**. Everything in it is fictional seed data
(`scripts/seed.ts`): people, colleges and companies are invented, domains use the reserved
`.example` TLD and GitHub usernames use a `proofdemo-` prefix.

## Signing in

Every demo account uses the password **`proof-demo-2026`**.

On the showcase (`NEXT_PUBLIC_DEMO_MODE=true`, committed in `.env.production`) the sign-in page
shows a **Demo accounts** panel: one tap signs in as that role, and each card has copy buttons for
its email and password. Once signed in, the floating **Switch role** pill (bottom left) signs out
and back in as another demo role in one tap. Demo mode is off in local dev and on any deployment
that does not set the flag; there the panel and the pill do not render and `demoSignIn` refuses.

Panel sign-ins skip Better Auth's sign-in rate limit (3 attempts per 10 s per IP) and use a looser
per-IP cap of 20 per minute instead. Typing the same credentials into the form still goes
through the normal limiter.

| Role | Name | Email | Lands on |
|---|---|---|---|
| Student | Ishita Varma | `ishita@spit-surat.example` | `/student` |
| Recruiter (verified) | Meera Iyer, Kitecode Labs | `meera@kitecode.example` | `/recruiter` |
| Recruiter (domain pending) | Arjun Kapoor, Monsoonpay | `arjun@monsoonpay.example` | `/recruiter` |
| Placement cell | SPIT Surat (Kavita Joshi) | `placements@spit-surat.example` | `/college` |
| Mentor | Dr. Anand Mehta | `anand.mehta@spit-surat.example` | `/mentor` |
| Admin | Proof Admin | `admin@proof.example` | every portal |

More seeded accounts (same password): `tpo@wgit-pune.example` (placement cell, WGIT Pune),
`farah@banyanhealth.example` (recruiter), `vikram@paperkite.example` (mentor, domain pending).

## What to try

### Student: Ishita
- **Dashboard**: the Proof Score and the "why this number" breakdown, computed from her evidence.
- **Proofs**: verified repos, live deployments, passed checks and endorsements, each a signed credential.
- **Skill checks**: take a timed check in the browser sandbox; a pass adds evidence and rescores.
- **Jobs / Applications**: apply to a role she meets the bar for, then track it.
- **Public profile**: `/u/ishita-varma`, the Proof Pass and `/verify` for any credential.
- **Settings**: profile visibility, muted notification categories, change password (eye toggle).

### Recruiter: Meera (verified domain)
- **Search**: plain English, e.g. "React developer in Pune with a live app".
- **Candidate dossier**: the evidence-linked story, then **Interview kit**: questions built from the
  candidate's own repos, deployments, checks and endorsements, grouped by skill, printable.
- **Pipeline**: drag a card to Contacted, Skill check, Interview, Offer or Hired. The student is
  notified live (Sourced and Rejected are internal and do not notify).
- **Messages**: write to a candidate; it reaches their bell and a toast in real time.
- **Jobs**: post a role with verified skill minimums; the live match counter updates as you type.
- **Billing**: upgrade with the Stripe test card below.

### Recruiter: Arjun (domain pending)
- See how trust-bearing actions wait on domain verification, and walk the verify-domain flow.

### Placement cell: SPIT Surat
- **Cohort** and **Stats**: who has verified evidence, by branch and year; CSV export.
- **Drives**: create a drive with eligibility rules; eligible students are notified.
- **Nudges**: next-step suggestions sent to students who are close to the bar.

### Mentor: Dr. Anand Mehta
- **Requests**: endorse or decline a student's request; the endorsement is issued as a signed credential.
- **Endorse directly**: endorse a student by handle (e.g. `ishita-varma`) for a skill.

### Admin
- Passes every role check: open `/student`, `/recruiter`, `/college` and `/mentor`.

## Seeing live notifications

1. Open the showcase in two browsers (or one normal and one private window).
2. Sign in as **Ishita** in one and **Meera** in the other.
3. As Meera, message Ishita, or move her card in the pipeline. As **Dr. Anand Mehta**, endorse her.
4. Within about three seconds Ishita's bell badge goes up and a toast appears, without a reload.

The bell subscribes to `GET /api/notifications/stream` (Server-Sent Events, session-scoped). Each
stream polls the user's own rows, sends a heartbeat every 15 s and closes itself after 45 s, well
inside the function limit; the browser reconnects on its own with `Last-Event-ID`, so nothing is
missed across the gap.

## Payments (Stripe test mode)

The showcase runs Stripe in **test mode**; no real money moves.

| Field | Value |
|---|---|
| Card number | **4242 4242 4242 4242** |
| Expiry | any future date, e.g. `12 / 34` |
| CVC | any 3 digits |
| Postal code | any |

Try it from `/recruiter/billing` (Meera) or `/college/billing` (SPIT Surat). Without a Stripe key
(local dev), checkout opens a clearly labelled demo checkout instead.
