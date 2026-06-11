import { and, asc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { auth } from "../auth.js";
import { db } from "../db/index.js";
import { member, organization, user } from "../db/schema/auth.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";

export const staffRouter = Router();

// Admin-provisioned staff accounts. Instead of emailing an invitation link, an
// owner/admin creates the employee's account directly — name, role and a
// username + password the employee uses to sign in. Everything is gated by the
// Better Auth `member` permission so RBAC stays in one place. The account is
// created via `auth.api.signUpEmail` and attached to the active clinic via
// `auth.api.addMember`; the new user then shows up everywhere org members do
// (e.g. the Messages compose picker) with no extra wiring.

// Roles an admin may assign — `owner` is intentionally excluded (the clinic
// creator is the sole owner; transfer ownership via member-role updates).
const PROVISIONABLE_ROLES = [
  "admin",
  "doctor",
  "reception",
  "pharmacy",
  "lab",
] as const;

const staffInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(
      /^[a-zA-Z0-9_.]+$/,
      "Username may only contain letters, numbers, dots and underscores.",
    ),
  password: z.string().min(12).max(256),
  role: z.enum(PROVISIONABLE_ROLES),
  // Optional real email; staff sign in by username, so when omitted we mint a
  // placeholder (the email column is required + unique).
  email: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().email().optional(),
  ),
});

staffRouter.use(requireAuth, requireOrg);

// Clinical-capable roles that can be a patient's primary provider. Department
// roles (reception, pharmacy, lab) are excluded.
const PROVIDER_ROLES = ["owner", "admin", "doctor", "member"] as const;

// List clinicians who can be assigned as a patient's primary provider. Readable
// by ANY clinic member (no `member:create` gate) so doctors and reception can
// pick a provider when registering/transferring a patient. Returns user ids.
staffRouter.get("/providers", async (req, res, next) => {
  try {
    const rows = await db
      .select({
        userId: member.userId,
        name: user.name,
        role: member.role,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(
        and(
          eq(member.organizationId, req.organizationId!),
          inArray(member.role, PROVIDER_ROLES as unknown as string[]),
        ),
      )
      .orderBy(asc(user.name));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// List the clinic's members with their usernames (the org client's
// getFullOrganization doesn't expose username). Owner/admin only.
staffRouter.get(
  "/",
  requirePermission({ member: ["create"] }),
  async (req, res, next) => {
    try {
      const rows = await db
        .select({
          id: member.id,
          userId: member.userId,
          role: member.role,
          name: user.name,
          email: user.email,
          username: user.username,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(eq(member.organizationId, req.organizationId!))
        .orderBy(asc(user.name));
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

// Provision a new staff account and add them to the active clinic.
staffRouter.post(
  "/",
  requirePermission({ member: ["create"] }),
  async (req, res, next) => {
    try {
      const input = staffInputSchema.parse(req.body);

      const [org] = await db
        .select({ slug: organization.slug })
        .from(organization)
        .where(eq(organization.id, req.organizationId!));
      if (!org) throw new HttpError(404, "Clinic not found.");

      const email =
        input.email ?? `${input.username.toLowerCase()}@${org.slug}.temetro.local`;

      // Create the credential account (user + hashed password + username).
      let newUserId: string;
      try {
        const result = await auth.api.signUpEmail({
          body: {
            name: input.name,
            email,
            password: input.password,
            username: input.username,
          },
        });
        newUserId = result.user.id;
      } catch (err) {
        // Surface Better Auth's reason (e.g. username/email already taken).
        const message =
          (err as { body?: { message?: string } })?.body?.message ??
          (err as Error)?.message ??
          "Could not create the account.";
        throw new HttpError(400, message);
      }

      // Attach the new user to the clinic with the chosen role (server-side,
      // no invitation step).
      await auth.api.addMember({
        body: {
          userId: newUserId,
          organizationId: req.organizationId!,
          role: input.role,
        },
      });

      res.status(201).json({
        userId: newUserId,
        name: input.name,
        email,
        username: input.username.toLowerCase(),
        role: input.role,
      });
    } catch (err) {
      next(err);
    }
  },
);
