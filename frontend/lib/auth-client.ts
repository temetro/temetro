import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, roles } from "@/lib/access";

// The backend (Express + Better Auth) is a separate origin. The client appends
// `/api/auth` to this base URL and always sends credentials so the session
// cookie set by the backend is included on every request.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  plugins: [organizationClient({ ac, roles })],
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
