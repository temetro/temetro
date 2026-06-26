import {
  organizationClient,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, roles } from "@/lib/access";
import { resolveBackendUrl } from "@/lib/backend-url";

// The backend (Express + Better Auth) is a separate origin. The client appends
// `/api/auth` to this base URL and always sends credentials so the session
// cookie set by the backend is included on every request. The base URL is
// derived from the current host (see lib/backend-url.ts) so login works over
// localhost and the clinic LAN alike.
export const authClient = createAuthClient({
  baseURL: resolveBackendUrl(),
  // usernameClient enables signIn.username(...) so admin-provisioned staff can
  // log in with a username; organizationClient powers clinics + RBAC.
  plugins: [usernameClient(), organizationClient({ ac, roles })],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  useActiveOrganization,
  useListOrganizations,
  organization,
} = authClient;
