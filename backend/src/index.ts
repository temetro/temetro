import { createServer } from "node:http";

import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { auth } from "./auth.js";
import { env } from "./env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { initRealtime } from "./realtime.js";
import { activityRouter } from "./routes/activity.js";
import { authHelpersRouter } from "./routes/auth-helpers.js";
import { aiRouter } from "./routes/ai.js";
import { analyticsRouter } from "./routes/analytics.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { chatRouter } from "./routes/chat.js";
import { conversationsRouter } from "./routes/conversations.js";
import { dispensesRouter } from "./routes/dispenses.js";
import { integrationsRouter } from "./routes/integrations.js";
import { inventoryRouter } from "./routes/inventory.js";
import { invoicesRouter } from "./routes/invoices.js";
import { meetingsRouter } from "./routes/meetings.js";
import { notesRouter } from "./routes/notes.js";
import { notificationsRouter } from "./routes/notifications.js";
import { patientsRouter } from "./routes/patients.js";
import { patientsWalletRouter } from "./routes/patients-wallet.js";
import { portalRouter } from "./routes/portal.js";
import { prescriptionsRouter } from "./routes/prescriptions.js";
import { settingsRouter } from "./routes/settings.js";
import { signingRouter } from "./routes/signing.js";
import { staffRouter } from "./routes/staff.js";
import { tasksRouter } from "./routes/tasks.js";
import { beginQuickTunnelDiscovery } from "./services/relay-url.js";
import { sweepExpiredShares } from "./services/wallet-share.js";

const app = express();

// Behind docker / a reverse proxy we trust forwarding headers for client IPs.
app.set("trust proxy", true);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

// Better Auth derives the client IP from forwarding headers (used for rate
// limiting and audit). Behind a real proxy that header is already present; for
// direct connections (local dev) we backfill it from the socket so rate
// limiting still applies.
app.use((req, _res, next) => {
  if (!req.headers["x-forwarded-for"]) {
    const ip = req.socket?.remoteAddress;
    if (ip) req.headers["x-forwarded-for"] = ip;
  }
  next();
});

// Better Auth mounts its own handler. It MUST be registered before
// express.json() so it can read the raw request body. Express 5 requires a
// named wildcard ("*splat") rather than a bare "*".
app.all("/api/auth/*splat", toNodeHandler(auth));

// 15mb accommodates base64-encoded message attachments (capped at 10mb of bytes
// in the conversations route, which is ~13.3mb once base64-encoded).
app.use(express.json({ limit: "15mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Mount the wallet import routes BEFORE the generic patients router so
// `/api/patients/wallet/...` isn't matched by patients' `/:fileNumber`.
app.use("/api/patients/wallet", patientsWalletRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/signing", signingRouter);
app.use("/api/attachments", attachmentsRouter);
app.use("/api/notes", notesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/prescriptions", prescriptionsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/dispenses", dispensesRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/staff", staffRouter);
app.use("/api/activity", activityRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/meetings", meetingsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/chat", chatRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/portal", portalRouter);
app.use("/api/auth-helpers", authHelpersRouter);

app.use(notFound);
app.use(errorHandler);

// Wrap the Express app in an HTTP server so Socket.io can share the port.
const server = createServer(app);
initRealtime(server);

// Sweep expired temporary patient-wallet shares (auto-delete) every 5 minutes.
const SHARE_SWEEP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  sweepExpiredShares().catch((err) =>
    console.error("Wallet share sweep failed:", err),
  );
}, SHARE_SWEEP_INTERVAL).unref();

server.listen(env.PORT, () => {
  console.log(`temetro backend listening on ${env.BETTER_AUTH_URL}`);
  console.log(`  • auth:     /api/auth/*  (frontend origin: ${env.FRONTEND_URL})`);
  console.log(`  • patients: /api/patients`);
  console.log(`  • files:    /api/attachments`);
  console.log(`  • notes:    /api/notes`);
  console.log(`  • appts:    /api/appointments`);
  console.log(`  • rx:       /api/prescriptions`);
  console.log(`  • stock:    /api/inventory`);
  console.log(`  • dispense: /api/dispenses`);
  console.log(`  • tasks:    /api/tasks`);
  console.log(`  • staff:    /api/staff`);
  console.log(`  • activity: /api/activity`);
  console.log(`  • stats:    /api/analytics`);
  console.log(`  • messages: /api/conversations  (+ Socket.io)`);
  console.log(`  • notifs:   /api/notifications`);
  console.log(`  • settings: /api/settings`);
  console.log(`  • ai:       /api/ai  (config + import)`);
  console.log(`  • chat:     /api/chat  (LLM agent)`);
  console.log(`  • integr.:  /api/integrations  (FHIR / e-Rx / claims)`);
  console.log(`  • portal:   /api/portal  (public clinic kiosk)`);
  console.log(`  • signing:  /api/signing  (Ed25519 clinic key)`);
  console.log(`  • wallet:   /api/patients/wallet  (+ /wallet socket relay)`);
});

// Dockerized off-network testing: learn our public Cloudflare quick-tunnel URL
// (from the `tunnel` compose profile) so the wallet-import QR points at it.
// No-op unless a tunnel sidecar is configured and PUBLIC_RELAY_URL is unset.
if (env.CLOUDFLARED_METRICS_URL && !env.PUBLIC_RELAY_URL) {
  void beginQuickTunnelDiscovery(env.CLOUDFLARED_METRICS_URL);
}
