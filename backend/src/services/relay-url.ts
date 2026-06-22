// Discovers this backend's public relay URL from a cloudflared **quick tunnel**
// so Dockerized off-network testing is zero-config: `docker compose --profile
// tunnel up` starts a cloudflared sidecar that proxies a random
// `https://<sub>.trycloudflare.com` URL to the backend, and we read that URL
// from cloudflared's metrics endpoint (`GET /quicktunnel`) and bake it into the
// wallet-import QR. An explicit PUBLIC_RELAY_URL always wins over this.

let discovered: string | null = null;

export function getDiscoveredRelayUrl(): string | null {
  return discovered;
}

// Poll cloudflared's metrics `/quicktunnel` endpoint until it reports a
// hostname, then cache `https://<hostname>`. Best-effort and quiet: if no
// tunnel is running (e.g. plain `docker compose up`), it gives up after the
// window without affecting normal request handling.
export async function discoverQuickTunnelUrl(
  metricsUrl: string,
  { intervalMs = 2000, timeoutMs = 90_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const base = metricsUrl.replace(/\/$/, "");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/quicktunnel`);
      if (res.ok) {
        const body = (await res.json()) as { hostname?: string };
        const host = body.hostname?.trim();
        if (host) {
          discovered = host.startsWith("http") ? host : `https://${host}`;
          console.log(`Wallet relay reachable via Cloudflare tunnel: ${discovered}`);
          return;
        }
      }
    } catch {
      // cloudflared not up yet (or no tunnel profile) — keep trying until the
      // deadline, then quietly stop.
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
