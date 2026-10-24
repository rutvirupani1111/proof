import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoAccountsPanel } from "@/components/demo/demo-accounts-panel";
import { DEMO_MODE } from "@/lib/demo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
      {DEMO_MODE && <DemoAccountsPanel />}
    </Suspense>
  );
}
