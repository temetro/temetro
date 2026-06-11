import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  memberAc,
  ownerAc,
  defaultStatements,
} from "better-auth/plugins/organization/access";

// Mirrors backend/src/lib/access.ts so the client's permission checks
// (organization.hasPermission / checkRolePermission) match the server.
export const statements = {
  ...defaultStatements,
  patient: ["read", "write", "delete"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
  lab: ["read", "write"],
} as const;

export const ac = createAccessControl(statements);

// NOTE: `prescription: ["delete"]` doubles as the "full clinician" marker the
// route gating in lib/roles.ts probes (owner/admin/doctor/member only) — don't
// grant it to department roles like pharmacy.
export const owner = ac.newRole({
  ...ownerAc.statements,
  patient: ["read", "write", "delete"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
  lab: ["read", "write"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  patient: ["read", "write", "delete"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
  lab: ["read", "write"],
});

export const member = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
  lab: ["read", "write"],
});

// doctor (clinician): mirrors backend/src/lib/access.ts — same clinical access
// as `member`.
export const doctor = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
  lab: ["read", "write"],
});

// reception (front desk): scheduling + registration only, no clinical records.
export const reception = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
  appointment: ["read", "write", "delete"],
  task: ["read", "write"],
});

// pharmacy (dispensing): read patients/appointments, read/write prescriptions
// (status updates, NOT delete), and work the task queue.
export const pharmacy = ac.newRole({
  ...memberAc.statements,
  patient: ["read"],
  appointment: ["read"],
  prescription: ["read", "write"],
  task: ["read", "write"],
});

// lab (analyses): submits lab results via the dedicated `lab` statement (no
// patient:write) and works the lab task queue. No prescription statement.
export const lab = ac.newRole({
  ...memberAc.statements,
  patient: ["read"],
  appointment: ["read"],
  task: ["read", "write"],
  lab: ["read", "write"],
});

export const roles = { owner, admin, doctor, reception, pharmacy, lab, member };

// Human-readable labels for the role keys used in the UI.
export const ROLE_LABELS: Record<keyof typeof roles, string> = {
  owner: "Owner",
  admin: "Admin",
  doctor: "Doctor",
  reception: "Reception",
  pharmacy: "Pharmacy",
  lab: "Lab",
  member: "Clinician",
};
