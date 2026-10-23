"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/validation/auth";
import { messageSchema, type ActionResult } from "@/lib/validation/recruiter";
import { AuthError, assertRole } from "@/server/auth/guard";
import { ScopeError } from "@/server/recruiter/scope";
import { sendMessage, type ThreadMessage } from "./queries";

/** Send a direct message as the signed-in user (any portal role). */
export async function sendMessageAction(input: unknown): Promise<ActionResult<ThreadMessage>> {
  try {
    const user = await assertRole(["student", "recruiter", "college", "mentor"]);
    const parsed = messageSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the message.", fieldErrors: fieldErrors(parsed.error) };
    const msg = await sendMessage(
      { id: user.id, name: user.name, role: user.role, companyId: user.companyId as string | null | undefined },
      parsed.data,
    );
    revalidatePath(`/${user.role === "admin" ? "recruiter" : user.role}/messages`);
    return { ok: true, data: msg };
  } catch (err) {
    if (err instanceof AuthError || err instanceof ScopeError) return { ok: false, error: err.message };
    throw err;
  }
}
