"use server";

/**
 * Proofs hub + skill-check mutations. Identity always comes from the session (assertRole);
 * every input is Zod-parsed; engines live in src/server/verify.
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { attestations, mentors, notifications, repos, skills, users } from "@/db/schema";
import {
  addDeploymentSchema,
  checkSlugSchema,
  deploymentIdSchema,
  githubUsernameSchema,
  importRepoSchema,
  requestEndorsementSchema,
  runCodeSchema,
  submitAttemptSchema,
} from "@/lib/validation/student";
import { AuthError, assertRole } from "@/server/auth/guard";
import { runSamples, startAttempt, submitAttempt } from "@/server/verify/checks";
import { addDeployment, recheckDeployment, removeDeployment, verifyDeployment } from "@/server/verify/deployments";
import { VerifyError, checkGithubProof, importRepo, listCandidateRepos, startGithubProof } from "@/server/verify/github";
import type { GradeResult } from "@/server/verify/sandbox";

export type Moment = { title: string; detail?: string; credentialId?: string; previousScore?: number; score?: number };
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof VerifyError || err instanceof AuthError) return { ok: false, error: err.message };
    console.error("[proofs]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Check the form.";

function refresh() {
  revalidatePath("/student", "layout");
}

/* ------------------------------------------------------------------ GitHub */

export async function startGithubProofAction(input: unknown): Promise<Result<{ statement: string; username: string }>> {
  return run<{ statement: string; username: string }>(async () => {
    const user = await assertRole("student");
    const parsed = githubUsernameSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const res = await startGithubProof(user.id, parsed.data.username);
    refresh();
    return { ok: true, statement: res.statement, username: res.username };
  });
}

export async function checkGithubProofAction(): Promise<Result<{ verified: boolean; message?: string; moment?: Moment }>> {
  return run<{ verified: boolean; message?: string; moment?: Moment }>(async () => {
    const user = await assertRole("student");
    const res = await checkGithubProof(user.id);
    refresh();
    if (!res.verified) return { ok: true, verified: false, message: res.message };
    return {
      ok: true,
      verified: true,
      moment: { title: res.evidence.title, detail: "Signed gist found. Your repos can now count toward authorship.", credentialId: res.credentialId, previousScore: res.previousScore, score: res.score.overall },
    };
  });
}

export async function listCandidateReposAction(): Promise<Result<{ repos: Awaited<ReturnType<typeof listCandidateRepos>> }>> {
  return run<{ repos: Awaited<ReturnType<typeof listCandidateRepos>> }>(async () => {
    const user = await assertRole("student");
    return { ok: true, repos: await listCandidateRepos(user.id) };
  });
}

export async function importRepoAction(input: unknown): Promise<Result<{ verified: boolean; message?: string; moment?: Moment }>> {
  return run<{ verified: boolean; message?: string; moment?: Moment }>(async () => {
    const user = await assertRole("student");
    const parsed = importRepoSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const res = await importRepo(user.id, parsed.data.fullName);
    refresh();
    if (!res.verified) return { ok: true, verified: false, message: res.message };
    return {
      ok: true,
      verified: true,
      moment: { title: res.evidence.title, detail: res.evidence.summary ?? undefined, credentialId: res.credentialId, previousScore: res.previousScore, score: res.score.overall },
    };
  });
}

/* ------------------------------------------------------------------ deployments */

export async function addDeploymentAction(input: unknown): Promise<Result<{ id: string; token: string; url: string }>> {
  return run<{ id: string; token: string; url: string }>(async () => {
    const user = await assertRole("student");
    const parsed = addDeploymentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const dep = await addDeployment(user.id, parsed.data.url, parsed.data.repoId ?? null);
    refresh();
    return { ok: true, id: dep.id, token: dep.token, url: dep.url };
  });
}

export async function verifyDeploymentAction(input: unknown): Promise<Result<{ verified: boolean; message?: string; moment?: Moment }>> {
  return run<{ verified: boolean; message?: string; moment?: Moment }>(async () => {
    const user = await assertRole("student");
    const parsed = deploymentIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const res = await verifyDeployment(user.id, parsed.data.deploymentId);
    refresh();
    if (!res.verified) return { ok: true, verified: false, message: res.message };
    return {
      ok: true,
      verified: true,
      moment: { title: res.evidence.title, detail: res.evidence.summary ?? undefined, credentialId: res.credentialId, previousScore: res.previousScore, score: res.score.overall },
    };
  });
}

