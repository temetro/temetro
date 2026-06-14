ALTER TABLE "patients" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;