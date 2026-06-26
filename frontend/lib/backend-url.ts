// Resolves the backend's base URL at runtime instead of baking it in at build.
//
// temetro ships as a prebuilt image and is reached from many hosts — the
// server's own machine (localhost) and other departments over the LAN (the
// host's IP, e.g. http://192.168.1.20:3000). A URL baked at build time can't
// serve all of them, so in the browser we derive the backend URL from the page
// the user actually loaded (same hostname, the backend's port). Set
// NEXT_PUBLIC_API_URL to override for custom/reverse-proxied deployments.

const ENV_URL = process.env.NEXT_PUBLIC_API_URL?.trim();
// Backend port; override only if you publish the API on a non-default port.
const API_PORT = process.env.NEXT_PUBLIC_API_PORT?.trim() || "4000";

/** The backend origin to call from the current context. */
export function resolveBackendUrl(): string {
  if (ENV_URL) return ENV_URL;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  // Server-side fallback (SSR/build); real browser calls use the branch above.
  return "http://localhost:4000";
}
