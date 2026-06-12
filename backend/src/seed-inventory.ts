// Demo-only: populate each clinic that has no inventory yet with a starter set
// of common pharmacy stock so the Inventory page isn't empty on first view.
// Idempotent — skips any organization that already has inventory rows.
//
// Run with: npx tsx src/seed-inventory.ts
import { eq, sql } from "drizzle-orm";

import { db } from "./db/index.js";
import { organization } from "./db/schema/auth.js";
import { inventory } from "./db/schema/inventory.js";

type Seed = {
  name: string;
  form: string;
  strength: string;
  unit: string;
  stockQuantity: number;
  reorderThreshold: number;
  location: string;
};

// A representative, deliberately varied set (in-stock / low / out) so the
// availability badges are all visible in the demo.
const DEMO_STOCK: Seed[] = [
  { name: "Paracetamol", form: "Tablet", strength: "500 mg", unit: "tablets", stockQuantity: 1200, reorderThreshold: 200, location: "A1" },
  { name: "Ibuprofen", form: "Tablet", strength: "400 mg", unit: "tablets", stockQuantity: 640, reorderThreshold: 150, location: "A2" },
  { name: "Amoxicillin", form: "Capsule", strength: "500 mg", unit: "capsules", stockQuantity: 90, reorderThreshold: 100, location: "B1" },
  { name: "Azithromycin", form: "Tablet", strength: "250 mg", unit: "tablets", stockQuantity: 0, reorderThreshold: 60, location: "B2" },
  { name: "Amlodipine", form: "Tablet", strength: "5 mg", unit: "tablets", stockQuantity: 480, reorderThreshold: 120, location: "C1" },
  { name: "Lisinopril", form: "Tablet", strength: "10 mg", unit: "tablets", stockQuantity: 75, reorderThreshold: 100, location: "C2" },
  { name: "Metformin", form: "Tablet", strength: "850 mg", unit: "tablets", stockQuantity: 900, reorderThreshold: 200, location: "C3" },
  { name: "Atorvastatin", form: "Tablet", strength: "20 mg", unit: "tablets", stockQuantity: 320, reorderThreshold: 100, location: "C4" },
  { name: "Omeprazole", form: "Capsule", strength: "20 mg", unit: "capsules", stockQuantity: 540, reorderThreshold: 150, location: "D1" },
  { name: "Salbutamol", form: "Inhaler", strength: "100 mcg", unit: "inhalers", stockQuantity: 38, reorderThreshold: 40, location: "D2" },
  { name: "Ceftriaxone", form: "Injection", strength: "1 g", unit: "vials", stockQuantity: 0, reorderThreshold: 25, location: "E1" },
  { name: "Insulin Glargine", form: "Injection", strength: "100 U/mL", unit: "pens", stockQuantity: 60, reorderThreshold: 30, location: "Fridge 1" },
  { name: "Prednisolone", form: "Tablet", strength: "5 mg", unit: "tablets", stockQuantity: 210, reorderThreshold: 80, location: "F1" },
  { name: "Furosemide", form: "Tablet", strength: "40 mg", unit: "tablets", stockQuantity: 18, reorderThreshold: 60, location: "F2" },
  { name: "Warfarin", form: "Tablet", strength: "5 mg", unit: "tablets", stockQuantity: 140, reorderThreshold: 50, location: "G1" },
];

async function main() {
  const orgs = await db.select({ id: organization.id }).from(organization);
  let seeded = 0;
  for (const org of orgs) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventory)
      .where(eq(inventory.organizationId, org.id));
    if (count > 0) continue;
    await db
      .insert(inventory)
      .values(DEMO_STOCK.map((s) => ({ ...s, organizationId: org.id })));
    seeded += 1;
  }
  console.log(`Seeded demo inventory for ${seeded} clinic(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
