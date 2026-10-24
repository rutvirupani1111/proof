import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth/roles";
import { OTP_ATTEMPTS, OTP_EXPIRES_IN } from "@/server/auth/auth";
import { getCurrentUser } from "@/server/auth/guard";
import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = { title: "Verify your email" };
export const dynamic = "force-dynamic";

/** After sign-up (and whenever an unverified account opens a portal): the 6-digit code screen. */
export default async function VerifyEmailPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/verify-email");
  if (user.emailVerified) redirect(homeFor(user.role));
  return <VerifyEmailForm email={user.email} home={homeFor(user.role)} expiresIn={OTP_EXPIRES_IN} attempts={OTP_ATTEMPTS} />;
}
