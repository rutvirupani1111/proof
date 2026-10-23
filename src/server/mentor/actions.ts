"use server";

/**
 * Mentor mutations. Every action: assertRole("mentor") -> Zod parse -> scope by the session
 * mentor's own row. Trust-bearing actions (endorse) also require a verified domain.
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { attestations, colleges, companies, evidence, mentors, notifications, skills, users } from "@/db/schema";
import { emailDomain } from "@/lib/handle";
import { fieldErrors } from "@/lib/validation/auth";
import {
  declineSchema,
  directEndorseSchema,
  domainTokenSchema,
  endorseSchema,
  mentorProfileSchema,
  revokeSchema,
} from "@/lib/validation/mentor";
import { AuthError, assertRole } from "@/server/auth/guard";
import { recordVerifiedEvidence, revokeEvidence } from "@/server/verify/evidence";
import {
  DomainVerificationError,
  consumeDomainMagicLink,
  createDomainMagicLink,
  institutionalEmailProblem,
  peekDomainMagicLink,
} from "@/server/verify/domain";
import { findEndorsableStudent, getMentorForUser } from "./queries";

type Fail = { ok: false; error?: string; errors?: Record<string, string> };
type Ok<T> = { ok: true } & T;

function failFrom(err: unknown): Fail {
  if (err instanceof AuthError || err instanceof DomainVerificationError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Try again." };
}

async function baseUrl(): Promise<string> {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:5190";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function refresh() {
  revalidatePath("/mentor", "layout");
}

/* ------------------------------------------------------------------ profile + domain */

export async function saveMentorProfile(input: unknown): Promise<Ok<{ created: boolean }> | Fail> {
  try {
    const user = await assertRole("mentor");
    const parsed = mentorProfileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const domain = emailDomain(user.email);
    const db = await getDb();
    const [college, company] = await Promise.all([
      db.query.colleges.findFirst({ where: eq(colleges.domain, domain), columns: { id: true } }),
      db.query.companies.findFirst({ where: eq(companies.domain, domain), columns: { id: true } }),
    ]);
    const values = {
      title: parsed.data.title,
      organization: parsed.data.organization,
      orgType: parsed.data.orgType,
      bio: parsed.data.bio,
      collegeId: parsed.data.orgType === "college" ? (college?.id ?? null) : null,
      companyId: parsed.data.orgType === "company" ? (company?.id ?? null) : null,
    };
    const existing = await getMentorForUser(user.id);
    if (existing) {
      await db.update(mentors).set(values).where(eq(mentors.id, existing.id));
    } else {
      await db.insert(mentors).values({ ...values, userId: user.id, emailDomain: domain });
    }
    refresh();
    return { ok: true, created: !existing };
  } catch (err) {
    return failFrom(err);
  }
}

export async function requestDomainLink(): Promise<
  Ok<{ delivered: boolean; link: string | null; email: string; alreadyVerified: boolean }> | Fail
> {
  try {
    const user = await assertRole("mentor");
    const mentor = await getMentorForUser(user.id);
    if (!mentor) return { ok: false, error: "Save your mentor profile first." };
    if (mentor.domainVerifiedAt) return { ok: true, delivered: false, link: null, email: user.email, alreadyVerified: true };
    const problem = institutionalEmailProblem(user.email);
    if (problem) return { ok: false, error: problem };
    const { link, delivered } = await createDomainMagicLink({
      userId: user.id,
      email: user.email,
      purpose: "mentor",
      baseUrl: await baseUrl(),
    });
    // The link is only ever shown on screen when no email provider is configured.
    return { ok: true, delivered, link: delivered ? null : link, email: user.email, alreadyVerified: false };
  } catch (err) {
    return failFrom(err);
  }
}

