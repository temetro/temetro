import { and, asc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { inventory } from "../db/schema/inventory.js";
import type { InventoryInput } from "../lib/inventory-validation.js";
import type { InventoryItem } from "../types/inventory.js";

type InventoryRow = typeof inventory.$inferSelect;

// Postgres throws on a malformed uuid; treat non-uuid ids as "not found".
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toInventoryItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    form: row.form,
    strength: row.strength,
    unit: row.unit,
    stockQuantity: row.stockQuantity,
    reorderThreshold: row.reorderThreshold,
    location: row.location,
    barcode: row.barcode,
    expiresAt: row.expiresAt,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function columns(orgId: string, input: InventoryInput, createdBy?: string) {
  return {
    organizationId: orgId,
    name: input.name,
    form: input.form,
    strength: input.strength,
    unit: input.unit,
    stockQuantity: input.stockQuantity,
    reorderThreshold: input.reorderThreshold,
    location: input.location,
    barcode: input.barcode ?? null,
    expiresAt: input.expiresAt ?? null,
    notes: input.notes ?? null,
    ...(createdBy ? { createdBy } : {}),
  };
}

export async function listInventory(orgId: string): Promise<InventoryItem[]> {
  const rows = await db
    .select()
    .from(inventory)
    .where(eq(inventory.organizationId, orgId))
    .orderBy(asc(inventory.name));
  return rows.map(toInventoryItem);
}

export async function createInventory(
  orgId: string,
  userId: string,
  input: InventoryInput,
): Promise<InventoryItem> {
  const [row] = await db
    .insert(inventory)
    .values(columns(orgId, input, userId))
    .returning();
  return toInventoryItem(row!);
}

export async function updateInventory(
  orgId: string,
  id: string,
  input: InventoryInput,
): Promise<InventoryItem | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .update(inventory)
    .set(columns(orgId, input))
    .where(and(eq(inventory.id, id), eq(inventory.organizationId, orgId)))
    .returning();
  return row ? toInventoryItem(row) : null;
}

export async function deleteInventory(
  orgId: string,
  id: string,
): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const deleted = await db
    .delete(inventory)
    .where(and(eq(inventory.id, id), eq(inventory.organizationId, orgId)))
    .returning({ id: inventory.id });
  return deleted.length > 0;
}
