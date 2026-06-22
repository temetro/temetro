// Run the backend with a public Cloudflare tunnel so a patient's phone can reach
// the wallet relay from ANY network (cellular, other Wi-Fi) — not just the LAN.
//
//   npm run dev:tunnel
//
// It opens `cloudflared tunnel --url http://localhost:4000`, grabs the public
// https://<sub>.trycloudflare.com URL, and starts the backend with
// PUBLIC_RELAY_URL set to it — so the QR in "Import from a patient app" carries
// that public URL (over wss://). Requires cloudflared: `brew install cloudflared`.

import { spawn, spawnSync } from "node:child_process";

const PORT = process.env.PORT || "4000";

function hasCloudflared() {
  const probe = spawnSync("cloudflared", ["--version"], { stdio: "ignore" });
  return !probe.error;
}

if (!hasCloudflared()) {
  console.error(
    "\n✖ cloudflared is not installed.\n" +
      "  Install it, then re-run `npm run dev:tunnel`:\n\n" +
      "    brew install cloudflared        # macOS\n" +
      "    # or see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n",
  );
  process.exit(1);
}

let backend = null;
let resolvedUrl = null;
const TUNNEL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

console.log(`\n⛅ Starting Cloudflare tunnel to http://localhost:${PORT} …\n`);

const tunnel = spawn(
  "cloudflared",
  ["tunnel", "--url", `http://localhost:${PORT}`],
  { stdio: ["ignore", "pipe", "pipe"] },
);

function onTunnelOutput(buf) {
  const text = buf.toString();
  process.stderr.write(text); // keep cloudflared's own logs visible
  if (resolvedUrl) return;
  const match = text.match(TUNNEL_RE);
  if (match) {
    resolvedUrl = match[0];
    startBackend(resolvedUrl);
  }
}

tunnel.stdout.on("data", onTunnelOutput);
tunnel.stderr.on("data", onTunnelOutput);

function startBackend(publicUrl) {
  console.log(
    `\n✅ Public relay URL: ${publicUrl}\n` +
      "   Generate a QR in the web app (Patients → Import from a patient app → QR);\n" +
      "   it will carry this URL, so a phone on any network can scan to connect.\n",
  );
  backend = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    env: { ...process.env, PUBLIC_RELAY_URL: publicUrl },
  });
  backend.on("exit", (code) => shutdown(code ?? 0));
}

function shutdown(code) {
  for (const proc of [backend, tunnel]) {
    if (proc && !proc.killed) proc.kill("SIGTERM");
  }
  process.exit(code);
}

tunnel.on("exit", (code) => {
  if (!resolvedUrl) {
    console.error("\n✖ cloudflared exited before a tunnel URL was established.");
  }
  shutdown(code ?? 0);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
