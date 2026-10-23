/**
 * Test-only: an in-memory PGlite with the real migrations and a small, fully known world of two
 * colleges, two companies and five students. Used by the search and scoping tests (they mock
 * `getDb` to return this). Never import from app code.
 */
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Db } from "@/db";

export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return { db, close: () => client.close() };
}

export const ids = {
  collegeA: "col-a",
  collegeB: "col-b",
  companyK: "co-k",
  companyM: "co-m",
  recruiterK: "u-rk",
  recruiterM: "u-rm",
  officerA: "u-oa",
  officerB: "u-ob",
  mentorUserOk: "u-m1",
  mentorUserPending: "u-m2",
  mentorOk: "m-1",
  mentorPending: "m-2",
  /** College A, 2026, Pune, 85, public, react 80 + verified repo (120 own) + live app + endorsed. */
  asha: "s-asha",
  /** College A, 2027, Surat, 60, recruiters-only, node 65 + small repo + passed check. */
  bhavin: "s-bhavin",
  /** College B, 2026, Pune, 75, HIDDEN, react 90. Applied to company K's job. */
  chirag: "s-chirag",
  /** College B, 2026, Mumbai, 40, public, react 30, unverified repo, endorsement by unverified mentor. */
  diya: "s-diya",
  skillReact: "sk-react",
  skillNode: "sk-node",
  jobK: "job-k",
  jobM: "job-m",
  cardK: "card-k",
  cardM: "card-m",
  shortlistM: "sl-m",
  savedM: "ss-m",
  driveA: "drive-a",
  driveB: "drive-b",
  check: "chk-1",
} as const;

