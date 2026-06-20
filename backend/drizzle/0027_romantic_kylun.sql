CREATE TABLE "email_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"provider" text DEFAULT 'none' NOT NULL,
	"from_address" text DEFAULT '' NOT NULL,
	"credentials" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
