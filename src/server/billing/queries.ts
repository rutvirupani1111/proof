import "server-only";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, users } from "@/db/schema";
import { canExportStats, type PlanState } from "@/lib/billing/plans";
import { billingDeps } from "./deps";
import { UNLOCK_KIND, getPlanState, getUsage, type UsageSummary } from "./service";
import type { BillingOwner } from "./store";

export type BillingOverview = {
  mode: "stripe" | "demo";
  state: PlanState;
  usage: UsageSummary | null;
  hasCustomer: boolean;
};

export async function getBillingOverview(owner: BillingOwner): Promise<BillingOverview> {
  const deps = billingDeps();
  const state = await getPlanState(deps, owner);
  const [usage, customer] = await Promise.all([
    owner.type === "company" ? getUsage(deps, owner, state) : Promise.resolve(null),
    deps.store.getCustomer(owner),
  ]);
  return { mode: deps.stripe ? "stripe" : "demo", state, usage, hasCustomer: !!customer };
}

export async function getPlanStateFor(owner: BillingOwner): Promise<PlanState> {
  return getPlanState(billingDeps(), owner);
}

export async function collegeCanExport(owner: BillingOwner): Promise<boolean> {
  return canExportStats(await getPlanStateFor(owner));
}

/** Contact card state for the candidate page: the email only once this company unlocked them. */
export async function getContactUnlock(owner: BillingOwner, studentUserId: string) {
  const deps = billingDeps();
  const [row, usage] = await Promise.all([deps.store.findUsage(owner, UNLOCK_KIND, studentUserId), getUsage(deps, owner)]);
  let email: string | null = null;
  if (row) {
    const db = await getDb();
    email = (await db.query.users.findFirst({ where: eq(users.id, studentUserId), columns: { email: true } }))?.email ?? null;
  }
  return { unlocked: !!row, email, usage };
}

/** Conversations that already exist (either direction) never consume an unlock. */
export async function hasThread(a: string, b: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.query.messages.findFirst({
    where: or(and(eq(messages.senderUserId, a), eq(messages.recipientUserId, b)), and(eq(messages.senderUserId, b), eq(messages.recipientUserId, a))),
    columns: { id: true },
  });
  return !!row;
}
