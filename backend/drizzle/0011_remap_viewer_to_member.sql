-- Custom SQL migration file, put your code below! --

-- The read-only `viewer` role was removed from src/lib/access.ts. Members left
-- with it would fail every permission check (requirePermission looks roles up
-- by name), so remap them to `member` (clinician). Pending invitations carry a
-- role too — cover them as well.
UPDATE "member" SET "role" = 'member' WHERE "role" = 'viewer';--> statement-breakpoint
UPDATE "invitation" SET "role" = 'member' WHERE "role" = 'viewer';
