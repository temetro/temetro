import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

// RBAC for clinics (organizations). We extend Better Auth's default
// organization statements (organization / member / invitation / team) with
// clinical resources (`patient`, `appointment`, `prescription`, `task`, `lab`)
// so roles can be granted fine-grained access to records. `lab` guards the
// lab-results append endpoint so lab staff can submit analyses without
// patient:write.
export const statements = {
  ...defaultStatements,
  patient: ["read", "write", "delete"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
  lab: ["read", "write"],
} as const;

export const ac = createAccessControl(statements);

// We keep Better Auth's default organization role names (owner / admin /
// member) so the creator role and default membership flows work unchanged,
// and add department roles (`doctor`, `reception`, `pharmacy`, `lab`). In the
// UI these read as Owner / Admin / Doctor / Reception / Pharmacy / Lab /
// Clinician (member).
//
// NOTE: `prescription: ["delete"]` doubles as the "full clinician" marker the
// frontend route gating probes (owner/admin/doctor/member only) — don't grant
// it to department roles like pharmacy.
//
// owner / admin: run the clinic AND have full access to clinical records.
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

// member (clinician): a regular member who can read and edit clinical records.
export const member = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
  lab: ["read", "write"],
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
  lab: ["read", "write"],
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

// pharmacy (dispensing): reviews and dispenses prescriptions — read patients
// (allergies, current meds) and appointments, read/write prescriptions (status
// updates, NOT delete — see the full-clinician marker note above), and work
// the task queue. Per pharmacy RBAC guidance: dispense/review, never
// prescribe-from-scratch.
export const pharmacy = ac.newRole({
  ...memberAc.statements,
  patient: ["read"],
  appointment: ["read"],
  prescription: ["read", "write"],
  task: ["read", "write"],
});

// lab (analyses): submits lab results via the dedicated `lab` statement (no
// patient:write, so they can't edit the rest of the record) and works the lab
// task queue. No prescription statement — lab staff don't see medications.
export const lab = ac.newRole({
  ...memberAc.statements,
  patient: ["read"],
  appointment: ["read"],
  task: ["read", "write"],
  lab: ["read", "write"],
});

export const roles = { owner, admin, doctor, reception, pharmacy, lab, member };
