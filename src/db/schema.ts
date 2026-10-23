/**
 * Proof data model: the whole product, in one file.
 *
 * Conventions
 * - Primary keys are `text` ids. Our tables default to `crypto.randomUUID()`; Better Auth
 *   generates its own ids for the four auth tables (users, sessions, accounts, verifications).
 * - Columns are snake_case in SQL and camelCase in TypeScript, always named explicitly.
 * - Every timestamp is `timestamptz`. `created_at` defaults to now(); `updated_at` is
 *   refreshed by Drizzle's `$onUpdate`.
 * - Enums are Postgres enums (pgEnum). Their TS unions are exported from the bottom of this file.
 * - "Student" rows are keyed by `users.id` (student_profiles.user_id is unique), so foreign keys
 *   to a student point at `users.id`, never at student_profiles.id.
 *
 * After editing: `npm run db:generate` (writes SQL to drizzle/), then `npm run db:migrate`.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const ts = (name: string) => timestamp(name, { withTimezone: true });

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const userRole = pgEnum("user_role", ["student", "recruiter", "college", "mentor", "admin"]);
/** Institutional email-domain verification for recruiters, colleges and mentors (stubbed in v1). */
export const domainVerificationStatus = pgEnum("domain_verification_status", [
  "not_required",
  "pending",
  "verified",
  "rejected",
]);
export const profileVisibility = pgEnum("profile_visibility", ["public", "recruiters", "hidden"]);
export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "verified",
  "failed",
  "revoked",
]);
export const evidenceKind = pgEnum("evidence_kind", [
  "github_ownership",
  "repo_authorship",
  "deployment",
  "skill_check",
  "attestation",
]);
export const skillCategory = pgEnum("skill_category", [
  "language",
  "framework",
  "tooling",
  "data",
  "concept",
]);
export const checkLevel = pgEnum("check_level", ["beginner", "intermediate", "advanced"]);
export const attemptStatus = pgEnum("attempt_status", [
  "invited",
  "in_progress",
  "passed",
  "failed",
  "expired",
]);
export const attestationStatus = pgEnum("attestation_status", [
  "requested",
  "endorsed",
  "declined",
  "revoked",
]);
export const attestationSubject = pgEnum("attestation_subject", ["skill", "project"]);
export const orgType = pgEnum("org_type", ["college", "company"]);
export const jobStatus = pgEnum("job_status", ["draft", "open", "closed"]);
export const workMode = pgEnum("work_mode", ["onsite", "hybrid", "remote"]);
export const employmentType = pgEnum("employment_type", ["full_time", "internship", "contract"]);
export const applicationStage = pgEnum("application_stage", [
  "applied",
  "screening",
  "skill_check",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
]);
export const pipelineStage = pgEnum("pipeline_stage", [
  "sourced",
  "contacted",
  "skill_check",
  "interview",
  "offer",
  "hired",
  "rejected",
]);
export const driveStatus = pgEnum("drive_status", ["planned", "open", "completed", "cancelled"]);
export const driveStudentStatus = pgEnum("drive_student_status", [
  "eligible",
  "registered",
  "shortlisted",
  "selected",
  "rejected",
  "absent",
]);

