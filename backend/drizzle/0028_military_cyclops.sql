CREATE TABLE "clinic_signing_keys" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"algorithm" text DEFAULT 'ed25519' NOT NULL,
	"public_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"private_key_enc" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"rotated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wallet_share_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"wallet_number" text NOT NULL,
	"ephemeral_pub_key" text NOT NULL,
	"ephemeral_priv_enc" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"share_mode" text DEFAULT 'permanent' NOT NULL,
	"share_expires_at" timestamp,
	"draft" jsonb,
	"committed_file_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "share_origin" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "share_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "clinic_signing_keys" ADD CONSTRAINT "clinic_signing_keys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_share_requests" ADD CONSTRAINT "wallet_share_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_share_requests" ADD CONSTRAINT "wallet_share_requests_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_share_org_idx" ON "wallet_share_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wallet_share_wallet_idx" ON "wallet_share_requests" USING btree ("wallet_number");