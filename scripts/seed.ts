/**
 * Seeds fictional demo data. Wipes every table first, so it is repeatable.
 *
 *   npm run db:seed                      # local PGlite (stop the dev server first)
 *   PROOF_SEED_REMOTE=1 npm run db:seed  # against DATABASE_URL (the deployed showcase)
 *
 * After the evidence is inserted, every verified evidence row gets a signed W3C credential
 * (src/server/credentials) and every student's Proof Score is recomputed by the real engine
 * (src/server/scoring), so seeded scores are exactly what the product would compute.
 */
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { closeDb, getDb, usingPglite } from "../src/db";
import * as s from "../src/db/schema";
import { issueCredential } from "../src/server/credentials";
import { recomputeProofScore } from "../src/server/scoring";
import {
  ARCHETYPES,
  BRANCHES,
  COLLEGES,
  COMPANIES,
  DEMO_PASSWORD,
  FIRST_NAMES,
  LAST_NAMES,
  REPO_NAMES,
  SKILL_CHECKS,
  SKILLS,
  type CollegeKey,
  type CompanyKey,
} from "./seed-data";

// ---------------------------------------------------------------- deterministic randomness
let seed = 20261023;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
const sample = <T,>(arr: readonly T[], n: number): T[] => [...arr].sort(() => rand() - 0.5).slice(0, n);
const uid = () => crypto.randomUUID();
const NOW = new Date("2026-10-20T10:00:00+05:30").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000);
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

const TABLES = [
  "notifications", "messages", "notes", "drive_students", "drives", "pipeline_cards", "shortlist_entries",
  "shortlists", "saved_searches", "applications", "jobs", "credentials", "evidence", "attestations", "mentors",
  "check_attempts", "skill_checks", "deployments", "repo_stats", "repos", "github_accounts", "profile_skills",
  "skills", "student_profiles", "sessions", "accounts", "verifications", "users", "companies", "colleges",
];

