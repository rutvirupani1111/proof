import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { accounts, sessions, studentProfiles, users, verifications } from "@/db/schema";
import { DOMAIN_VERIFIED_ROLES, SIGNUP_ROLES, type Role } from "@/lib/auth/roles";
import { emailDomain, slugifyHandle } from "@/lib/handle";
import { getAuthSecret } from "@/server/secrets";

/** This deployment's own Vercel hosts: production domain first, then deployment + branch URLs. */
function vercelHosts(): string[] {
  const hosts = [
    process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].filter((h): h is string => !!h);
  return [...new Set(hosts)];
}

/**
 * BETTER_AUTH_URL when set. Otherwise, on Vercel, resolve the base URL from the request host when
 * it is one of this deployment's hosts and fall back to the production domain, so no env var is
 * needed. Locally (neither set) Better Auth infers it from the request (localhost:5190).
 */
function baseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  const hosts = vercelHosts();
  if (!hosts.length) return undefined;
  return { allowedHosts: hosts, fallback: `https://${hosts[0]}`, protocol: "https" as const };
}

function staticTrustedOrigins(): string[] {
  const origins = ["http://localhost:5190", "http://localhost:5191"];
  if (process.env.BETTER_AUTH_URL) origins.push(new URL(process.env.BETTER_AUTH_URL).origin);
  for (const host of vercelHosts()) origins.push(`https://${host}`);
  return origins;
}

/**
 * Static origins plus the request's own origin. A same-origin request is never cross-site, so
 * this only lets the app work on any alias Vercel serves it from (team alias, custom domain)
 * without listing each one; a foreign Origin still fails the check.
 */
function trustedOrigins(request?: Request): string[] {
  const origins = staticTrustedOrigins();
  if (request?.url) {
    try {
      origins.push(new URL(request.url).origin);
    } catch {
      // Not an absolute URL: nothing to add.
    }
  }
  return origins;
}

async function uniqueHandle(db: Db, name: string): Promise<string> {
  const base = slugifyHandle(name);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const taken = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.handle, candidate),
      columns: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function createAuth(db: Db, secret: string) {
  return betterAuth({
    appName: "Proof",
    secret,
    baseURL: baseURL(),
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: true, defaultValue: "student", input: true },
        domainVerification: {
          type: "string",
          required: false,
          defaultValue: "not_required",
          input: false,
        },
        emailDomain: { type: "string", required: false, input: false },
        companyId: { type: "string", required: false, input: false },
        collegeId: { type: "string", required: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const role = (user as { role?: string }).role ?? "student";
            if (!(SIGNUP_ROLES as readonly string[]).includes(role)) {
              throw new APIError("BAD_REQUEST", { message: "Choose a valid role to sign up." });
            }
            const domain = emailDomain(user.email);
            return {
              data: {
                ...user,
                role,
                emailDomain: domain,
                // Stub: recruiters, colleges and mentors prove their domain later (magic link).
                domainVerification: DOMAIN_VERIFIED_ROLES.includes(role as Role)
                  ? "pending"
                  : "not_required",
              },
            };
          },
          after: async (user) => {
            if ((user as { role?: string }).role !== "student") return;
            const handle = await uniqueHandle(db, user.name);
            await db
              .insert(studentProfiles)
              .values({ userId: user.id, handle, searchText: user.name })
              .onConflictDoNothing({ target: studentProfiles.userId });
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
export type SessionUser = AuthSession["user"] & { role: Role };

const globalForAuth = globalThis as unknown as { __proofAuth?: Promise<Auth> };

/** Lazily builds the Better Auth instance once the DB-backed secret is known. */
export function getAuth(): Promise<Auth> {
  globalForAuth.__proofAuth ??= (async () => {
    const [db, secret] = await Promise.all([getDb(), getAuthSecret()]);
    return createAuth(db, secret);
  })().catch((err) => {
    globalForAuth.__proofAuth = undefined;
    throw err;
  });
  return globalForAuth.__proofAuth;
}
