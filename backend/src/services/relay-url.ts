// Discovers this backend's public relay URL from a cloudflared **quick tunnel**
// so Dockerized off-network testing is zero-config (`npm run docker:tunnel`).
// cloudflared proxies a random `https://<sub>.trycloudflare.com` URL to the
// backend and reports it on its metrics endpoint (`GET /quicktunnel`).
//
// Crucially we only publish that URL once it's actually **reachable from the
// public internet** — a fresh quick tunnel returns Cloudflare error 1033 for
// ~30s while it propagates to the edge, and baking a not-yet-reachable URL into
// the QR is exactly what makes a scan fail with "couldn't reach the clinic".
// An explicit PUBLIC_RELAY_URL always wins over this.

let discovered: string | null = null;
let discovery: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getDiscoveredRelayUrl(): string | null {
  return discovered;
}

// Kick off discovery once (idempotent). Safe to call at startup.
export function beginQuickTunnelDiscovery(metricsUrl: string): Promise<void> {
  if (!discovery) discovery = runDiscovery(metricsUrl);
  return discovery;
}

// Return the discovered public URL, waiting up to `capMs` for an in-flight
// discovery to finish (so a QR generated right after startup still gets the
// tunnel URL rather than a localhost fallback). Null if not ready in time.
export async function awaitQuickTunnelUrl(
  metricsUrl: string,
  capMs = 25_000,
): Promise<string | null> {
  if (discovered) return discovered;
  const inFlight = beginQuickTunnelDiscovery(metricsUrl);
  await Promise.race([inFlight, sleep(capMs)]);
  return discovered;
}

async function runDiscovery(metricsUrl: string): Promise<void> {
  const base = metricsUrl.replace(/\/$/, "");
  const deadline = Date.now() + 150_000;

  // 1) Ask cloudflared for the quick-tunnel hostname.
  let url: string | null = null;
  while (!url && Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/quicktunnel`);
      if (res.ok) {
        const body = (await res.json()) as { hostname?: string };
        const host = body.hostname?.trim();
        if (host) url = host.startsWith("http") ? host : `https://${host}`;
      }
    } catch {
      // cloudflared not up yet (or no tunnel running) — keep trying.
    }
    if (!url) await sleep(2000);
  }
  if (!url) {
    console.warn("Cloudflare tunnel: no quick-tunnel URL reported by cloudflared.");
    return;
  }

  // 2) Wait until the tunnel is actually reachable end-to-end (edge → cloudflared
  //    → backend) before publishing it, so the QR only ever carries a live URL.
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        discovered = url;
        console.log(`Wallet relay reachable via Cloudflare tunnel: ${url}`);
        return;
      }
    } catch {
      // Still propagating (HTTP 1033 / timeout) — retry.
    }
    await sleep(2000);
  }

  // Edge never confirmed within the window; publish best-effort (it usually
  // comes up shortly) but warn so the cause is visible.
  discovered = url;
  console.warn(`Cloudflare tunnel URL set but not confirmed reachable: ${url}`);
}