export async function recheckDeploymentAction(input: unknown): Promise<Result<{ message: string }>> {
  return run<{ message: string }>(async () => {
    const user = await assertRole("student");
    const parsed = deploymentIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const res = await recheckDeployment(user.id, parsed.data.deploymentId);
    refresh();
    if ("healthy" in res) return { ok: true, message: res.healthy ? `Up: ${res.status} in ${res.ms} ms` : `Down right now (${res.status || "no response"})` };
    return { ok: true, message: res.verified ? "Verified" : (res.message ?? "Not verified yet") };
  });
}

export async function removeDeploymentAction(input: unknown): Promise<Result> {
  return run<object>(async () => {
    const user = await assertRole("student");
    const parsed = deploymentIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await removeDeployment(user.id, parsed.data.deploymentId);
    refresh();
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ endorsements */

export async function requestEndorsementAction(input: unknown): Promise<Result> {
  return run<object>(async () => {
    const user = await assertRole("student");
    const parsed = requestEndorsementSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const v = parsed.data;
    const db = await getDb();
    const mentor = await db.query.mentors.findFirst({ where: eq(mentors.id, v.mentorId) });
    if (!mentor?.domainVerifiedAt) return { ok: false, error: "Choose a verified mentor." };
    if (mentor.userId === user.id) return { ok: false, error: "You cannot endorse yourself." };
    let subjectLabel = "";
    if (v.subjectType === "skill") {
      const skill = await db.query.skills.findFirst({ where: eq(skills.id, v.skillId!), columns: { name: true } });
      if (!skill) return { ok: false, error: "Choose a skill." };
      subjectLabel = skill.name;
    } else {
      const repo = await db.query.repos.findFirst({ where: and(eq(repos.id, v.repoId!), eq(repos.userId, user.id)), columns: { name: true } });
      if (!repo) return { ok: false, error: "That repo is not on your profile." };
      subjectLabel = repo.name;
    }
    const open = await db.query.attestations.findFirst({
      where: and(eq(attestations.mentorId, mentor.id), eq(attestations.studentUserId, user.id), eq(attestations.status, "requested")),
      columns: { id: true },
    });
    if (open) return { ok: false, error: "You already have an open request with this mentor." };
    await db.insert(attestations).values({
      mentorId: mentor.id,
      studentUserId: user.id,
      subjectType: v.subjectType,
      skillId: v.subjectType === "skill" ? v.skillId! : null,
      repoId: v.subjectType === "project" ? v.repoId! : null,
      relationship: v.relationship,
      status: "requested",
    });
    const student = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { name: true } });
    await db.insert(notifications).values({
      userId: mentor.userId,
      type: "attestation.requested",
      title: `${student?.name ?? "A student"} asked you to endorse ${subjectLabel}`,
      body: v.relationship,
      href: "/mentor/requests",
    });
    refresh();
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ skill checks */

export async function startAttemptAction(input: unknown): Promise<Result<{ attemptId: string; startedAt: string }>> {
  return run<{ attemptId: string; startedAt: string }>(async () => {
    const user = await assertRole("student");
    const parsed = checkSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const attempt = await startAttempt(user.id, parsed.data.slug);
    return { ok: true, attemptId: attempt.id, startedAt: (attempt.startedAt ?? attempt.createdAt).toISOString() };
  });
}

export async function runSamplesAction(input: unknown): Promise<Result<{ result: GradeResult }>> {
  return run<{ result: GradeResult }>(async () => {
    const user = await assertRole("student");
    const parsed = runCodeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    return { ok: true, result: await runSamples(user.id, parsed.data.slug, parsed.data.code) };
  });
}

export async function submitAttemptAction(
  input: unknown,
): Promise<Result<{ passed: boolean; result: GradeResult; overtime: boolean; timeTakenSec: number; attempts: number; moment?: Moment }>> {
  return run<{ passed: boolean; result: GradeResult; overtime: boolean; timeTakenSec: number; attempts: number; moment?: Moment }>(async () => {
    const user = await assertRole("student");
    const parsed = submitAttemptSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const res = await submitAttempt(user.id, parsed.data);
    refresh();
    const base = { passed: res.passed, result: res.result, overtime: res.overtime, timeTakenSec: res.timeTakenSec, attempts: res.attempts };
    if (!res.passed) return { ok: true, ...base };
    return {
      ok: true,
      ...base,
      moment: { title: res.evidence.title, detail: res.evidence.summary ?? undefined, credentialId: res.credentialId, previousScore: res.previousScore, score: res.score.overall },
    };
  });
}
