/**
 * Persistence for billing behind two small interfaces, so the service and webhook logic can be
 * unit-tested against an in-memory store (see billing.test.ts). `dbBillingStore()` and
 * `dbSecretStore()` are the Drizzle implementations used by the app.
 *
 * No `server-only` import: `scripts/stripe-sync.ts` imports it.
 */
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { appSecrets, billingCustomers, processedStripeEvents, subscriptions, usageEvents } from "@/db/schema";
import { ACTIVE_STATUSES, type BillingOwnerType } from "@/lib/billing/plans";
import { getOrCreateSecret } from "@/server/secrets";

export type BillingOwner = { type: BillingOwnerType; id: string };

export type SubscriptionRecord = {
  ownerType: BillingOwnerType;
  ownerId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  plan: string;
  status: string;
  seats: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeEventAt: Date | null;
  updatedAt?: Date;
};

export type UsageRecord = {
  id: string;
  ownerType: BillingOwnerType;
  ownerId: string;
  actorUserId: string | null;
  kind: string;
  subjectId: string;
  billable: boolean;
  reportedAt: Date | null;
  createdAt: Date;
};

export interface BillingStore {
  getCustomer(owner: BillingOwner): Promise<{ stripeCustomerId: string; entitlements: string[] } | null>;
  getOwnerByCustomer(stripeCustomerId: string): Promise<BillingOwner | null>;
  upsertCustomer(owner: BillingOwner, stripeCustomerId: string): Promise<void>;
  setEntitlements(stripeCustomerId: string, lookupKeys: string[]): Promise<void>;
  getSubscription(stripeSubscriptionId: string): Promise<SubscriptionRecord | null>;
  /** Insert or replace by stripeSubscriptionId. */
  saveSubscription(row: SubscriptionRecord): Promise<void>;
  activeSubscriptions(owner: BillingOwner): Promise<SubscriptionRecord[]>;
  /** true when this call recorded the event id (first delivery), false when already processed. */
  claimEvent(id: string, type: string): Promise<boolean>;
  releaseEvent(id: string): Promise<void>;
  findUsage(owner: BillingOwner, kind: string, subjectId: string): Promise<UsageRecord | null>;
  countUsageSince(owner: BillingOwner, kind: string, since: Date): Promise<{ total: number; billable: number }>;
  /** null when a concurrent request already inserted the same (owner, kind, subject). */
  insertUsage(row: Omit<UsageRecord, "id" | "createdAt" | "reportedAt">): Promise<UsageRecord | null>;
  markUsageReported(id: string, at: Date): Promise<void>;
}

export interface SecretStore {
  get(key: string): Promise<string | null>;
  getOrCreate(key: string, generate: () => Promise<string>): Promise<string>;
  delete(key: string): Promise<void>;
}

const asOwnerType = (v: string): BillingOwnerType => (v === "college" ? "college" : "company");

export function dbBillingStore(): BillingStore {
  return {
    async getCustomer(owner) {
      const db = await getDb();
      const row = await db.query.billingCustomers.findFirst({
        where: and(eq(billingCustomers.ownerType, owner.type), eq(billingCustomers.ownerId, owner.id)),
      });
      return row ? { stripeCustomerId: row.stripeCustomerId, entitlements: row.entitlements } : null;
    },
    async getOwnerByCustomer(stripeCustomerId) {
      const db = await getDb();
      const row = await db.query.billingCustomers.findFirst({ where: eq(billingCustomers.stripeCustomerId, stripeCustomerId) });
      return row ? { type: asOwnerType(row.ownerType), id: row.ownerId } : null;
    },
    async upsertCustomer(owner, stripeCustomerId) {
      const db = await getDb();
      await db
        .insert(billingCustomers)
        .values({ ownerType: owner.type, ownerId: owner.id, stripeCustomerId })
        .onConflictDoUpdate({ target: [billingCustomers.ownerType, billingCustomers.ownerId], set: { stripeCustomerId, updatedAt: new Date() } });
    },
    async setEntitlements(stripeCustomerId, lookupKeys) {
      const db = await getDb();
      await db.update(billingCustomers).set({ entitlements: lookupKeys, updatedAt: new Date() }).where(eq(billingCustomers.stripeCustomerId, stripeCustomerId));
    },
    async getSubscription(stripeSubscriptionId) {
      const db = await getDb();
      const row = await db.query.subscriptions.findFirst({ where: eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId) });
      return row ? { ...row, ownerType: asOwnerType(row.ownerType) } : null;
    },
    async saveSubscription(row) {
      const db = await getDb();
      const values = { ...row, updatedAt: new Date() };
      await db.insert(subscriptions).values(values).onConflictDoUpdate({ target: subscriptions.stripeSubscriptionId, set: values });
    },
    async activeSubscriptions(owner) {
      const db = await getDb();
      const rows = await db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.ownerType, owner.type),
          eq(subscriptions.ownerId, owner.id),
          inArray(subscriptions.status, [...ACTIVE_STATUSES]),
        ),
      });
      return rows.map((r) => ({ ...r, ownerType: asOwnerType(r.ownerType) }));
    },
    async claimEvent(id, type) {
      const db = await getDb();
      const inserted = await db.insert(processedStripeEvents).values({ id, type }).onConflictDoNothing().returning({ id: processedStripeEvents.id });
      return inserted.length > 0;
    },
    async releaseEvent(id) {
      const db = await getDb();
      await db.delete(processedStripeEvents).where(eq(processedStripeEvents.id, id));
    },
    async findUsage(owner, kind, subjectId) {
      const db = await getDb();
      const row = await db.query.usageEvents.findFirst({
        where: and(eq(usageEvents.ownerType, owner.type), eq(usageEvents.ownerId, owner.id), eq(usageEvents.kind, kind), eq(usageEvents.subjectId, subjectId)),
      });
      return row ? { ...row, ownerType: asOwnerType(row.ownerType) } : null;
    },
    async countUsageSince(owner, kind, since) {
      const db = await getDb();
      const base = and(eq(usageEvents.ownerType, owner.type), eq(usageEvents.ownerId, owner.id), eq(usageEvents.kind, kind), gte(usageEvents.createdAt, since));
      const [all, billable] = await Promise.all([
        db.select({ n: count() }).from(usageEvents).where(base),
        db.select({ n: count() }).from(usageEvents).where(and(base, eq(usageEvents.billable, true))),
      ]);
      return { total: Number(all[0]?.n ?? 0), billable: Number(billable[0]?.n ?? 0) };
    },
    async insertUsage(row) {
      const db = await getDb();
      const [inserted] = await db.insert(usageEvents).values(row).onConflictDoNothing().returning();
      return inserted ? { ...inserted, ownerType: asOwnerType(inserted.ownerType) } : null;
    },
    async markUsageReported(id, at) {
      const db = await getDb();
      await db.update(usageEvents).set({ reportedAt: at }).where(eq(usageEvents.id, id));
    },
  };
}

export function dbSecretStore(): SecretStore {
  return {
    async get(key) {
      const db = await getDb();
      const row = await db.query.appSecrets.findFirst({ where: eq(appSecrets.key, key) });
      return row?.value ?? null;
    },
    getOrCreate: (key, generate) => getOrCreateSecret(key, generate),
    async delete(key) {
      const db = await getDb();
      await db.delete(appSecrets).where(eq(appSecrets.key, key));
    },
  };
}
