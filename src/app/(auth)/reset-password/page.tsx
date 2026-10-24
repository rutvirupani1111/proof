import type { Metadata } from "next";
import { OTP_ATTEMPTS, OTP_EXPIRES_IN } from "@/server/auth/auth";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <ResetPasswordForm expiresIn={OTP_EXPIRES_IN} attempts={OTP_ATTEMPTS} />;
}
