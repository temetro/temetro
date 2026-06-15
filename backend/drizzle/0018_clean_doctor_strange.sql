CREATE TABLE "org_ai_policy" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"disabled_for_employees" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_ai_policy" ADD CONSTRAINT "org_ai_policy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;