import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

// RBAC for clinics (organizations). We extend Better Auth's default
// organization statements (organization / member / invitation / team) with
// clinical resources (`patient`, `appointment`, `prescription`, `task`) so roles
// can be granted fine-grained access to records.
export const statements = {
  ...defaultStatements,
  patient: ["read", "write", "delete"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
} as const;

export const ac = createAccessControl(statements);

// We keep Better Auth's default organization role names (owner / admin /
// member) so the creator role and default membership flows work unchanged,
// and add a read-only `viewer`. In the UI these read as Owner / Admin /
// Clinician (member) / Viewer.
//
// owner / admin: run the clinic AND have full access to clinical records.
export const owner = ac.newRole({
  ...ownerAc.statements,
  patient: ["read", "write", "delete"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  patient: ["read", "write", "delete"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
});

// member (clinician): a regular member who can read and edit clinical records.
export const member = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
});

// doctor (clinician): same clinical access as `member` — the role we provision
// for physicians. Kept distinct from `member` so the UI can label/treat it as
// "Doctor" and so reception can be a sibling role with narrower access.
export const doctor = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
});

// reception (front desk): scheduling + patient registration only. Can manage
// appointments and register/edit patient demographics, but has NO access to
// clinical records (no prescription statement at all) — least-privilege per
// EHR RBAC guidance. The patients service additionally redacts clinical fields
// for this role so demographics-only is enforced server-side, not just in UI.
export const reception = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
  appointment: ["read", "write", "delete"],
  task: ["read", "write"],
});

// viewer: read-only access to clinical records.
export const viewer = ac.newRole({
  patient: ["read"],
  appointment: ["read"],
  prescription: ["read"],
  task: ["read"],
});

export const roles = { owner, admin, doctor, reception, member, viewer };
