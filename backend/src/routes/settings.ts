import { eq } from "drizzle-orm";
import { Router } from "express";

import { db } from "../db/index.js";
import { userSettings } from "../db/schema/settings.js";
import { settingsInputSchema } from "../lib/settings-validation.js";
import { requireAuth } from "../middleware/auth.js";

export const settingsRouter = Router();

// Settings are per-user (not per-clinic), so only authentication is required —
// no active organization or RBAC permission.
settingsRouter.use(requireAuth);

settingsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await db
      .select({ preferences: userSettings.preferences })
      .from(userSettings)
      .where(eq(userSettings.userId, req.user!.id))
      .limit(1);
    res.json({ preferences: rows[0]?.preferences ?? {} });
  } catch (err) {
    next(err);
  }
});

settingsRouter.put("/", async (req, res, next) => {
  try {
    const { preferences } = settingsInputSchema.parse(req.body);
    await db
      .insert(userSettings)
      .values({ userId: req.user!.id, preferences })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { preferences, updatedAt: new Date() },
      });
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
});
