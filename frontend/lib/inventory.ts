import { apiFetch } from "@/lib/api-client";

// A pharmacy stock item. Mirrors the backend `src/types/inventory.ts`. Scoped to
// the active clinic. `expiresAt` is an ISO YYYY-MM-DD date (or null).
export type InventoryItem = {
  id: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
  stockQuantity: number;
  reorderThreshold: number;
  location: string;
  barcode: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// The fields the inventory dialog collects.
export type InventoryInput = {
  name: string;
  form?: string;
  strength?: string;
  unit?: string;
  stockQuantity?: number;
  reorderThreshold?: number;
  location?: string;
  barcode?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
};

export type Availability = "in-stock" | "low" | "out";

// Derived stock status: out at zero, low at/under the reorder threshold,
// otherwise in stock. Computed on the client (not persisted).
export function availabilityOf(item: InventoryItem): Availability {
  if (item.stockQuantity <= 0) return "out";
  if (item.stockQuantity <= item.reorderThreshold) return "low";
  return "in-stock";
}

export function listInventory(): Promise<InventoryItem[]> {
  return apiFetch<InventoryItem[]>("/api/inventory");
}

export function createInventory(input: InventoryInput): Promise<InventoryItem> {
  return apiFetch<InventoryItem>("/api/inventory", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateInventory(
  id: string,
  input: InventoryInput,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/api/inventory/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteInventory(id: string): Promise<void> {
  return apiFetch<void>(`/api/inventory/${id}`, { method: "DELETE" });
}
