CREATE TABLE "email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"provider_id" text,
	"reveal" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_deliveries_to_idx" ON "email_deliveries" USING btree ("to","template","created_at");
--> statement-breakpoint
-- Sign-up email verification (emailOTP) starts with this release. Accounts that already exist
-- were created before Proof could send email, so they are grandfathered in as verified; only new
-- sign-ups have to enter the 6-digit code. Undo: none needed (the flag only gates portal access).
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;
