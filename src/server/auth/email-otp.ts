/**
 * Better Auth emailOTP options (sign-up verification + password reset), kept apart from auth.ts so
 * the OTP flow can be tested against a real Better Auth instance (email-otp.test.ts).
 */
import "server-only";
import type { emailOTP } from "better-auth/plugins/email-otp";
import { demoAccountForEmail } from "@/lib/demo";
import type { sendEmail as SendEmail } from "@/server/email";
import { passwordResetEmail, verifyCodeEmail } from "@/server/email/templates";

/** OTP lifetime (seconds). The verify / reset screens count down from the same number. */
export const OTP_EXPIRES_IN = 10 * 60;
/** Wrong guesses allowed per code before a new one is needed. */
export const OTP_ATTEMPTS = 5;

type Options = Parameters<typeof emailOTP>[0];

export function emailOtpOptions(send: typeof SendEmail): Options {
  return {
    otpLength: 6,
    expiresIn: OTP_EXPIRES_IN,
    allowedAttempts: OTP_ATTEMPTS,
    storeOTP: "hashed",
    sendVerificationOnSignUp: true,
    overrideDefaultEmailVerification: true,
    rateLimit: { window: 60, max: 3 },
    // Never throws: the outcome lands in email_deliveries and the screen asks for it
    // (src/server/email/actions.ts), so a mail outage can't break sign-up itself.
    async sendVerificationOTP({ email, otp, type }) {
      const minutes = OTP_EXPIRES_IN / 60;
      if (type === "email-verification") {
        await send({ to: email, template: "verify-code", ...verifyCodeEmail({ code: otp, minutes }), reveal: { code: otp } });
      } else if (type === "forget-password") {
        // The shared demo accounts are never reset (their password is public on /login).
        if (demoAccountForEmail(email)) return;
        await send({ to: email, template: "password-reset", ...passwordResetEmail({ code: otp, minutes }), reveal: { code: otp } });
      }
    },
  };
}
