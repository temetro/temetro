CREATE TABLE "staff_profile" (
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"specialty" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profile_org_user_idx" ON "staff_profile" USING btree ("organization_id","user_id");