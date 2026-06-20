import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { auth } from "../auth.js";
import { db } from "../db/index.js";
import { user } from "../db/schema/auth.js";

// Public auth helpers that sit alongside Better Auth's own /api/auth handler.
//
// Better Auth's password-reset endpoint is keyed by email, but staff
// provisioned by an admin sign in with a *username* (and may only have a
// synthetic `username@slug.temetro.local` address). This lets them start a reset
// by username: we resolve the username to its account, then hand off to the
// normal reset flow (which emails a link if a provider is configured, or alerts
// the clinic admins otherwise — see src/auth.ts sendResetPassword).
export const authHelpersRouter = Router();

const resetByUsernameSchema = z.object({
  username: z.string().trim().min(1).max(64),
  redirectTo: z.string().trim().max(2048).optional(),
});

// POST /api/auth-helpers/reset-by-username
// Always responds 200 with a generic body — never reveals whether the username
// exists (avoids account enumeration) and never echoes the resolved email.
authHelpersRouter.post("/reset-by-username", async (req, res, next) => {
  try {
    const { username, redirectTo } = resetByUsernameSchema.parse(req.body);

    const [account] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.username, username.toLowerCase()))
      .limit(1);

    if (account?.email) {
      // Reuse Better Auth's reset flow so the same dispatch/fallback logic runs.
      await auth.api.requestPasswordReset({
        body: { email: account.email, redirectTo },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
