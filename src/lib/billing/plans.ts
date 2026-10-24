/**
 * The billing catalogue: plans, prices, allowances and the pure gating rules. Client and server
 * safe (no secrets, no I/O). Stripe products and prices are found or created from these lookup
 * keys by `src/server/billing/catalog.ts`; plan state itself only ever comes from webhooks.
 */

export type BillingOwnerType = "company" | "college";
export type PlanId = "recruiter_free" | "recruiter_starter" | "recruiter_growth" | "college_free" | "college_campus";

export type Plan = {
  id: PlanId;
  owner: BillingOwnerType;
  name: string;
  /** Monthly price in INR (whole rupees); 0 = free. */
  monthlyInr: number;
  perSeat: boolean;
  /** Stripe price lookup key (paid plans only). */
  lookupKey?: string;
  /** Stripe product id we create (custom ids keep the bootstrap idempotent). */
  productId?: string;
  /** Candidate unlocks included per seat per calendar month (recruiter plans). */
  unlocksPerSeat: number;
  /** Over-allowance unlocks are billed through the meter instead of being blocked. */
  metered: boolean;
  blurb: string;
  features: string[];
};

export const MONTHLY_FREE_UNLOCKS = 5;
export const UNLOCK_OVERAGE_INR = 49;
export const METER_EVENT_NAME = "candidate_unlocks";
export const OVERAGE_LOOKUP_KEY = "proof_candidate_unlock_overage_v1";
export const OVERAGE_PRODUCT_ID = "proof_candidate_unlocks";

export const PLANS: Record<PlanId, Plan> = {
  recruiter_free: {
    id: "recruiter_free",
    owner: "company",
    name: "Free",
    monthlyInr: 0,
    perSeat: false,
    unlocksPerSeat: MONTHLY_FREE_UNLOCKS,
    metered: false,
    blurb: "Search verified evidence and try the pipeline.",
    features: ["Evidence search and candidate view", `${MONTHLY_FREE_UNLOCKS} candidate unlocks a month`, "Pipeline, shortlists and notes"],
  },
  recruiter_starter: {
    id: "recruiter_starter",
    owner: "company",
    name: "Recruiter Starter",
    monthlyInr: 2999,
    perSeat: true,
    lookupKey: "proof_recruiter_starter_monthly_v1",
    productId: "proof_recruiter_starter",
    unlocksPerSeat: 40,
    metered: true,
    blurb: "For a founder or a small hiring team.",
    features: ["40 unlocks per seat / month", `Then ₹${UNLOCK_OVERAGE_INR} per extra unlock`, "Contact details and messaging", "Saved searches and compare"],
  },
  recruiter_growth: {
    id: "recruiter_growth",
    owner: "company",
    name: "Recruiter Growth",
    monthlyInr: 7999,
    perSeat: true,
    lookupKey: "proof_recruiter_growth_monthly_v1",
    productId: "proof_recruiter_growth",
    unlocksPerSeat: 150,
    metered: true,
    blurb: "For teams hiring every month.",
    features: ["150 unlocks per seat / month", `Then ₹${UNLOCK_OVERAGE_INR} per extra unlock`, "Skill-check invites at volume", "Priority support"],
  },
  college_free: {
    id: "college_free",
    owner: "college",
    name: "Free",
    monthlyInr: 0,
    perSeat: false,
    unlocksPerSeat: 0,
    metered: false,
    blurb: "Cohort readiness and drives for one campus.",
    features: ["Cohort readiness funnel", "Drives with verified eligibility", "Placement stats on screen"],
  },
  college_campus: {
    id: "college_campus",
    owner: "college",
    name: "College Campus",
    monthlyInr: 24999,
    perSeat: false,
    lookupKey: "proof_college_campus_monthly_v1",
    productId: "proof_college_campus",
    unlocksPerSeat: 0,
    metered: false,
    blurb: "The full placement cell for one campus, unlimited students.",
    features: ["Placement stats CSV export", "Nudges for incomplete proofs", "Unlimited students and officers", "Accreditation-ready reports"],
  },
};

export const PAID_PLANS = Object.values(PLANS).filter((p) => p.lookupKey);
export const plansFor = (owner: BillingOwnerType) => Object.values(PLANS).filter((p) => p.owner === owner);
export const freePlanFor = (owner: BillingOwnerType): Plan => (owner === "company" ? PLANS.recruiter_free : PLANS.college_free);
export const ownerTypeForRole = (role: string): BillingOwnerType | null =>
  role === "recruiter" ? "company" : role === "college" ? "college" : null;

export function planFromLookupKey(key: string | null | undefined): Plan | null {
  if (!key) return null;
  return PAID_PLANS.find((p) => p.lookupKey === key) ?? null;
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

/** Subscription statuses that keep a paid plan's features on. */
export const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;
export const isActiveStatus = (s: string | null | undefined) => !!s && (ACTIVE_STATUSES as readonly string[]).includes(s);

export type PlanState = {
  plan: Plan;
  status: string;
  seats: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export function unlockAllowance(plan: Plan, seats: number): number {
  return plan.perSeat ? plan.unlocksPerSeat * Math.max(1, seats) : plan.unlocksPerSeat;
}

export type UnlockDecision =
  | { allowed: true; billable: boolean; allowance: number; used: number }
  | { allowed: false; reason: "limit" | "not_recruiter"; allowance: number; used: number };

/**
 * Free recruiters get 5 unlocks a month and are then asked to upgrade. Paid plans never block:
 * unlocks beyond the allowance are billed through the `candidate_unlocks` meter.
 */
export function decideUnlock(state: PlanState, used: number): UnlockDecision {
  if (state.plan.owner !== "company") return { allowed: false, reason: "not_recruiter", allowance: 0, used };
  const allowance = unlockAllowance(state.plan, state.seats);
  if (used < allowance) return { allowed: true, billable: false, allowance, used };
  if (state.plan.metered) return { allowed: true, billable: true, allowance, used };
  return { allowed: false, reason: "limit", allowance, used };
}

/** College features gated behind College Campus. */
export const canExportStats = (state: PlanState) => state.plan.id === "college_campus";

/** Calendar month (UTC) the usage meter counts. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const formatInr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;
