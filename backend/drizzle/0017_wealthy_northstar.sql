ALTER TABLE "tasks" ADD COLUMN "status" text DEFAULT 'todo' NOT NULL;
--> statement-breakpoint
UPDATE "tasks" SET "status" = 'done' WHERE "done" = true;