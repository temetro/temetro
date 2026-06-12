CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"form" text DEFAULT '' NOT NULL,
	"strength" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"reorder_threshold" integer DEFAULT 0 NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"expires_at" date,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_org_idx" ON "inventory" USING btree ("organization_id");