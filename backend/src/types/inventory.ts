// The canonical InventoryItem shape returned by the API. Mirrors the frontend
// `lib/inventory.ts` InventoryItem type. Scoped to the active clinic. The
// derived availability ("in-stock" | "low" | "out") is computed on the client
// from stockQuantity vs reorderThreshold, not stored.
export type InventoryItem = {
  id: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
  stockQuantity: number;
  reorderThreshold: number;
  location: string;
  expiresAt: string | null; // YYYY-MM-DD
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
