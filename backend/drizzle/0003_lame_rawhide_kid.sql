CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"patient_file_number" text DEFAULT '' NOT NULL,
	"patient_name" text NOT NULL,
	"patient_initials" text NOT NULL,
	"medication" text NOT NULL,
	"dose" text DEFAULT '' NOT NULL,
	"frequency" text NOT NULL,
	"prescriber" text NOT NULL,
	"prescribed_at" date DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"duration" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prescriptions_org_idx" ON "prescriptions" USING btree ("organization_id");