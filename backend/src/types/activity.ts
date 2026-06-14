// The canonical activity-log entry returned by the API. A plain, tamper-evident
// audit trail of record changes within a clinic. (The blockchain-style signing /
// patient-approval flow from the product vision is separate and not built yet.)
export type ActivityEntityType =
  | "patient"
  | "note"
  | "appointment"
  | "prescription"
  | "invoice"
  | "inventory"
  | "task";

export type ActivityEntry = {
  id: string;
  actorName: string;
  actorInitials: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string | null;
  patientName: string | null;
  patientFileNumber: string | null;
  createdAt: string;
};