export async function confirmDomainVerification(input: unknown): Promise<Ok<{ domain: string }> | Fail> {
  try {
    const user = await assertRole("mentor");
    const parsed = domainTokenSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "This link is malformed. Request a new one." };
    // Peek first so a different signed-in account cannot burn someone else's link.
    const peek = await peekDomainMagicLink(parsed.data.token);
    if (!peek || peek.purpose !== "mentor") return { ok: false, error: "This link has expired or was already used. Request a new one." };
    if (peek.userId !== user.id) return { ok: false, error: "This link belongs to a different account. Sign in as the mentor it was sent to." };
    const consumed = await consumeDomainMagicLink(parsed.data.token);
    if (!consumed || consumed.userId !== user.id) return { ok: false, error: "This link has expired or was already used." };

    const db = await getDb();
    const mentor = await getMentorForUser(user.id);
    if (!mentor) return { ok: false, error: "Save your mentor profile first." };
    const now = new Date();
    await db.update(mentors).set({ domainVerifiedAt: now, emailDomain: consumed.domain }).where(eq(mentors.id, mentor.id));
    await db.update(users).set({ domainVerification: "verified" }).where(eq(users.id, user.id));
    await db.insert(notifications).values({
      userId: user.id,
      type: "domain.verified",
      title: `Verified mentor at @${consumed.domain}`,
      body: "Your endorsements now carry your institution's name.",
      href: "/mentor/requests",
    });
    refresh();
    return { ok: true, domain: consumed.domain };
  } catch (err) {
    return failFrom(err);
  }
}

/* ------------------------------------------------------------------ endorsements */

async function verifiedMentor(userId: string) {
  const mentor = await getMentorForUser(userId);
  if (!mentor) throw new AuthError(403, "Set up your mentor profile first.");
  if (!mentor.domainVerifiedAt) throw new AuthError(403, "Verify your institutional domain before endorsing.");
  return mentor;
}

/** Skills an endorsement supports: the skill itself, or the endorsed project's evidence skills. */
async function skillsFor(a: { skillId: string | null; repoId: string | null; deploymentId: string | null }) {
  const db = await getDb();
  if (a.skillId) {
    const s = await db.query.skills.findFirst({ where: eq(skills.id, a.skillId) });
    if (s) return { slugs: [s.slug], label: s.name };
  }
  const sourceId = a.repoId ?? a.deploymentId;
  if (sourceId) {
    const ev = await db.query.evidence.findFirst({
      where: and(eq(evidence.kind, a.repoId ? "repo_authorship" : "deployment"), eq(evidence.sourceId, sourceId)),
      columns: { skillSlugs: true, title: true },
    });
    return { slugs: ev?.skillSlugs ?? [], label: "project" };
  }
  return { slugs: [] as string[], label: "work" };
}

export async function endorseRequest(
  input: unknown,
): Promise<Ok<{ credentialId: string; studentName: string; subject: string }> | Fail> {
  try {
    const user = await assertRole("mentor");
    const parsed = endorseSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const mentor = await verifiedMentor(user.id);
    const db = await getDb();
    const now = new Date();
    const [att] = await db
      .update(attestations)
      .set({ status: "endorsed", statement: parsed.data.statement, relationship: parsed.data.relationship, respondedAt: now })
      .where(
        and(
          eq(attestations.id, parsed.data.attestationId),
          eq(attestations.mentorId, mentor.id),
          eq(attestations.status, "requested"),
        ),
      )
      .returning();
    if (!att) return { ok: false, error: "This request is no longer open." };
    const student = await db.query.users.findFirst({ where: eq(users.id, att.studentUserId), columns: { name: true } });
    const { slugs, label } = await skillsFor(att);
    const domain = mentor.emailDomain;
    const result = await recordVerifiedEvidence({
      userId: att.studentUserId,
      kind: "attestation",
      sourceId: att.id,
      title: `Endorsed by ${user.name}`,
      summary: `Verified mentor at @${domain}`,
      skillSlugs: slugs,
      weight: 1.3,
      data: {
        mentor: user.name,
        domain,
        statement: parsed.data.statement,
        relationship: parsed.data.relationship,
        subjectType: att.subjectType,
      },
      notify: {
        title: `${user.name} endorsed your ${label} work`,
        body: `Verified mentor at @${domain}`,
        href: "/student/proofs?tab=endorsements",
      },
    });
    refresh();
    return { ok: true, credentialId: result.credentialId, studentName: student?.name ?? "The student", subject: label };
  } catch (err) {
    return failFrom(err);
  }
}

