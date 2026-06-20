import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/index.js";
import { userSettings } from "../db/schema/settings.js";
import { patientInputSchema } from "../lib/patient-validation.js";
import { settingsInputSchema } from "../lib/settings-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import { createPatient, listPatients } from "../services/patients.js";

export const settingsRouter = Router();

// Settings are per-user (not per-clinic), so only authentication is required —
// no active organization or RBAC permission.
settingsRouter.use(requireAuth);

// --- Records import / export (clinic-wide, admin-only) -------------------
// Gated by `member: ["create"]` — the same admin/owner marker the staff route
// uses — so only clinic admins can bulk-move records.

// Download every patient record in the active clinic as one JSON archive.
settingsRouter.get(
  "/records/export",
  requireOrg,
  requirePermission({ member: ["create"] }),
  async (req, res, next) => {
    try {
      const patients = await listPatients(req.organizationId!);
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Exported ${patients.length} patient record(s)`,
        entityType: "patient",
        entityId: "export",
      });
      res.json({
        temetroExport: true,
        version: 1,
        exportedAt: new Date().toISOString(),
        organizationId: req.organizationId,
        patientCount: patients.length,
        patients,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Import a previously exported archive. Creates new patients and skips any whose
// file number already exists in this clinic (idempotent re-imports). Cross-clinic
// provider links are dropped — they reference users this clinic doesn't have.
const importBodySchema = z.object({
  patients: z.array(z.unknown()).max(10_000),
});

settingsRouter.post(
  "/records/import",
  requireOrg,
  requirePermission({ member: ["create"] }),
  async (req, res, next) => {
    try {
      const { patients: incoming } = importBodySchema.parse(req.body);
      const existing = new Set(
        (await listPatients(req.organizationId!)).map((p) => p.fileNumber),
      );
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const raw of incoming) {
        // Provider links are clinic-specific; drop them so the FK holds.
        const candidate =
          raw && typeof raw === "object"
            ? { ...(raw as Record<string, unknown>), primaryProviderId: null }
            : raw;
        const parsed = patientInputSchema.safeParse(candidate);
        if (!parsed.success) {
          if (errors.length < 20) {
            const name =
              (candidate as { name?: string })?.name ?? "(unknown)";
            errors.push(`${name}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
          }
          continue;
        }
        if (parsed.data.fileNumber && existing.has(parsed.data.fileNumber)) {
          skipped += 1;
          continue;
        }
        try {
          const made = await createPatient(
            req.organizationId!,
            req.user!.id,
            parsed.data,
          );
          existing.add(made.fileNumber);
          created += 1;
        } catch {
          skipped += 1;
        }
      }

      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Imported ${created} patient record(s)`,
        entityType: "patient",
        entityId: "import",
      });
      res.json({ created, skipped, total: incoming.length, errors });
    } catch (err) {
      next(err);
    }
  },
);

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