/* -------------------------------------------------------------------------- */
/* Auth (Better Auth core tables + our columns on users)                      */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // ---- Proof columns (declared as Better Auth additionalFields in src/server/auth/auth.ts)
    role: userRole("role").notNull().default("student"),
    domainVerification: domainVerificationStatus("domain_verification")
      .notNull()
      .default("not_required"),
    /** Lower-cased domain of the sign-up email, e.g. "spit-surat.example". */
    emailDomain: text("email_domain"),
    /** Recruiters belong to a company; placement officers to a college. */
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    collegeId: text("college_id").references(() => colleges.id, { onDelete: "set null" }),
    onboardedAt: ts("onboarded_at"),
  },
  (t) => [index("users_role_idx").on(t.role), index("users_company_idx").on(t.companyId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/* -------------------------------------------------------------------------- */
/* Organisations                                                              */
/* -------------------------------------------------------------------------- */

export const colleges = pgTable("colleges", {
  id: id(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  slug: text("slug").notNull().unique(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  /** Email domain students and officers sign up with. */
  domain: text("domain").notNull().unique(),
  domainVerifiedAt: ts("domain_verified_at"),
  logoUrl: text("logo_url"),
  createdAt: createdAt(),
});

export const companies = pgTable("companies", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain").notNull().unique(),
  domainVerifiedAt: ts("domain_verified_at"),
  website: text("website"),
  about: text("about"),
  industry: text("industry"),
  size: text("size"),
  city: text("city"),
  logoUrl: text("logo_url"),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/* Students                                                                   */
/* -------------------------------------------------------------------------- */

export type ScoreBreakdown = {
  /** Contribution per signal, already weighted, summing to the score. */
  authorship: number;
  deployments: number;
  checks: number;
  endorsements: number;
  recency: number;
  /** Human-readable reasons shown in the "why 82?" drawer. */
  reasons: string[];
};

export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Public handle for /u/{handle}. Lower-case, [a-z0-9-]. */
    handle: text("handle").notNull().unique(),
    collegeId: text("college_id").references(() => colleges.id, { onDelete: "set null" }),
    graduationYear: integer("graduation_year"),
    degree: text("degree"),
    branch: text("branch"),
    headline: text("headline"),
    about: text("about"),
    location: text("location"),
    targetRoles: text("target_roles").array().notNull().default(sql`'{}'::text[]`),
    visibility: profileVisibility("visibility").notNull().default("recruiters"),
    accentColor: text("accent_color"),
    pinnedEvidenceIds: text("pinned_evidence_ids").array().notNull().default(sql`'{}'::text[]`),
    openToWork: boolean("open_to_work").notNull().default(true),
    /** Overall Proof Score 0-100, recomputed by the scoring engine. */
    proofScore: integer("proof_score").notNull().default(0),
    scoreBreakdown: jsonb("score_breakdown").$type<ScoreBreakdown>(),
    scoreUpdatedAt: ts("score_updated_at"),
    /** Denormalised text the recruiter full-text search indexes (name, headline, skills, repos). */
    searchText: text("search_text").notNull().default(""),
    onboardingStep: integer("onboarding_step").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("student_profiles_college_idx").on(t.collegeId),
    index("student_profiles_score_idx").on(t.proofScore),
    index("student_profiles_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.searchText})`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Verification engine sources                                                */
/* -------------------------------------------------------------------------- */

/** GitHub ownership via a public gist named proof.md containing handle + nonce (no OAuth). */
export const githubAccounts = pgTable("github_accounts", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  githubId: integer("github_id"),
  avatarUrl: text("avatar_url"),
  nonce: text("nonce").notNull(),
  gistId: text("gist_id"),
  gistUrl: text("gist_url"),
  status: verificationStatus("status").notNull().default("pending"),
  verifiedAt: ts("verified_at"),
  /** ETag of the last /users/{u}/gists response, for conditional requests. */
  etag: text("etag"),
  lastCheckedAt: ts("last_checked_at"),
  createdAt: createdAt(),
});

export const repos = pgTable(
  "repos",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    githubAccountId: text("github_account_id").references(() => githubAccounts.id, {
      onDelete: "cascade",
    }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    homepage: text("homepage"),
    isFork: boolean("is_fork").notNull().default(false),
    primaryLanguage: text("primary_language"),
    /** Bytes per language from GET /repos/{o}/{r}/languages. */
    languages: jsonb("languages").$type<Record<string, number>>().notNull().default({}),
    stars: integer("stars").notNull().default(0),
    ghCreatedAt: ts("gh_created_at"),
    ghPushedAt: ts("gh_pushed_at"),
    /** The student chose this repo as evidence. */
    selected: boolean("selected").notNull().default(true),
    status: verificationStatus("status").notNull().default("pending"),
    etag: text("etag"),
    importedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("repos_user_fullname_uq").on(t.userId, t.fullName),
    index("repos_user_idx").on(t.userId),
  ],
);

export const repoStats = pgTable("repo_stats", {
  id: id(),
  repoId: text("repo_id")
    .notNull()
    .unique()
    .references(() => repos.id, { onDelete: "cascade" }),
  totalCommits: integer("total_commits").notNull().default(0),
  ownCommits: integer("own_commits").notNull().default(0),
  /** ownCommits / totalCommits, 0..1. */
  authorshipShare: doublePrecision("authorship_share").notNull().default(0),
  activeWeeks: integer("active_weeks").notNull().default(0),
  firstCommitAt: ts("first_commit_at"),
  lastCommitAt: ts("last_commit_at"),
  /** e.g. ["all_commits_one_day", "bulk_import", "backdated_history"] */
  redFlags: text("red_flags").array().notNull().default(sql`'{}'::text[]`),
  computedAt: createdAt(),
});

/** Live deployments proven by <meta name="proof-verification"> or /.well-known/proof.txt. */
export const deployments = pgTable(
  "deployments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repoId: text("repo_id").references(() => repos.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    token: text("token").notNull(),
    method: text("method").$type<"meta" | "well_known">(),
    status: verificationStatus("status").notNull().default("pending"),
    homepageMatchesRepo: boolean("homepage_matches_repo").notNull().default(false),
    lastStatusCode: integer("last_status_code"),
    lastResponseMs: integer("last_response_ms"),
    lastCheckedAt: ts("last_checked_at"),
    verifiedAt: ts("verified_at"),
    createdAt: createdAt(),
  },
  (t) => [index("deployments_user_idx").on(t.userId)],
);

export type CheckTest = { name: string; args: unknown[]; expected: unknown };

/** Timed in-browser coding tasks, graded server-side in a QuickJS sandbox. */
export const skillChecks = pgTable("skill_checks", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  skillId: text("skill_id").references(() => skills.id, { onDelete: "set null" }),
  level: checkLevel("level").notNull(),
  language: text("language").notNull().default("javascript"),
  /** Markdown task statement. */
  prompt: text("prompt").notNull(),
  starterCode: text("starter_code").notNull(),
  /** Name of the function the hidden tests call. */
  entryFunction: text("entry_function").notNull(),
  /** Visible examples. */
  sampleTests: jsonb("sample_tests").$type<CheckTest[]>().notNull().default([]),
  /** Never sent to the client. */
  hiddenTests: jsonb("hidden_tests").$type<CheckTest[]>().notNull().default([]),
  timeLimitSec: integer("time_limit_sec").notNull().default(1200),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: createdAt(),
});

export const checkAttempts = pgTable(
  "check_attempts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillCheckId: text("skill_check_id")
      .notNull()
      .references(() => skillChecks.id, { onDelete: "cascade" }),
    /** Set when a recruiter invited the student to this check. */
    invitedByUserId: text("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: attemptStatus("status").notNull().default("in_progress"),
    code: text("code"),
    /** 0-100 */
    score: integer("score"),
    passedTests: integer("passed_tests").notNull().default(0),
    totalTests: integer("total_tests").notNull().default(0),
    startedAt: ts("started_at"),
    submittedAt: ts("submitted_at"),
    timeTakenSec: integer("time_taken_sec"),
    /** Shown to recruiters, never auto-penalised. */
    pasteEvents: integer("paste_events").notNull().default(0),
    tabBlurs: integer("tab_blurs").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("check_attempts_user_idx").on(t.userId),
    index("check_attempts_check_idx").on(t.skillCheckId),
  ],
);

export const mentors = pgTable("mentors", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  organization: text("organization").notNull(),
  orgType: orgType("org_type").notNull(),
  collegeId: text("college_id").references(() => colleges.id, { onDelete: "set null" }),
  companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
  /** Domain the mentor proved control of via magic link, shown as "Verified mentor at @domain". */
  emailDomain: text("email_domain").notNull(),
  domainVerifiedAt: ts("domain_verified_at"),
  bio: text("bio"),
  createdAt: createdAt(),
});

export const attestations = pgTable(
  "attestations",
  {
    id: id(),
    mentorId: text("mentor_id")
      .notNull()
      .references(() => mentors.id, { onDelete: "cascade" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectType: attestationSubject("subject_type").notNull(),
    skillId: text("skill_id").references(() => skills.id, { onDelete: "set null" }),
    /** For project endorsements: the repo or deployment being endorsed. */
    repoId: text("repo_id").references(() => repos.id, { onDelete: "set null" }),
    deploymentId: text("deployment_id").references(() => deployments.id, { onDelete: "set null" }),
    relationship: text("relationship"),
    statement: text("statement"),
    status: attestationStatus("status").notNull().default("requested"),
    requestedAt: createdAt(),
    respondedAt: ts("responded_at"),
  },
  (t) => [
    index("attestations_student_idx").on(t.studentUserId),
    index("attestations_mentor_idx").on(t.mentorId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Evidence + credentials                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Polymorphic evidence: one row per verified item, pointing at its source row by
 * (kind, sourceId): github_accounts | repos | deployments | check_attempts | attestations.
 */
export const evidence = pgTable(
  "evidence",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: evidenceKind("kind").notNull(),
    sourceId: text("source_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    /** Skill slugs this evidence supports. */
    skillSlugs: text("skill_slugs").array().notNull().default(sql`'{}'::text[]`),
    /** Snapshot of the facts at verification time (commit counts, status code, score...). */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    /** Contribution weight used by the scoring engine. */
    weight: doublePrecision("weight").notNull().default(1),
    status: verificationStatus("status").notNull().default("pending"),
    verifiedAt: ts("verified_at"),
    occurredAt: ts("occurred_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("evidence_kind_source_uq").on(t.kind, t.sourceId),
    index("evidence_user_idx").on(t.userId),
  ],
);

/** W3C Verifiable Credential, Ed25519-signed with the platform key (stored in app_secrets). */
export const credentials = pgTable(
  "credentials",
  {
    id: id(),
    evidenceId: text("evidence_id")
      .notNull()
      .unique()
      .references(() => evidence.id, { onDelete: "cascade" }),
    subjectUserId: text("subject_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    /** The complete signed VC JSON-LD document, exactly as issued. */
    vc: jsonb("vc").$type<Record<string, unknown>>().notNull(),
    keyId: text("key_id").notNull(),
    issuedAt: createdAt(),
    expiresAt: ts("expires_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("credentials_subject_idx").on(t.subjectUserId)],
);

/* -------------------------------------------------------------------------- */
/* Skills + score                                                             */
/* -------------------------------------------------------------------------- */

export const skills = pgTable("skills", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: skillCategory("category").notNull(),
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
});

export const profileSkills = pgTable(
  "profile_skills",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    /** Student said they want to prove this (onboarding); score may still be 0. */
    claimed: boolean("claimed").notNull().default(true),
    /** Proof Score for this skill, 0-100. */
    proofScore: integer("proof_score").notNull().default(0),
    breakdown: jsonb("breakdown").$type<ScoreBreakdown>(),
    evidenceCount: integer("evidence_count").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("profile_skills_user_skill_uq").on(t.userId, t.skillId),
    index("profile_skills_skill_score_idx").on(t.skillId, t.proofScore),
  ],
);

/* -------------------------------------------------------------------------- */
/* Hiring                                                                     */
/* -------------------------------------------------------------------------- */

export type JobSkillRequirement = { skillSlug: string; minScore: number };

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    postedByUserId: text("posted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    location: text("location").notNull(),
    workMode: workMode("work_mode").notNull().default("onsite"),
    employmentType: employmentType("employment_type").notNull().default("full_time"),
    /** Annual CTC in INR for full-time, monthly stipend in INR for internships. */
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    requiredSkills: jsonb("required_skills").$type<JobSkillRequirement[]>().notNull().default([]),
    minProofScore: integer("min_proof_score").notNull().default(0),
    openings: integer("openings").notNull().default(1),
    status: jobStatus("status").notNull().default("open"),
    applyBy: ts("apply_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jobs_company_idx").on(t.companyId), index("jobs_status_idx").on(t.status)],
);

export const applications = pgTable(
  "applications",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stage: applicationStage("stage").notNull().default("applied"),
    coverNote: text("cover_note"),
    appliedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("applications_job_student_uq").on(t.jobId, t.studentUserId),
    index("applications_student_idx").on(t.studentUserId),
  ],
);

export const shortlists = pgTable(
  "shortlists",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [index("shortlists_company_idx").on(t.companyId)],
);

export const shortlistEntries = pgTable(
  "shortlist_entries",
  {
    id: id(),
    shortlistId: text("shortlist_id")
      .notNull()
      .references(() => shortlists.id, { onDelete: "cascade" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedByUserId: text("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shortlist_entries_uq").on(t.shortlistId, t.studentUserId)],
);

export type SearchFilters = {
  q?: string;
  skills?: string[];
  minScore?: number;
  hasDeployment?: boolean;
  minOwnCommits?: number;
  passedCheck?: boolean;
  mentorEndorsed?: boolean;
  collegeIds?: string[];
  graduationYears?: number[];
  location?: string;
};

export const savedSearches = pgTable("saved_searches", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: jsonb("filters").$type<SearchFilters>().notNull().default({}),
  createdAt: createdAt(),
});

/** Recruiter kanban. `position` is a sparse float for cheap drag-and-drop reordering. */
export const pipelineCards = pgTable(
  "pipeline_cards",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: text("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    stage: pipelineStage("stage").notNull().default("sourced"),
    position: doublePrecision("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("pipeline_cards_company_stage_idx").on(t.companyId, t.stage, t.position),
    uniqueIndex("pipeline_cards_company_job_student_uq").on(t.companyId, t.jobId, t.studentUserId),
  ],
);

/** Direct messages. A thread is the unordered pair (sender, recipient). */
export const messages = pgTable(
  "messages",
  {
    id: id(),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_recipient_idx").on(t.recipientUserId, t.createdAt),
    index("messages_sender_idx").on(t.senderUserId, t.createdAt),
  ],
);

/** Private recruiter notes about a candidate, visible to the whole company. */
export const notes = pgTable(
  "notes",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("notes_company_student_idx").on(t.companyId, t.studentUserId)],
);

/* -------------------------------------------------------------------------- */
/* Colleges: placement drives                                                 */
/* -------------------------------------------------------------------------- */

export type DriveEligibility = {
  minProofScore?: number;
  graduationYears?: number[];
  branches?: string[];
  skills?: string[];
};

export const drives = pgTable(
  "drives",
  {
    id: id(),
    collegeId: text("college_id")
      .notNull()
      .references(() => colleges.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    /** Free text for companies not on Proof. */
    companyName: text("company_name").notNull(),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    scheduledAt: ts("scheduled_at"),
    location: text("location"),
    eligibility: jsonb("eligibility").$type<DriveEligibility>().notNull().default({}),
    status: driveStatus("status").notNull().default("planned"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("drives_college_idx").on(t.collegeId)],
);

export const driveStudents = pgTable(
  "drive_students",
  {
    id: id(),
    driveId: text("drive_id")
      .notNull()
      .references(() => drives.id, { onDelete: "cascade" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: driveStudentStatus("status").notNull().default("eligible"),
    result: text("result"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("drive_students_uq").on(t.driveId, t.studentUserId)],
);

/* -------------------------------------------------------------------------- */
/* Platform                                                                   */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Machine type, e.g. "evidence.verified", "application.stage", "attestation.requested". */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** Generated-once platform secrets: auth secret, Ed25519 credential keypair. Never typed by humans. */
export const appSecrets = pgTable("app_secrets", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/* Relations (for db.query.* with `with`)                                     */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  mentor: one(mentors, { fields: [users.id], references: [mentors.userId] }),
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
  college: one(colleges, { fields: [users.collegeId], references: [colleges.id] }),
  githubAccount: one(githubAccounts, {
    fields: [users.id],
    references: [githubAccounts.userId],
  }),
  profileSkills: many(profileSkills),
  evidence: many(evidence),
  notifications: many(notifications),
}));

export const collegesRelations = relations(colleges, ({ many }) => ({
  students: many(studentProfiles),
  drives: many(drives),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  jobs: many(jobs),
}));

export const studentProfilesRelations = relations(studentProfiles, ({ one }) => ({
  user: one(users, { fields: [studentProfiles.userId], references: [users.id] }),
  college: one(colleges, { fields: [studentProfiles.collegeId], references: [colleges.id] }),
}));

export const githubAccountsRelations = relations(githubAccounts, ({ one, many }) => ({
  user: one(users, { fields: [githubAccounts.userId], references: [users.id] }),
  repos: many(repos),
}));

export const reposRelations = relations(repos, ({ one, many }) => ({
  user: one(users, { fields: [repos.userId], references: [users.id] }),
  githubAccount: one(githubAccounts, {
    fields: [repos.githubAccountId],
    references: [githubAccounts.id],
  }),
  stats: one(repoStats, { fields: [repos.id], references: [repoStats.repoId] }),
  deployments: many(deployments),
}));

export const repoStatsRelations = relations(repoStats, ({ one }) => ({
  repo: one(repos, { fields: [repoStats.repoId], references: [repos.id] }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  user: one(users, { fields: [deployments.userId], references: [users.id] }),
  repo: one(repos, { fields: [deployments.repoId], references: [repos.id] }),
}));

export const skillChecksRelations = relations(skillChecks, ({ one, many }) => ({
  skill: one(skills, { fields: [skillChecks.skillId], references: [skills.id] }),
  attempts: many(checkAttempts),
}));

export const checkAttemptsRelations = relations(checkAttempts, ({ one }) => ({
  user: one(users, { fields: [checkAttempts.userId], references: [users.id] }),
  skillCheck: one(skillChecks, {
    fields: [checkAttempts.skillCheckId],
    references: [skillChecks.id],
  }),
}));

export const mentorsRelations = relations(mentors, ({ one, many }) => ({
  user: one(users, { fields: [mentors.userId], references: [users.id] }),
  attestations: many(attestations),
}));

export const attestationsRelations = relations(attestations, ({ one }) => ({
  mentor: one(mentors, { fields: [attestations.mentorId], references: [mentors.id] }),
  student: one(users, { fields: [attestations.studentUserId], references: [users.id] }),
  skill: one(skills, { fields: [attestations.skillId], references: [skills.id] }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  user: one(users, { fields: [evidence.userId], references: [users.id] }),
  credential: one(credentials, { fields: [evidence.id], references: [credentials.evidenceId] }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  evidence: one(evidence, { fields: [credentials.evidenceId], references: [evidence.id] }),
  subject: one(users, { fields: [credentials.subjectUserId], references: [users.id] }),
}));

export const profileSkillsRelations = relations(profileSkills, ({ one }) => ({
  user: one(users, { fields: [profileSkills.userId], references: [users.id] }),
  skill: one(skills, { fields: [profileSkills.skillId], references: [skills.id] }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, { fields: [jobs.companyId], references: [companies.id] }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  job: one(jobs, { fields: [applications.jobId], references: [jobs.id] }),
  student: one(users, { fields: [applications.studentUserId], references: [users.id] }),
}));

export const shortlistsRelations = relations(shortlists, ({ many }) => ({
  entries: many(shortlistEntries),
}));

export const shortlistEntriesRelations = relations(shortlistEntries, ({ one }) => ({
  shortlist: one(shortlists, {
    fields: [shortlistEntries.shortlistId],
    references: [shortlists.id],
  }),
  student: one(users, { fields: [shortlistEntries.studentUserId], references: [users.id] }),
}));

export const pipelineCardsRelations = relations(pipelineCards, ({ one }) => ({
  student: one(users, { fields: [pipelineCards.studentUserId], references: [users.id] }),
  job: one(jobs, { fields: [pipelineCards.jobId], references: [jobs.id] }),
}));

export const drivesRelations = relations(drives, ({ one, many }) => ({
  college: one(colleges, { fields: [drives.collegeId], references: [colleges.id] }),
  company: one(companies, { fields: [drives.companyId], references: [companies.id] }),
  students: many(driveStudents),
}));

export const driveStudentsRelations = relations(driveStudents, ({ one }) => ({
  drive: one(drives, { fields: [driveStudents.driveId], references: [drives.id] }),
  student: one(users, { fields: [driveStudents.studentUserId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type UserRole = (typeof userRole.enumValues)[number];
export type DomainVerificationStatus = (typeof domainVerificationStatus.enumValues)[number];
export type ProfileVisibility = (typeof profileVisibility.enumValues)[number];
export type EvidenceKind = (typeof evidenceKind.enumValues)[number];
export type ApplicationStage = (typeof applicationStage.enumValues)[number];
export type PipelineStage = (typeof pipelineStage.enumValues)[number];

export type User = typeof users.$inferSelect;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
