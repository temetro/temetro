CREATE TABLE "integrations" (
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"endpoint" text DEFAULT '' NOT NULL,
	"credentials" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'unconfigured' NOT NULL,
	"last_sync_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_organization_id_type_pk" PRIMARY KEY("organization_id","type")
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;