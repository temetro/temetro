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
} as const;

export const ac = createAccessControl(statements);

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

export const member = ac.newRole({
  ...memberAc.statements,
  patient: ["read", "write"],
  appointment: ["read", "write", "delete"],
  prescription: ["read", "write", "delete"],
  task: ["read", "write", "delete"],
});

export const viewer = ac.newRole({
  patient: ["read"],
  appointment: ["read"],
  prescription: ["read"],
  task: ["read"],
});

export const roles = { owner, admin, member, viewer };

// Human-readable labels for the role keys used in the UI.
export const ROLE_LABELS: Record<keyof typeof roles, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Clinician",
  viewer: "Viewer",
};
