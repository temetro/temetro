// The canonical Invoice shape returned by the API. Mirrors the frontend
// `lib/invoices.ts` Invoice type. Scoped to the active clinic; patient fields
// are denormalized for display and `fileNumber` links to a patient record.
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

// One slice of a split bill. `amount` is the installment total; `dueAt` is an
// optional ISO date; `paid` tracks settlement.
export type InvoiceInstallment = {
  label: string;
  amount: number;
  dueAt: string | null;
  paid: boolean;
};

export type Invoice = {
  id: string;
  fileNumber: string;
  name: string;
  initials: string;
  number: string; // human invoice number, e.g. "INV-1001"
  issuedAt: string; // YYYY-MM-DD
  dueAt: string | null; // YYYY-MM-DD
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  installments: InvoiceInstallment[];
  notes: string | null;
  source: "manual" | "ai";
  createdAt: string;
  updatedAt: string;
};
