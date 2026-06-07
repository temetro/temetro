import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { env } from "../env.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.DATABASE_URL });

// No `schema` is passed here on purpose: we use the core query builder
// (db.select/insert/update from explicit table objects), and keeping the
// patient schema out of this module avoids a circular import with auth.ts
// (which Better Auth's CLI loads to generate the auth schema).
export const db = drizzle(pool);
