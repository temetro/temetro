import { apiFetch } from "@/lib/api-client";

// Start a password reset by username (for staff who sign in with a username
// rather than an email). The backend resolves the username to its account and
// hands off to Better Auth's reset flow. Always resolves; never reveals whether
// the username exists.
export async function requestResetByUsername(
  username: string,
  redirectTo: string,
): Promise<void> {
  await apiFetch("/api/auth-helpers/reset-by-username", {
    method: "POST",
    body: JSON.stringify({ username, redirectTo }),
  });
}
