import { desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { dispenses } from "../db/schema/dispenses.js";
import type { DispenseInput } from "../lib/dispense-validation.js";
import type { Dispense } from "../types/dispense.js";

type DispenseRow = typeof dispenses.$inferSelect;

function toDispense(row: DispenseRow): Dispense {
  return {
    id: row.id,
    fileNumber: row.patientFileNumber,
    name: row.patientName,
    initials: row.patientInitials,
    medication: row.medication,
    dose: row.dose,
    quantity: row.quantity,
    unit: row.unit,
    prescriptionId: row.prescriptionId,
    dispensedBy: row.dispensedBy,
    dispensedByName: row.dispensedByName,
    dispensedAt: row.dispensedAt.toISOString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDispenses(orgId: string): Promise<Dispense[]> {
  const rows = await db
    .select()
    .from(dispenses)
    .where(eq(dispenses.organizationId, orgId))
    .orderBy(desc(dispenses.dispensedAt));
  return rows.map(toDispense);
}

export async function createDispense(
  orgId: string,
  dispenser: { id: string; name: string },
  input: DispenseInput,
): Promise<Dispense> {
  const [row] = await db
    .insert(dispenses)
    .values({
      organizationId: orgId,
      patientFileNumber: input.fileNumber,
      patientName: input.name,
      patientInitials: input.initials,
      medication: input.medication,
      dose: input.dose,
      quantity: input.quantity,
      unit: input.unit,
      prescriptionId: input.prescriptionId ?? null,
      dispensedBy: dispenser.id,
      dispensedByName: dispenser.name,
      notes: input.notes ?? null,
    })
    .returning();
  return toDispense(row!);
}
