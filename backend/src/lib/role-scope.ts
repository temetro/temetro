// Role-derived patient visibility, shared by the patient routes and the AI chat
// tools so both enforce identical scoping.

function roleNames(memberRole: string | undefined): string[] {
  return String(memberRole ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Only the `doctor` role is scoped to its own panel of patients. Any elevated
// clinical role (owner / admin / member) sees the whole clinic, so scoping never
// applies when the caller also holds one of those. Returns the user id to scope
// by, or undefined for "see everything".
export function providerScope(
  memberRole: string | undefined,
  userId: string,
): string | undefined {
  const names = roleNames(memberRole);
  if (!names.includes("doctor")) return undefined;
  if (names.some((r) => ["owner", "admin", "member"].includes(r))) {
    return undefined;
  }
  return userId;
}

// The `reception` role is scoped to scheduling + registration: it sees and
// writes patient demographics only, never clinical PHI. True only when the
// caller's role set is reception without any clinical-capable role.
export function isReceptionOnly(memberRole?: string): boolean {
  const names = roleNames(memberRole);
  if (!names.includes("reception")) return false;
  return !names.some((r) => ["owner", "admin", "doctor", "member"].includes(r));
}
