import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

import { auth } from "../auth.js";
import { db } from "../db/index.js";
import { member } from "../db/schema/auth.js";
import { roles, type statements } from "../lib/access.js";
import { HttpError } from "../lib/http-error.js";

// Validates the Better Auth session cookie and attaches the user + session.
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!data?.session) {
      throw new HttpError(401, "Authentication required.");
    }
    req.user = data.user;
    req.session = data.session;
    next();
  } catch (err) {
    next(err);
  }
}

// Requires an active organization (clinic) and loads the caller's role in it.
// Must run after requireAuth.
export async function requireOrg(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const orgId = req.session?.activeOrganizationId;
    if (!orgId) {
      throw new HttpError(
        403,
        "No active clinic selected. Create or select a clinic first.",
      );
    }
    const [m] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(eq(member.organizationId, orgId), eq(member.userId, req.user!.id)),
      );
    if (!m) {
      throw new HttpError(403, "You are not a member of the active clinic.");
    }
    req.organizationId = orgId;
    req.memberRole = m.role;
    next();
  } catch (err) {
    next(err);
  }
}

// A permission request maps clinic resources (patient / appointment / … defined
// in src/lib/access.ts) to the actions required on them. Mirrors the shape Better
// Auth's `role.authorize` accepts.
type PermissionRequest = Partial<{
  [R in keyof typeof statements]: ((typeof statements)[R][number])[];
}>;

// Gates a route on a clinic permission, evaluated against the caller's role(s)
// using the shared access-control definitions. Must run after requireOrg.
export function requirePermission(permission: PermissionRequest) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const names = String(req.memberRole ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      let allowed = false;
      for (const name of names) {
        const role = roles[name as keyof typeof roles];
        if (role && (await role.authorize(permission)).success) {
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        throw new HttpError(403, "You don't have permission to do that.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Gates a route on holding ANY of several permissions (logical OR) — e.g. an
// attachment may be uploaded by a clinician (patient:write) OR by lab staff
// (lab:write). Passes if the caller's role(s) satisfy at least one request.
export function requireAnyPermission(...permissions: PermissionRequest[]) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const names = String(req.memberRole ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      let allowed = false;
      outer: for (const permission of permissions) {
        for (const name of names) {
          const role = roles[name as keyof typeof roles];
          if (role && (await role.authorize(permission)).success) {
            allowed = true;
            break outer;
          }
        }
      }

      if (!allowed) {
        throw new HttpError(403, "You don't have permission to do that.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
