"use client";

import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "@/server/auth/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
