CREATE TABLE "dispenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"patient_file_number" text DEFAULT '' NOT NULL,
	"patient_name" text NOT NULL,
	"patient_initials" text DEFAULT '' NOT NULL,
	"medication" text NOT NULL,
	"dose" text DEFAULT '' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"prescription_id" uuid,
	"dispensed_by" text,
	"dispensed_by_name" text DEFAULT '' NOT NULL,
	"dispensed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "dispenses" ADD CONSTRAINT "dispenses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispenses" ADD CONSTRAINT "dispenses_dispensed_by_user_id_fk" FOREIGN KEY ("dispensed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispenses_org_idx" ON "dispenses" USING btree ("organization_id");