export async function declineRequest(input: unknown): Promise<Ok<object> | Fail> {
  try {
    const user = await assertRole("mentor");
    const parsed = declineSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const mentor = await getMentorForUser(user.id);
    if (!mentor) return { ok: false, error: "Set up your mentor profile first." };
    const db = await getDb();
    const [att] = await db
      .update(attestations)
      .set({ status: "declined", respondedAt: new Date() })
      .where(
        and(
          eq(attestations.id, parsed.data.attestationId),
          eq(attestations.mentorId, mentor.id),
          eq(attestations.status, "requested"),
        ),
      )
      .returning({ studentUserId: attestations.studentUserId });
    if (!att) return { ok: false, error: "This request is no longer open." };
    await db.insert(notifications).values({
      userId: att.studentUserId,
      type: "attestation.declined",
      title: `${user.name} could not endorse this request`,
      body: parsed.data.note ?? "You can ask another mentor who has seen this work first-hand.",
      href: "/student/proofs?tab=endorsements",
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return failFrom(err);
  }
}

export async function revokeEndorsement(input: unknown): Promise<Ok<object> | Fail> {
  try {
    const user = await assertRole("mentor");
    const parsed = revokeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Missing endorsement." };
    const mentor = await getMentorForUser(user.id);
    if (!mentor) return { ok: false, error: "Set up your mentor profile first." };
    const db = await getDb();
    const [att] = await db
      .update(attestations)
      .set({ status: "revoked", respondedAt: new Date() })
      .where(
        and(
          eq(attestations.id, parsed.data.attestationId),
          eq(attestations.mentorId, mentor.id),
          eq(attestations.status, "endorsed"),
        ),
      )
      .returning({ id: attestations.id, studentUserId: attestations.studentUserId });
    if (!att) return { ok: false, error: "This endorsement is not active." };
    await revokeEvidence(att.studentUserId, "attestation", att.id);
    await db.insert(notifications).values({
      userId: att.studentUserId,
      type: "attestation.revoked",
      title: `${user.name} withdrew an endorsement`,
      body: "Its credential is now marked revoked and no longer counts toward your Proof Score.",
      href: "/student/proofs?tab=endorsements",
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return failFrom(err);
  }
}

export async function endorseStudentDirect(
  input: unknown,
): Promise<Ok<{ credentialId: string; studentName: string; subject: string }> | Fail> {
  try {
    const user = await assertRole("mentor");
    const parsed = directEndorseSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const mentor = await verifiedMentor(user.id);
    const db = await getDb();
    const [student, skill] = await Promise.all([
      findEndorsableStudent(parsed.data.handle),
      db.query.skills.findFirst({ where: eq(skills.slug, parsed.data.skillSlug) }),
    ]);
    if (!student) return { ok: false, errors: { handle: "No visible student with that handle." } };
    if (!skill) return { ok: false, errors: { skillSlug: "Choose a skill from the list." } };
    if (student.userId === user.id) return { ok: false, errors: { handle: "You cannot endorse yourself." } };
    const dup = await db.query.attestations.findFirst({
      where: and(
        eq(attestations.mentorId, mentor.id),
        eq(attestations.studentUserId, student.userId),
        eq(attestations.skillId, skill.id),
        eq(attestations.status, "endorsed"),
      ),
      columns: { id: true },
    });
    if (dup) return { ok: false, error: `You already endorse ${student.name}'s ${skill.name} work.` };

    const now = new Date();
    const [att] = await db
      .insert(attestations)
      .values({
        mentorId: mentor.id,
        studentUserId: student.userId,
        subjectType: "skill",
        skillId: skill.id,
        relationship: parsed.data.relationship,
        statement: parsed.data.statement,
        status: "endorsed",
        requestedAt: now,
        respondedAt: now,
      })
      .returning();
    const domain = mentor.emailDomain;
    const result = await recordVerifiedEvidence({
      userId: student.userId,
      kind: "attestation",
      sourceId: att!.id,
      title: `Endorsed by ${user.name}`,
      summary: `Verified mentor at @${domain}`,
      skillSlugs: [skill.slug],
      weight: 1.3,
      data: { mentor: user.name, domain, statement: parsed.data.statement, relationship: parsed.data.relationship, subjectType: "skill" },
      notify: {
        title: `${user.name} endorsed your ${skill.name} work`,
        body: `Verified mentor at @${domain}`,
        href: "/student/proofs?tab=endorsements",
      },
    });
    refresh();
    return { ok: true, credentialId: result.credentialId, studentName: student.name, subject: skill.name };
  } catch (err) {
    return failFrom(err);
  }
}
