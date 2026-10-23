import "server-only";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attestations,
  colleges,
  credentials,
  deployments,
  evidence,
  mentors,
  repos,
  skills,
  studentProfiles,
  users,
} from "@/db/schema";

/** The signed-in mentor's row, or null before they complete "Domain & profile". */
export async function getMentorForUser(userId: string) {
  const db = await getDb();
  return (await db.query.mentors.findFirst({ where: eq(mentors.userId, userId) })) ?? null;
}

/** Endorsement summary for the signed-in mentor. */
export async function getMentorDashboard(userId: string) {
  const db = await getDb();
  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.userId, userId) });
  if (!mentor) return { mentor: null, requested: 0, endorsed: 0, students: 0 };
  const [[requested], [endorsed], studentRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(attestations)
      .where(and(eq(attestations.mentorId, mentor.id), eq(attestations.status, "requested"))),
    db
      .select({ n: count() })
      .from(attestations)
      .where(and(eq(attestations.mentorId, mentor.id), eq(attestations.status, "endorsed"))),
    db
      .selectDistinct({ id: attestations.studentUserId })
      .from(attestations)
      .where(and(eq(attestations.mentorId, mentor.id), eq(attestations.status, "endorsed"))),
  ]);
  return { mentor, requested: requested?.n ?? 0, endorsed: endorsed?.n ?? 0, students: studentRows.length };
}

export type AttestationRow = Awaited<ReturnType<typeof listMentorAttestations>>[number];

/**
 * Attestations addressed to ONE mentor (pass the session mentor's id), with what the student
 * asked them to vouch for. `scope`: the inbox (requested) or the given list (endorsed/revoked).
 */
export async function listMentorAttestations(mentorId: string, scope: "requests" | "given", limit = 100) {
  const db = await getDb();
  const statusFilter =
    scope === "requests"
      ? eq(attestations.status, "requested")
      : inArray(attestations.status, ["endorsed", "revoked"]);
  const rows = await db
    .select({
      id: attestations.id,
      status: attestations.status,
      subjectType: attestations.subjectType,
      relationship: attestations.relationship,
      statement: attestations.statement,
      requestedAt: attestations.requestedAt,
      respondedAt: attestations.respondedAt,
      studentUserId: attestations.studentUserId,
      studentName: users.name,
      handle: studentProfiles.handle,
      headline: studentProfiles.headline,
      proofScore: studentProfiles.proofScore,
      graduationYear: studentProfiles.graduationYear,
      college: colleges.shortName,
      skillName: skills.name,
      skillSlug: skills.slug,
      repoName: repos.fullName,
      repoUrl: repos.url,
      deploymentUrl: deployments.url,
    })
    .from(attestations)
    .innerJoin(users, eq(users.id, attestations.studentUserId))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, attestations.studentUserId))
    .leftJoin(colleges, eq(colleges.id, studentProfiles.collegeId))
    .leftJoin(skills, eq(skills.id, attestations.skillId))
    .leftJoin(repos, eq(repos.id, attestations.repoId))
    .leftJoin(deployments, eq(deployments.id, attestations.deploymentId))
    .where(and(eq(attestations.mentorId, mentorId), statusFilter))
    .orderBy(scope === "requests" ? desc(attestations.requestedAt) : desc(attestations.respondedAt))
    .limit(limit);

  if (scope === "requests" || rows.length === 0) return rows.map((r) => ({ ...r, credentialId: null as string | null }));

  // Signed credential per endorsement, for the "view credential" link.
  const creds = await db
    .select({ sourceId: evidence.sourceId, credentialId: credentials.id })
    .from(evidence)
    .innerJoin(credentials, eq(credentials.evidenceId, evidence.id))
    .where(and(eq(evidence.kind, "attestation"), inArray(evidence.sourceId, rows.map((r) => r.id))));
  const byAttestation = new Map(creds.map((c) => [c.sourceId, c.credentialId]));
  return rows.map((r) => ({ ...r, credentialId: byAttestation.get(r.id) ?? null }));
}

/** Skills a mentor can vouch for (the platform taxonomy). */
export async function listSkillOptions() {
  const db = await getDb();
  return db.select({ slug: skills.slug, name: skills.name }).from(skills).orderBy(skills.name);
}

/** A student the mentor may endorse directly: exists and has not hidden their profile. */
export async function findEndorsableStudent(handle: string) {
  const db = await getDb();
  const [row] = await db
    .select({ userId: studentProfiles.userId, name: users.name, handle: studentProfiles.handle })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .where(and(eq(studentProfiles.handle, handle), ne(studentProfiles.visibility, "hidden")))
    .limit(1);
  return row ?? null;
}