export async function seedWorld(db: Db) {
  const s = schema;
  const days = (n: number) => new Date(Date.now() - n * 86_400_000);
  await db.insert(s.colleges).values([
    { id: ids.collegeA, name: "Alpha Institute", shortName: "Alpha", slug: "alpha", city: "Pune", state: "MH", domain: "alpha.example" },
    { id: ids.collegeB, name: "Beta College", shortName: "Beta", slug: "beta", city: "Mumbai", state: "MH", domain: "beta.example" },
  ]);
  await db.insert(s.companies).values([
    { id: ids.companyK, name: "Kite", slug: "kite", domain: "kite.example" },
    { id: ids.companyM, name: "Monsoon", slug: "monsoon", domain: "monsoon.example" },
  ]);
  const u = (id: string, name: string, role: schema.UserRole, extra: Partial<typeof s.users.$inferInsert> = {}) => ({
    id,
    name,
    email: `${id}@test.example`,
    role,
    ...extra,
  });
  await db.insert(s.users).values([
    u(ids.recruiterK, "Rita K", "recruiter", { companyId: ids.companyK }),
    u(ids.recruiterM, "Ravi M", "recruiter", { companyId: ids.companyM }),
    u(ids.officerA, "Officer A", "college", { collegeId: ids.collegeA }),
    u(ids.officerB, "Officer B", "college", { collegeId: ids.collegeB }),
    u(ids.mentorUserOk, "Mentor Ok", "mentor"),
    u(ids.mentorUserPending, "Mentor Pending", "mentor"),
    u(ids.asha, "Asha Rao", "student"),
    u(ids.bhavin, "Bhavin Shah", "student"),
    u(ids.chirag, "Chirag Patel", "student"),
    u(ids.diya, "Diya Nair", "student"),
  ]);
  await db.insert(s.studentProfiles).values([
    { userId: ids.asha, handle: "asha", collegeId: ids.collegeA, graduationYear: 2026, branch: "Computer", location: "Pune", visibility: "public", proofScore: 85, searchText: "Asha Rao frontend offline sync tiffin tracker react" },
    { userId: ids.bhavin, handle: "bhavin", collegeId: ids.collegeA, graduationYear: 2027, branch: "IT", location: "Surat", visibility: "recruiters", proofScore: 60, searchText: "Bhavin Shah backend payments node" },
    { userId: ids.chirag, handle: "chirag", collegeId: ids.collegeB, graduationYear: 2026, branch: "Computer", location: "Pune", visibility: "hidden", proofScore: 75, searchText: "Chirag Patel react offline" },
    { userId: ids.diya, handle: "diya", collegeId: ids.collegeB, graduationYear: 2026, branch: "IT", location: "Mumbai", visibility: "public", proofScore: 40, searchText: "Diya Nair react dashboards" },
  ]);
  await db.insert(s.skills).values([
    { id: ids.skillReact, slug: "react", name: "React", category: "framework" },
    { id: ids.skillNode, slug: "nodejs", name: "Node.js", category: "framework" },
  ]);
  await db.insert(s.profileSkills).values([
    { userId: ids.asha, skillId: ids.skillReact, proofScore: 80, evidenceCount: 3 },
    { userId: ids.asha, skillId: ids.skillNode, proofScore: 0, evidenceCount: 0 },
    { userId: ids.bhavin, skillId: ids.skillNode, proofScore: 65, evidenceCount: 2 },
    { userId: ids.chirag, skillId: ids.skillReact, proofScore: 90, evidenceCount: 4 },
    { userId: ids.diya, skillId: ids.skillReact, proofScore: 30, evidenceCount: 1 },
  ]);
  await db.insert(s.repos).values([
    { id: "r-asha", userId: ids.asha, owner: "a", name: "tiffin", fullName: "a/tiffin", url: "https://github.com/a/tiffin", status: "verified" },
    { id: "r-bhavin", userId: ids.bhavin, owner: "b", name: "pay", fullName: "b/pay", url: "https://github.com/b/pay", status: "verified" },
    { id: "r-diya", userId: ids.diya, owner: "d", name: "dash", fullName: "d/dash", url: "https://github.com/d/dash", status: "pending" },
  ]);
  await db.insert(s.repoStats).values([
    { repoId: "r-asha", totalCommits: 150, ownCommits: 120, authorshipShare: 0.8 },
    { repoId: "r-bhavin", totalCommits: 40, ownCommits: 30, authorshipShare: 0.75 },
    { repoId: "r-diya", totalCommits: 300, ownCommits: 300, authorshipShare: 1, redFlags: ["all_commits_one_day"] },
  ]);
  await db.insert(s.deployments).values([
    { userId: ids.asha, url: "https://tiffin.example", token: "t1", status: "verified", verifiedAt: days(2) },
    { userId: ids.bhavin, url: "https://pay.example", token: "t2", status: "failed" },
  ]);
  await db.insert(s.skillChecks).values({ id: ids.check, slug: "arrays", title: "Arrays", level: "beginner", prompt: "x", starterCode: "x", entryFunction: "f" });
  await db.insert(s.checkAttempts).values([
    { userId: ids.bhavin, skillCheckId: ids.check, status: "passed", score: 90 },
    { userId: ids.diya, skillCheckId: ids.check, status: "failed", score: 20 },
  ]);
  await db.insert(s.mentors).values([
    { id: ids.mentorOk, userId: ids.mentorUserOk, organization: "Alpha", orgType: "college", emailDomain: "alpha.example", domainVerifiedAt: days(30) },
    { id: ids.mentorPending, userId: ids.mentorUserPending, organization: "Nowhere", orgType: "company", emailDomain: "nowhere.example" },
  ]);
  await db.insert(s.attestations).values([
    { mentorId: ids.mentorOk, studentUserId: ids.asha, subjectType: "skill", skillId: ids.skillReact, status: "endorsed" },
    { mentorId: ids.mentorPending, studentUserId: ids.diya, subjectType: "skill", skillId: ids.skillReact, status: "endorsed" },
  ]);
  await db.insert(s.jobs).values([
    { id: ids.jobK, companyId: ids.companyK, title: "Frontend", description: "Build things for Kite", location: "Pune", requiredSkills: [{ skillSlug: "react", minScore: 70 }] },
    { id: ids.jobM, companyId: ids.companyM, title: "Backend", description: "Build things for Monsoon", location: "Mumbai" },
  ]);
  await db.insert(s.applications).values({ jobId: ids.jobK, studentUserId: ids.chirag, stage: "offer" });
  await db.insert(s.pipelineCards).values([
    { id: ids.cardK, companyId: ids.companyK, studentUserId: ids.asha, stage: "sourced", position: 1024 },
    { id: ids.cardM, companyId: ids.companyM, studentUserId: ids.bhavin, stage: "interview", position: 1024 },
  ]);
  await db.insert(s.shortlists).values({ id: ids.shortlistM, companyId: ids.companyM, ownerUserId: ids.recruiterM, name: "Monsoon list" });
  await db.insert(s.savedSearches).values({ id: ids.savedM, companyId: ids.companyM, ownerUserId: ids.recruiterM, name: "Node", filters: { skills: ["nodejs"] } });
  await db.insert(s.notes).values({ companyId: ids.companyM, authorUserId: ids.recruiterM, studentUserId: ids.asha, body: "Monsoon-only note" });
  await db.insert(s.drives).values([
    { id: ids.driveA, collegeId: ids.collegeA, companyName: "Kite", title: "Kite drive", eligibility: { minProofScore: 70 } },
    { id: ids.driveB, collegeId: ids.collegeB, companyName: "Monsoon", title: "Monsoon drive" },
  ]);
  await db.insert(s.driveStudents).values([
    { driveId: ids.driveA, studentUserId: ids.asha, status: "selected", result: "=HYPERLINK(\"http://x\")" },
    { driveId: ids.driveB, studentUserId: ids.diya, status: "registered" },
  ]);
}
