// Decides which browser origins may call the API with credentials.
//
// temetro is self-hosted: a clinic runs it on one machine and other departments
// reach it over the LAN by the host's IP (e.g. http://192.168.1.20:3000). The
// browser there sends that LAN origin, which must be allowed for both CORS and
// Better Auth's CSRF/trusted-origin check. We allow:
//   - FRONTEND_URL (the configured origin),
//   - any explicitly listed TRUSTED_ORIGINS (or "*" for any),
//   - localhost and private/LAN hosts (so LAN access works with no config).
import { env } from "../env.js";

const configured = (env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowAll = configured.includes("*");

function isPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }
  // Private IPv4 ranges (RFC 1918) + link-local.
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  // mDNS .local hostnames (e.g. clinic-pc.local).
  if (hostname.endsWith(".local")) return true;
  return false;
}

/** True if `origin` (an `Origin` header value) is allowed to call the API. */
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false;
  if (allowAll) return true;
  if (origin === env.FRONTEND_URL) return true;
  if (configured.includes(origin)) return true;
  try {
    return isPrivateHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}
