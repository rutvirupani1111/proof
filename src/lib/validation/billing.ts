import { z } from "zod";
import { PLANS, type PlanId } from "@/lib/billing/plans";

const planIds = Object.keys(PLANS) as [PlanId, ...PlanId[]];

export const checkoutSchema = z.object({
  planId: z.enum(planIds),
  seats: z.coerce.number().int().min(1, "At least one seat.").max(200, "Talk to us for more than 200 seats.").default(1),
});

export const unlockSchema = z.object({ studentUserId: z.string().min(1).max(100) });

/** Billing actions add a machine code so the UI can open the upgrade sheet. */
export type BillingActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "upgrade_required" | "no_workspace" | "stripe_error" };
