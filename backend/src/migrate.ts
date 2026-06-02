import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db, pool } from "./db/index.js";

// Applies the SQL migrations in ./drizzle at container/app startup. Uses the
// drizzle-orm runtime migrator (a production dependency) so no dev tooling is
// needed in the runtime image.
async function main(): Promise<void> {
  console.log("Applying database migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations up to date.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
