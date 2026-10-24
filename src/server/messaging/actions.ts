"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { fieldErrors } from "@/lib/validation/auth";
import { messageSchema, type ActionResult } from "@/lib/validation/recruiter";
import { AuthError, assertRole } from "@/server/auth/guard";
import { billingDeps, billingOwnerOf } from "@/server/billing/deps";
import { hasThread } from "@/server/billing/queries";
import { unlockCandidate } from "@/server/billing/service";
import { isMessageableStudent } from "@/server/recruiter/queries";
import { ScopeError } from "@/server/recruiter/scope";
import { publicOrigin } from "@/server/auth/auth";
import { emailNewMessage } from "./email";
import { sendMessage, type ThreadMessage } from "./queries";

/** This request's origin (for absolute links in emails). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:5190";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Send a direct message as the signed-in user (any portal role). */
export async function sendMessageAction(input: unknown): Promise<ActionResult<ThreadMessage>> {
  try {
    const user = await assertRole(["student", "recruiter", "college", "mentor"]);
    const parsed = messageSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the message.", fieldErrors: fieldErrors(parsed.error) };
    if (user.role === "recruiter") {
      // Opening a new conversation unlocks the candidate (5 a month on the free plan).
      const owner = billingOwnerOf(user);
      if (owner && (await isMessageableStudent(parsed.data.recipientUserId)) && !(await hasThread(user.id, parsed.data.recipientUserId))) {
        const res = await unlockCandidate(billingDeps(), owner, user.id, parsed.data.recipientUserId);
        if (res.status === "limit") {
          return { ok: false, error: `You've used all ${res.usage.allowance} free candidate unlocks this month. Upgrade in Billing to message more candidates.` };
        }
      }
    }
    const msg = await sendMessage(
      { id: user.id, name: user.name, role: user.role, companyId: user.companyId as string | null | undefined },
      parsed.data,
    );
    revalidatePath(`/${user.role === "admin" ? "recruiter" : user.role}/messages`);
    // Email the student after the response is sent (never blocks or fails the message itself).
    const origin = publicOrigin(new Request(await requestOrigin()));
    after(() =>
      emailNewMessage({
        senderId: user.id,
        senderName: user.name,
        companyId: user.companyId as string | null | undefined,
        recipientUserId: parsed.data.recipientUserId,
        body: parsed.data.body,
        origin,
      }).catch((err) => console.error("[email] new-message failed", err)),
    );
    return { ok: true, data: msg };
  } catch (err) {
    if (err instanceof AuthError || err instanceof ScopeError) return { ok: false, error: err.message };
    throw err;
  }
}
