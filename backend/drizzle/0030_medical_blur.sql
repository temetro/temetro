CREATE TABLE "wallet_record_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"file_number" text NOT NULL,
	"wallet_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload_sealed" text NOT NULL,
	"clinic_signature" text NOT NULL,
	"clinic_public_key" text NOT NULL,
	"clinic_fingerprint" text NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wallet_record_updates" ADD CONSTRAINT "wallet_record_updates_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_record_updates" ADD CONSTRAINT "wallet_record_updates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_updates_org_idx" ON "wallet_record_updates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wallet_updates_wallet_idx" ON "wallet_record_updates" USING btree ("wallet_number");