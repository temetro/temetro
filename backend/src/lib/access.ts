import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

// RBAC for clinics (organizations). We extend Better Auth's default
// organization statements (organization / member / invitation / team) with a
// `patient` resource so roles can be granted fine-grained access to records.
export const statements = {
  ...defaultStatements,
  patient: ["read", "write", "delete"],
} as const;

export const ac = createAccessControl(statements);

// We keep Better Auth's default organization role names (owner / admin /
// member) so the creator role and default membership flows work unchanged,
// and add a read-only `viewer`. In the UI these read as Owner / Admin /
// Clinician (member) / Viewer.
//
// owner / admin: run the clinic AND have full access to patient records.
export const owner = ac.newRole({
  ...ownerAc.statements,
  patient: ["read", "write", "delete"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  patient: ["read", "write", "delete"],
});

// member (clinician): a regular member who can read and edit patient records.
export const member = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
});

// viewer: read-only access to patient records.
export const viewer = ac.newRole({
  patient: ["read"],
});

export const roles = { owner, admin, member, viewer };
