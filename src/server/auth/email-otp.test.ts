/**
 * The real emailOTP options (email-otp.ts) on a real Better Auth instance with the in-memory
 * adapter: sign-up sends a code, wrong codes are rejected and counted, the right one verifies,
 * forgot-password resets and revokes every session. The mail adapter is replaced by a sink.
 */
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { emailOTP } from "better-auth/plugins/email-otp";
import { describe, expect, it } from "vitest";
import type { EmailMessage } from "@/server/email";
import { OTP_ATTEMPTS, emailOtpOptions } from "./email-otp";

function setup() {
  const outbox: EmailMessage[] = [];
  const db = { user: [] as unknown[], session: [] as unknown[], account: [] as unknown[], verification: [] as unknown[] };
  const auth = betterAuth({
    secret: "test-secret-test-secret-test-secret-0123456789",
    baseURL: "http://localhost:5190",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true, autoSignIn: true, revokeSessionsOnPasswordReset: true },
    emailVerification: { sendOnSignUp: true },
    rateLimit: { enabled: false },
    plugins: [
      emailOTP(
        emailOtpOptions(async (m) => {
          outbox.push(m);
          return { status: "sent", id: "test" };
        }),
      ),
    ],
  });
  const lastCode = (template: string) => outbox.filter((m) => m.template === template).at(-1)?.reveal?.code;
  return { auth, db, outbox, lastCode };
}

const email = "new.student@college.edu";
const password = "first-password-1";

async function signUp(auth: ReturnType<typeof setup>["auth"]) {
  return auth.api.signUpEmail({ body: { email, password, name: "New Student" } });
}

describe("sign-up email verification (emailOTP)", () => {
  it("sends a 6-digit code on sign-up and leaves the account unverified", async () => {
    const { auth, outbox, lastCode } = setup();
    const res = await signUp(auth);
    expect(res.user.emailVerified).toBe(false);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.template).toBe("verify-code");
    expect(lastCode("verify-code")).toMatch(/^\d{6}$/);
    expect(outbox[0]!.subject).toContain(lastCode("verify-code")!);
  });

  it("rejects a wrong code, then verifies with the right one", async () => {
    const { auth, lastCode, db } = setup();
    await signUp(auth);
    const code = lastCode("verify-code")!;
    const wrong = code === "000000" ? "111111" : "000000";
    await expect(auth.api.verifyEmailOTP({ body: { email, otp: wrong } })).rejects.toMatchObject({ body: { code: "INVALID_OTP" } });
    const ok = await auth.api.verifyEmailOTP({ body: { email, otp: code } });
    expect(ok.status).toBe(true);
    expect((db.user[0] as { emailVerified: boolean }).emailVerified).toBe(true);
  });

  it(`locks the code after ${OTP_ATTEMPTS} wrong attempts`, async () => {
    const { auth, lastCode } = setup();
    await signUp(auth);
    const code = lastCode("verify-code")!;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < OTP_ATTEMPTS; i++) {
      await expect(auth.api.verifyEmailOTP({ body: { email, otp: wrong } })).rejects.toBeTruthy();
    }
    await expect(auth.api.verifyEmailOTP({ body: { email, otp: code } })).rejects.toMatchObject({ body: { code: "TOO_MANY_ATTEMPTS" } });
  });

  it("a resend replaces the code", async () => {
    const { auth, lastCode } = setup();
    await signUp(auth);
    const first = lastCode("verify-code")!;
    await auth.api.sendVerificationOTP({ body: { email, type: "email-verification" } });
    const second = lastCode("verify-code")!;
    if (first !== second) {
      await expect(auth.api.verifyEmailOTP({ body: { email, otp: first } })).rejects.toBeTruthy();
    }
    expect((await auth.api.verifyEmailOTP({ body: { email, otp: second } })).status).toBe(true);
  });
});

describe("forgot password (emailOTP)", () => {
  it("resets the password with the emailed code and revokes every session", async () => {
    const { auth, db, lastCode } = setup();
    await signUp(auth);
    await auth.api.signInEmail({ body: { email, password } });
    expect(db.session.length).toBeGreaterThan(0);

    await auth.api.requestPasswordResetEmailOTP({ body: { email } });
    const code = lastCode("password-reset")!;
    expect(code).toMatch(/^\d{6}$/);
    await auth.api.resetPasswordEmailOTP({ body: { email, otp: code, password: "brand-new-password-2" } });

    expect(db.session).toHaveLength(0);
    await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toBeTruthy();
    const signedIn = await auth.api.signInEmail({ body: { email, password: "brand-new-password-2" } });
    expect(signedIn.user.email).toBe(email);
  });

  it("never sends a reset code to a shared demo account or an unknown address", async () => {
    const { auth, outbox } = setup();
    await auth.api.requestPasswordResetEmailOTP({ body: { email: "nobody@college.edu" } });
    await auth.api.requestPasswordResetEmailOTP({ body: { email: "ishita@spit-surat.example" } });
    expect(outbox.filter((m) => m.template === "password-reset")).toHaveLength(0);
  });
});
