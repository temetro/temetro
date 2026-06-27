// GET /api/network — best-effort discovery of LAN addresses other departments
// can use to reach temetro, for the Settings "Network access" panel.
//
// Caveat: inside Docker's network this sees the container's bridge IP (e.g.
// 172.x), not the host's LAN IP. Surfacing that bogus address looked like an
// error in Settings, so when we detect we're in a container we return NO
// addresses — the frontend then prefers the address the browser is actually
// using (window.location) and otherwise shows a helpful "open via the server's
// IP" hint instead of an unreachable container IP.
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";

import { Router } from "express";

import { env } from "../env.js";

function frontendPort(): number {
  try {
    const port = new URL(env.FRONTEND_URL).port;
    return port ? Number(port) : 3000;
  } catch {
    return 3000;
  }
}

// True when running inside a container: the interface IPs are the container's
// bridge network, not the host's reachable LAN address.
function inContainer(): boolean {
  return existsSync("/.dockerenv") || process.env.RUNNING_IN_DOCKER === "true";
}

const router = Router();

router.get("/", (_req, res) => {
  const port = frontendPort();
  const addresses: string[] = [];
  if (!inContainer()) {
    for (const iface of Object.values(networkInterfaces())) {
      for (const net of iface ?? []) {
        // Node <18 reports family as "IPv4"; >=18 may report the number 4.
        const isV4 = net.family === "IPv4" || (net.family as unknown) === 4;
        if (isV4 && !net.internal) addresses.push(net.address);
      }
    }
  }
  res.json({
    port,
    addresses,
    urls: addresses.map((ip) => `http://${ip}:${port}`),
  });
});

export const networkRouter = router;
