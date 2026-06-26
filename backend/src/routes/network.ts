// GET /api/network — best-effort discovery of LAN addresses other departments
// can use to reach temetro, for the Settings "Network access" panel.
//
// Caveat: inside Docker's default bridge network this sees the container's IPs,
// not the host's LAN IP, so the frontend prefers the address the browser is
// actually using (window.location) and treats this as a fallback/hint.
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

const router = Router();

router.get("/", (_req, res) => {
  const port = frontendPort();
  const addresses: string[] = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const net of iface ?? []) {
      // Node <18 reports family as "IPv4"; >=18 may report the number 4.
      const isV4 = net.family === "IPv4" || (net.family as unknown) === 4;
      if (isV4 && !net.internal) addresses.push(net.address);
    }
  }
  res.json({
    port,
    addresses,
    urls: addresses.map((ip) => `http://${ip}:${port}`),
  });
});

export const networkRouter = router;