async function main() {
  if (!usingPglite() && process.env.PROOF_SEED_REMOTE !== "1") {
    throw new Error("Refusing to wipe a remote DATABASE_URL. Set PROOF_SEED_REMOTE=1 to seed it on purpose.");
  }
  const db = await getDb();
  console.log(`Seeding ${usingPglite() ? "PGlite (.data/pglite)" : "DATABASE_URL"}…`);
  await db.execute(sql.raw(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`));

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // ---------------------------------------------------------------- orgs
  const collegeId = {} as Record<CollegeKey, string>;
  await db.insert(s.colleges).values(
    COLLEGES.map((c, i) => {
      collegeId[c.key] = uid();
      return {
        id: collegeId[c.key],
        name: c.name,
        shortName: c.shortName,
        slug: c.key,
        city: c.city,
        state: c.state,
        domain: c.domain,
        domainVerifiedAt: i < 3 ? daysAgo(120) : null,
      };
    }),
  );
  const companyId = {} as Record<CompanyKey, string>;
  await db.insert(s.companies).values(
    COMPANIES.map((c, i) => {
      companyId[c.key] = uid();
      return {
        id: companyId[c.key],
        name: c.name,
        slug: c.key,
        domain: c.domain,
        domainVerifiedAt: i !== 1 ? daysAgo(90) : null,
        website: `https://${c.domain}`,
        about: c.about,
        industry: c.industry,
        size: c.size,
        city: c.city,
      };
    }),
  );

  const skillId: Record<string, string> = {};
  await db.insert(s.skills).values(
    SKILLS.map(([slug, name, category]) => {
      skillId[slug] = uid();
      return { id: skillId[slug], slug, name, category };
    }),
  );

  const checkId: Record<string, string> = {};
  await db.insert(s.skillChecks).values(
    SKILL_CHECKS.map((c) => {
      checkId[c.slug] = uid();
      return {
        id: checkId[c.slug],
        slug: c.slug,
        title: c.title,
        skillId: skillId[c.skill],
        level: c.level,
        prompt: c.prompt,
        starterCode: c.starter,
        entryFunction: c.entry,
        sampleTests: c.sample,
        hiddenTests: c.hidden,
        timeLimitSec: c.minutes * 60,
      };
    }),
  );

  // ---------------------------------------------------------------- users
  type NewUser = typeof s.users.$inferInsert;
  const userRows: NewUser[] = [];
  const addUser = (u: Omit<NewUser, "id" | "emailVerified" | "emailDomain"> & { id?: string }) => {
    const id = u.id ?? uid();
    userRows.push({ ...u, id, emailVerified: true, emailDomain: u.email.split("@")[1] });
    return id;
  };

  const adminId = addUser({ name: "Proof Admin", email: "admin@proof.example", role: "admin" });
  const recruiters = {
    meera: addUser({ name: "Meera Iyer", email: "meera@kitecode.example", role: "recruiter", companyId: companyId.kitecode, domainVerification: "verified", onboardedAt: daysAgo(60) }),
    arjun: addUser({ name: "Arjun Kapoor", email: "arjun@monsoonpay.example", role: "recruiter", companyId: companyId.monsoonpay, domainVerification: "pending" }),
    farah: addUser({ name: "Farah Siddiqui", email: "farah@banyanhealth.example", role: "recruiter", companyId: companyId.banyan, domainVerification: "verified", onboardedAt: daysAgo(30) }),
  };
  const officers = {
    kavita: addUser({ name: "Kavita Joshi", email: "placements@spit-surat.example", role: "college", collegeId: collegeId.spit, domainVerification: "verified", onboardedAt: daysAgo(100) }),
    suresh: addUser({ name: "Suresh Nair", email: "tpo@wgit-pune.example", role: "college", collegeId: collegeId.wgit, domainVerification: "verified", onboardedAt: daysAgo(80) }),
  };
  const mentorDefs = [
    { name: "Dr. Anand Mehta", email: "anand.mehta@spit-surat.example", title: "Associate Professor, Computer Engineering", org: "Sardar Patel Institute of Technology, Surat", orgType: "college" as const, college: collegeId.spit, verified: true },
    { name: "Priya Raman", email: "priya@kitecode.example", title: "Staff Engineer", org: "Kitecode Labs", orgType: "company" as const, company: companyId.kitecode, verified: true },
    { name: "Prof. Lakshmi Rao", email: "lakshmi.rao@dvce.example", title: "Professor, Information Technology", org: "Deccan Valley College of Engineering", orgType: "college" as const, college: collegeId.dvce, verified: true },
    { name: "Vikram Sethi", email: "vikram@paperkite.example", title: "Engineering Lead", org: "Paperkite Studio", orgType: "company" as const, company: companyId.paperkite, verified: false },
  ];
  const mentorUserIds = mentorDefs.map((m) =>
    addUser({ name: m.name, email: m.email, role: "mentor", domainVerification: m.verified ? "verified" : "pending", onboardedAt: daysAgo(50) }),
  );

  // 40 students. Student #0 is the hero demo login (Ishita Varma, SPIT, score 82).
  const collegeKeys = COLLEGES.map((c) => c.key);
  type StudentPlan = { id: string; name: string; handle: string; college: CollegeKey; archetype: (typeof ARCHETYPES)[number]; strength: number; email: string };
  const students: StudentPlan[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < 40; i++) {
    let name = i === 0 ? "Ishita Varma" : "";
    while (!name || usedNames.has(name)) name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    usedNames.add(name);
    const college = i === 0 ? "spit" : (collegeKeys[i % collegeKeys.length] as CollegeKey);
    const handle = name.toLowerCase().replace(/[^a-z]+/g, "-");
    const domain = COLLEGES.find((c) => c.key === college)!.domain;
    const email = i === 0 ? "ishita@spit-surat.example" : `${handle.replace("-", ".")}@${domain}`;
    const id = addUser({ name, email, role: "student", onboardedAt: daysAgo(int(10, 200)) });
    students.push({
      id,
      name,
      handle,
      college,
      archetype: i === 0 ? ARCHETYPES[1] : pick(ARCHETYPES),
      // 0..1 how much verified work this student has; spread so the cohort has a real funnel.
      strength: i === 0 ? 0.95 : Math.min(1, Math.max(0.05, rand() ** 0.8)),
      email,
    });
  }
  await db.insert(s.users).values(userRows);
  await db.insert(s.accounts).values(
    userRows.map((u) => ({ id: uid(), accountId: u.id, providerId: "credential", userId: u.id, password: passwordHash })),
  );

  const mentorIds = mentorDefs.map(() => uid());
  await db.insert(s.mentors).values(
    mentorDefs.map((m, i) => ({
      id: mentorIds[i]!,
      userId: mentorUserIds[i]!,
      title: m.title,
      organization: m.org,
      orgType: m.orgType,
      collegeId: m.college ?? null,
      companyId: m.company ?? null,
      emailDomain: m.email.split("@")[1]!,
      domainVerifiedAt: m.verified ? daysAgo(45) : null,
      bio: `${m.title} at ${m.org}. Endorses only work seen first-hand.`,
    })),
  );

  // ---------------------------------------------------------------- per-student evidence
  const profiles: (typeof s.studentProfiles.$inferInsert)[] = [];
  const ghRows: (typeof s.githubAccounts.$inferInsert)[] = [];
  const repoRows: (typeof s.repos.$inferInsert)[] = [];
  const statRows: (typeof s.repoStats.$inferInsert)[] = [];
  const deployRows: (typeof s.deployments.$inferInsert)[] = [];
  const attemptRows: (typeof s.checkAttempts.$inferInsert)[] = [];
  const attestRows: (typeof s.attestations.$inferInsert)[] = [];
  const evidenceRows: (typeof s.evidence.$inferInsert)[] = [];
  const psRows: (typeof s.profileSkills.$inferInsert)[] = [];
  const scoreByStudent: Record<string, number> = {};

  for (const [i, st] of students.entries()) {
    const a = st.archetype;
    const k = st.strength;
    const ghVerified = i === 0 || rand() < 0.4 + k * 0.6;
    const ghUser = `proofdemo-${st.handle.replace(/-/g, "")}`;
    const ghId = uid();
    ghRows.push({
      id: ghId,
      userId: st.id,
      username: ghUser,
      nonce: uid().slice(0, 12),
      status: ghVerified ? "verified" : "pending",
      verifiedAt: ghVerified ? daysAgo(int(5, 120)) : null,
      lastCheckedAt: daysAgo(int(0, 5)),
    });
    if (ghVerified) {
      evidenceRows.push({ userId: st.id, kind: "github_ownership", sourceId: ghId, title: `Owns github.com/${ghUser}`, status: "verified", verifiedAt: daysAgo(int(5, 120)), weight: 0.5, skillSlugs: ["git"], data: { username: ghUser } });
    }

    let authorship = 0;
    let ownCommitsTotal = 0;
    const repoCount = ghVerified ? (i === 0 ? 4 : int(1, Math.max(1, Math.round(1 + k * 3)))) : 0;
    const repoIdsForStudent: string[] = [];
    for (const repoName of sample(REPO_NAMES, repoCount)) {
      const repoId = uid();
      repoIdsForStudent.push(repoId);
      const total = int(20, 260);
      const share = Math.min(1, 0.45 + rand() * 0.55);
      const own = Math.round(total * share);
      ownCommitsTotal += own;
      const flagged = rand() < 0.08;
      const lang = pick(a.langs);
      repoRows.push({
        id: repoId,
        userId: st.id,
        githubAccountId: ghId,
        owner: ghUser,
        name: repoName,
        fullName: `${ghUser}/${repoName}`,
        url: `https://github.com/${ghUser}/${repoName}`,
        description: `${repoName.replace(/-/g, " ")}: a ${a.roles[0]!.toLowerCase()} side project`,
        primaryLanguage: lang,
        languages: { [lang]: int(20_000, 300_000), ...(a.langs[1] ? { [a.langs[1]]: int(1_000, 40_000) } : {}) },
        stars: int(0, 40),
        ghCreatedAt: daysAgo(int(120, 900)),
        ghPushedAt: daysAgo(int(1, 90)),
        status: flagged ? "pending" : "verified",
      });
      const weeks = int(3, 40);
      statRows.push({
        repoId,
        totalCommits: total,
        ownCommits: own,
        authorshipShare: Number(share.toFixed(3)),
        activeWeeks: flagged ? 1 : weeks,
        firstCommitAt: daysAgo(int(120, 700)),
        lastCommitAt: daysAgo(int(1, 60)),
        redFlags: flagged ? ["all_commits_one_day"] : [],
      });
      if (!flagged) {
        authorship += Math.min(12, own / 12 + weeks / 8);
        evidenceRows.push({
          userId: st.id,
          kind: "repo_authorship",
          sourceId: repoId,
          title: `${own} own commits in ${repoName}`,
          summary: `${Math.round(share * 100)}% authorship over ${weeks} active weeks`,
          skillSlugs: a.skills.slice(0, 3) as unknown as string[],
          status: "verified",
          verifiedAt: daysAgo(int(1, 60)),
          weight: 1 + own / 100,
          data: { ownCommits: own, totalCommits: total, activeWeeks: weeks, language: lang },
        });
      }
    }

    let deploys = 0;
    const deployCount = Math.min(repoIdsForStudent.length, i === 0 ? 2 : rand() < k ? int(1, 2) : 0);
    for (let d = 0; d < deployCount; d++) {
      const depId = uid();
      const repoId = repoIdsForStudent[d]!;
      const repo = repoRows.find((r) => r.id === repoId)!;
      const host = `${repo.name}.${st.handle.split("-")[0]}.example`;
      const ok = i === 0 || rand() < 0.85;
      deployRows.push({
        id: depId,
        userId: st.id,
        repoId,
        url: `https://${host}`,
        token: `proof_${uid().replace(/-/g, "").slice(0, 20)}`,
        method: d % 2 === 0 ? "meta" : "well_known",
        status: ok ? "verified" : "failed",
        homepageMatchesRepo: rand() < 0.6,
        lastStatusCode: ok ? 200 : 503,
        lastResponseMs: int(90, 900),
        lastCheckedAt: daysAgo(0),
        verifiedAt: ok ? daysAgo(int(2, 50)) : null,
      });
      if (ok) {
        deploys += 9;
        evidenceRows.push({ userId: st.id, kind: "deployment", sourceId: depId, title: `Live at ${host}`, skillSlugs: a.skills.slice(0, 2) as unknown as string[], status: "verified", verifiedAt: daysAgo(int(2, 50)), weight: 1.5, data: { url: `https://${host}`, status: 200 } });
      }
    }

    let checks = 0;
    const attemptCount = i === 0 ? 3 : rand() < 0.3 + k * 0.6 ? int(1, 3) : 0;
    const relevant = SKILL_CHECKS.filter((c) => (a.skills as readonly string[]).includes(c.skill) || c.skill === "javascript");
    for (const c of sample(relevant.length ? relevant : SKILL_CHECKS, attemptCount)) {
      const attemptId = uid();
      const total = c.sample.length + c.hidden.length;
      const passedTests = i === 0 ? total : Math.min(total, Math.round(total * (0.4 + k * 0.6 + (rand() - 0.5) * 0.3)));
      const score = Math.round((passedTests / total) * 100);
      const passed = score >= 70;
      const started = daysAgo(int(3, 80));
      const taken = int(Math.round(c.minutes * 20), c.minutes * 60);
      attemptRows.push({
        id: attemptId,
        userId: st.id,
        skillCheckId: checkId[c.slug]!,
        status: passed ? "passed" : "failed",
        code: c.starter,
        score,
        passedTests,
        totalTests: total,
        startedAt: started,
        submittedAt: new Date(started.getTime() + taken * 1000),
        timeTakenSec: taken,
        pasteEvents: rand() < 0.15 ? int(1, 3) : 0,
        tabBlurs: int(0, 4),
      });
      if (passed) {
        checks += c.level === "advanced" ? 10 : c.level === "intermediate" ? 8 : 5;
        evidenceRows.push({ userId: st.id, kind: "skill_check", sourceId: attemptId, title: `Passed “${c.title}” (${c.level})`, summary: `${passedTests}/${total} hidden tests in ${Math.round(taken / 60)} min`, skillSlugs: [c.skill], status: "verified", verifiedAt: new Date(started.getTime() + taken * 1000), weight: 1.2, data: { score, timeTakenSec: taken } });
      }
    }

    let endorsements = 0;
    const eligibleMentors = mentorDefs
      .map((m, mi) => ({ m, mi }))
      .filter(({ m }) => m.verified && (m.orgType === "company" || m.college === collegeId[st.college]));
    const attestCount = i === 0 ? 2 : rand() < k * 0.7 ? 1 : 0;
    for (const { m, mi } of sample(eligibleMentors, attestCount)) {
      const atId = uid();
      const skill = pick(a.skills);
      attestRows.push({
        id: atId,
        mentorId: mentorIds[mi]!,
        studentUserId: st.id,
        subjectType: "skill",
        skillId: skillId[skill],
        relationship: m.orgType === "college" ? "Taught in class and guided a semester project" : "Mentored during a summer internship",
        statement: `I have reviewed ${st.name.split(" ")[0]}'s ${SKILLS.find(([sl]) => sl === skill)![1]} work first-hand; it is careful, well-tested and their own.`,
        status: "endorsed",
        requestedAt: daysAgo(int(20, 60)),
        respondedAt: daysAgo(int(1, 19)),
      });
      endorsements += 8;
      evidenceRows.push({ userId: st.id, kind: "attestation", sourceId: atId, title: `Endorsed by ${m.name}`, summary: `Verified mentor at @${m.email.split("@")[1]}`, skillSlugs: [skill], status: "verified", verifiedAt: daysAgo(int(1, 19)), weight: 1.3, data: { mentor: m.name, domain: m.email.split("@")[1] } });
    }
    // A pending request so the mentor inbox is not empty.
    if (i % 7 === 3 && eligibleMentors[0]) {
      attestRows.push({ mentorId: mentorIds[eligibleMentors[0].mi]!, studentUserId: st.id, subjectType: "skill", skillId: skillId[a.skills[0]], relationship: "Final-year project", status: "requested", requestedAt: daysAgo(int(1, 6)) });
    }

    const recency = ghVerified ? Math.round(4 + k * 6) : 0;
    const parts = {
      authorship: Math.min(35, Math.round(authorship)),
      deployments: Math.min(20, deploys),
      checks: Math.min(25, checks),
      endorsements: Math.min(20, endorsements),
      recency: Math.min(10, recency),
    };
    let score = clamp(parts.authorship + parts.deployments + parts.checks + parts.endorsements + parts.recency);
    if (i === 0) score = 82;
    scoreByStudent[st.id] = score;
    const reasons = [
      `${ownCommitsTotal} own commits across ${repoIdsForStudent.length} repos`,
      `${deployRows.filter((d) => d.userId === st.id && d.status === "verified").length} live deployment(s)`,
      `${attemptRows.filter((x) => x.userId === st.id && x.status === "passed").length} skill check(s) passed`,
      `${attestRows.filter((x) => x.studentUserId === st.id && x.status === "endorsed").length} mentor endorsement(s)`,
    ];

    const year = i % 3 === 0 ? 2027 : 2026;
    profiles.push({
      userId: st.id,
      handle: st.handle,
      collegeId: collegeId[st.college],
      graduationYear: year,
      degree: "B.Tech",
      branch: pick(BRANCHES),
      headline: a.headline,
      about: `Final-year student at ${COLLEGES.find((c) => c.key === st.college)!.shortName}. ${a.headline}.`,
      location: COLLEGES.find((c) => c.key === st.college)!.city,
      targetRoles: [...a.roles],
      visibility: i === 0 ? "public" : i % 11 === 5 ? "hidden" : i % 4 === 2 ? "recruiters" : "public",
      proofScore: score,
      scoreBreakdown: { ...parts, reasons },
      scoreUpdatedAt: daysAgo(0),
      searchText: [st.name, a.headline, ...a.skills, ...a.roles, ...repoRows.filter((r) => r.userId === st.id).map((r) => r.name)].join(" "),
      onboardingStep: 4,
      openToWork: rand() < 0.9,
    });

    for (const slug of a.skills) {
      const ev = evidenceRows.filter((e) => e.userId === st.id && (e.skillSlugs ?? []).includes(slug)).length;
      const skillScore = ev === 0 ? 0 : clamp(score * (0.75 + rand() * 0.35) + ev * 2);
      psRows.push({ userId: st.id, skillId: skillId[slug]!, claimed: true, proofScore: skillScore, evidenceCount: ev, breakdown: { ...parts, reasons: [`${ev} evidence item(s) mention ${slug}`] } });
    }
  }

  await db.insert(s.studentProfiles).values(profiles);
  await db.insert(s.githubAccounts).values(ghRows);
  await db.insert(s.repos).values(repoRows);
  await db.insert(s.repoStats).values(statRows);
  await db.insert(s.deployments).values(deployRows);
  await db.insert(s.checkAttempts).values(attemptRows);
  await db.insert(s.attestations).values(attestRows);
  const insertedEvidence = await db.insert(s.evidence).values(evidenceRows).returning();
  await db.insert(s.profileSkills).values(psRows);

  // ---------------------------------------------------------------- credentials + real scores
  for (const ev of insertedEvidence) {
    if (ev.status !== "verified") continue;
    await issueCredential({
      userId: ev.userId,
      type: ev.kind,
      evidenceId: ev.id,
      claim: { title: ev.title, ...(ev.summary ? { summary: ev.summary } : {}), skills: ev.skillSlugs, ...ev.data },
    });
  }
  for (const st of students) {
    const result = await recomputeProofScore(st.id, new Date(NOW));
    scoreByStudent[st.id] = result.overall;
  }
  console.log(`Issued ${insertedEvidence.length} credentials; ${students[0]!.name} scores ${scoreByStudent[students[0]!.id]}.`);

  // ---------------------------------------------------------------- hiring
  const jobDefs: { company: CompanyKey; by?: string; title: string; type: "full_time" | "internship"; mode: "onsite" | "hybrid" | "remote"; loc: string; min: number; max: number; skills: [string, number][]; minScore: number }[] = [
    { company: "kitecode", by: recruiters.meera, title: "Frontend Engineer (New Grad)", type: "full_time", mode: "hybrid", loc: "Bengaluru", min: 900_000, max: 1_400_000, skills: [["react", 60], ["typescript", 50]], minScore: 55 },
    { company: "kitecode", by: recruiters.meera, title: "Full-stack Intern", type: "internship", mode: "remote", loc: "Remote", min: 35_000, max: 50_000, skills: [["nodejs", 40], ["react", 40]], minScore: 40 },
    { company: "monsoonpay", by: recruiters.arjun, title: "Backend Engineer, Payments", type: "full_time", mode: "onsite", loc: "Mumbai", min: 1_200_000, max: 1_800_000, skills: [["java", 60], ["sql", 50]], minScore: 60 },
    { company: "monsoonpay", by: recruiters.arjun, title: "SDE Intern", type: "internship", mode: "hybrid", loc: "Mumbai", min: 40_000, max: 60_000, skills: [["data-structures", 50]], minScore: 45 },
    { company: "tiffinbox", title: "Python Backend Developer", type: "full_time", mode: "onsite", loc: "Pune", min: 700_000, max: 1_000_000, skills: [["python", 55], ["fastapi", 40]], minScore: 50 },
    { company: "banyan", by: recruiters.farah, title: "Django Developer", type: "full_time", mode: "hybrid", loc: "Hyderabad", min: 800_000, max: 1_200_000, skills: [["django", 50], ["postgresql", 40]], minScore: 50 },
    { company: "banyan", by: recruiters.farah, title: "Data Analyst Trainee", type: "full_time", mode: "onsite", loc: "Hyderabad", min: 600_000, max: 800_000, skills: [["pandas", 50], ["sql", 50]], minScore: 40 },
    { company: "sabarmati", title: "ML Engineer Intern", type: "internship", mode: "onsite", loc: "Ahmedabad", min: 30_000, max: 45_000, skills: [["python", 50], ["machine-learning", 40]], minScore: 45 },
    { company: "paperkite", title: "Next.js Developer", type: "full_time", mode: "remote", loc: "Remote", min: 1_000_000, max: 1_500_000, skills: [["nextjs", 60], ["tailwind", 40]], minScore: 60 },
    { company: "paperkite", title: "Design Engineer Intern", type: "internship", mode: "remote", loc: "Remote", min: 30_000, max: 40_000, skills: [["react", 40]], minScore: 35 },
  ];
  const jobIds = jobDefs.map(() => uid());
  await db.insert(s.jobs).values(
    jobDefs.map((j, i) => ({
      id: jobIds[i]!,
      companyId: companyId[j.company],
      postedByUserId: j.by ?? null,
      title: j.title,
      description: `${COMPANIES.find((c) => c.key === j.company)!.name} is hiring a ${j.title}. We read evidence, not resumes: show us code you wrote and things you shipped.`,
      location: j.loc,
      workMode: j.mode,
      employmentType: j.type,
      salaryMin: j.min,
      salaryMax: j.max,
      requiredSkills: j.skills.map(([skillSlug, minScore]) => ({ skillSlug, minScore })),
      minProofScore: j.minScore,
      openings: int(1, 4),
      status: (i === 9 ? "closed" : "open") as "closed" | "open",
      applyBy: new Date(NOW + int(10, 45) * 86_400_000),
      createdAt: daysAgo(int(3, 40)),
    })),
  );

  const stages = ["applied", "screening", "skill_check", "interview", "offer", "rejected"] as const;
  const appRows: (typeof s.applications.$inferInsert)[] = [];
  const appSeen = new Set<string>();
  const addApp = (studentId: string, jobIdx: number, stage: (typeof stages)[number]) => {
    const key = `${studentId}:${jobIdx}`;
    if (appSeen.has(key)) return;
    appSeen.add(key);
    appRows.push({ id: uid(), jobId: jobIds[jobIdx]!, studentUserId: studentId, stage, coverNote: "My evidence is on my Proof profile.", appliedAt: daysAgo(int(1, 30)) });
  };
  addApp(students[0]!.id, 0, "interview");
  addApp(students[0]!.id, 8, "skill_check");
  addApp(students[0]!.id, 2, "applied");
  for (let n = 0; n < 30; n++) addApp(pick(students.slice(1)).id, int(0, 8), pick(stages));
  await db.insert(s.applications).values(appRows);

  // Kitecode pipeline for the demo recruiter.
  const pipelineStages = ["sourced", "contacted", "skill_check", "interview", "offer", "hired", "rejected"] as const;
  const ranked = [...students].sort((x, y) => scoreByStudent[y.id]! - scoreByStudent[x.id]!);
  await db.insert(s.pipelineCards).values(
    ranked.slice(0, 12).map((st, i) => ({
      companyId: companyId.kitecode,
      jobId: jobIds[0]!,
      studentUserId: st.id,
      applicationId: appRows.find((a) => a.studentUserId === st.id && a.jobId === jobIds[0])?.id ?? null,
      ownerUserId: recruiters.meera,
      stage: st.id === students[0]!.id ? "interview" : pipelineStages[i % 5]!,
      position: (i + 1) * 1024,
    })),
  );

  const shortlistId = uid();
  await db.insert(s.shortlists).values({ id: shortlistId, companyId: companyId.kitecode, ownerUserId: recruiters.meera, jobId: jobIds[0]!, name: "Frontend new grads, 2026", description: "React evidence + a live deployment." });
  await db.insert(s.shortlistEntries).values(ranked.slice(0, 6).map((st) => ({ shortlistId, studentUserId: st.id, addedByUserId: recruiters.meera })));
  await db.insert(s.savedSearches).values({ companyId: companyId.kitecode, ownerUserId: recruiters.meera, name: "React, 70+, live app", filters: { skills: ["react"], minScore: 70, hasDeployment: true } });

  await db.insert(s.messages).values([
    { senderUserId: recruiters.meera, recipientUserId: students[0]!.id, companyId: companyId.kitecode, body: "Hi Ishita, your tiffin-tracker deployment caught our eye. Free for a 30-minute chat this week?", createdAt: daysAgo(3) },
    { senderUserId: students[0]!.id, recipientUserId: recruiters.meera, companyId: companyId.kitecode, body: "Thank you, Meera. Thursday afternoon works for me.", createdAt: daysAgo(2), readAt: daysAgo(2) },
  ]);
  await db.insert(s.notes).values({ companyId: companyId.kitecode, authorUserId: recruiters.meera, studentUserId: students[0]!.id, body: "Strong authorship share; ask about the offline sync design in round 2." });

  // ---------------------------------------------------------------- drives
  const driveIds = [uid(), uid(), uid()];
  await db.insert(s.drives).values([
    { id: driveIds[0]!, collegeId: collegeId.spit, companyId: companyId.kitecode, companyName: "Kitecode Labs", jobId: jobIds[0]!, title: "Kitecode Labs campus drive", scheduledAt: new Date(NOW + 9 * 86_400_000), location: "Seminar Hall 2", eligibility: { minProofScore: 55, graduationYears: [2026], skills: ["react"] }, status: "open", createdByUserId: officers.kavita },
    { id: driveIds[1]!, collegeId: collegeId.spit, companyId: companyId.tiffinbox, companyName: "Tiffinbox Logistics", jobId: jobIds[4]!, title: "Tiffinbox backend hiring day", scheduledAt: daysAgo(12), location: "Online", eligibility: { minProofScore: 45 }, status: "completed", createdByUserId: officers.kavita },
    { id: driveIds[2]!, collegeId: collegeId.wgit, companyId: companyId.monsoonpay, companyName: "Monsoonpay", jobId: jobIds[2]!, title: "Monsoonpay SDE drive", scheduledAt: new Date(NOW + 20 * 86_400_000), location: "Main auditorium", eligibility: { minProofScore: 60, graduationYears: [2026, 2027] }, status: "planned", createdByUserId: officers.suresh },
  ]);
  const spitStudents = students.filter((st) => st.college === "spit");
  await db.insert(s.driveStudents).values([
    ...spitStudents.filter((st) => scoreByStudent[st.id]! >= 55).map((st) => ({ driveId: driveIds[0]!, studentUserId: st.id, status: "registered" as const })),
    ...spitStudents.filter((st) => scoreByStudent[st.id]! >= 45).map((st, i) => ({ driveId: driveIds[1]!, studentUserId: st.id, status: (i % 3 === 0 ? "selected" : "rejected") as "selected" | "rejected", result: i % 3 === 0 ? "Offer: ₹8.5 LPA" : null })),
  ]);

  // ---------------------------------------------------------------- notifications
  await db.insert(s.notifications).values([
    { userId: students[0]!.id, type: "application.stage", title: "Kitecode Labs moved you to Interview", body: "Frontend Engineer (New Grad)", href: "/student/applications", createdAt: daysAgo(1) },
    { userId: students[0]!.id, type: "attestation.endorsed", title: "Dr. Anand Mehta endorsed your Node.js work", body: "Verified mentor at @spit-surat.example", href: "/student/proofs", createdAt: daysAgo(4), readAt: daysAgo(3) },
    { userId: students[0]!.id, type: "message.new", title: "New message from Meera Iyer", body: "Your tiffin-tracker deployment caught our eye…", href: "/student/messages", createdAt: daysAgo(3) },
    { userId: recruiters.meera, type: "application.new", title: "3 new applicants for Frontend Engineer", body: "Two have live deployments.", href: "/recruiter/pipeline", createdAt: daysAgo(1) },
    { userId: recruiters.meera, type: "check.completed", title: "A shortlisted candidate passed “Cart reducer”", href: "/recruiter/shortlists", createdAt: daysAgo(2) },
    { userId: officers.kavita, type: "drive.registrations", title: `${spitStudents.filter((st) => scoreByStudent[st.id]! >= 55).length} students registered for the Kitecode drive`, href: "/college/drives", createdAt: daysAgo(1) },
    { userId: mentorUserIds[0]!, type: "attestation.requested", title: "New endorsement request", body: "A student asked you to vouch for a skill.", href: "/mentor/requests", createdAt: daysAgo(2) },
    { userId: adminId, type: "system", title: "Demo data seeded", body: "40 students, 6 companies, 4 colleges.", createdAt: daysAgo(0) },
  ]);

  console.log(
    `Seeded ${COLLEGES.length} colleges, ${COMPANIES.length} companies, ${students.length} students, ` +
      `${repoRows.length} repos, ${deployRows.length} deployments, ${attemptRows.length} check attempts, ` +
      `${attestRows.length} attestations, ${evidenceRows.length} evidence, ${jobDefs.length} jobs, ${appRows.length} applications.`,
  );
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => {});
  process.exit(1);
});
