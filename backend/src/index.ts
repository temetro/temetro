import { createServer } from "node:http";

import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { auth } from "./auth.js";
import { env } from "./env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { initRealtime } from "./realtime.js";
import { activityRouter } from "./routes/activity.js";
import { analyticsRouter } from "./routes/analytics.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { conversationsRouter } from "./routes/conversations.js";
import { inventoryRouter } from "./routes/inventory.js";
import { notesRouter } from "./routes/notes.js";
import { notificationsRouter } from "./routes/notifications.js";
import { patientsRouter } from "./routes/patients.js";
import { prescriptionsRouter } from "./routes/prescriptions.js";
import { settingsRouter } from "./routes/settings.js";
import { staffRouter } from "./routes/staff.js";
import { tasksRouter } from "./routes/tasks.js";

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

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/patients", patientsRouter);
app.use("/api/notes", notesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/prescriptions", prescriptionsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/staff", staffRouter);
app.use("/api/activity", activityRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/settings", settingsRouter);

app.use(notFound);
app.use(errorHandler);

// Wrap the Express app in an HTTP server so Socket.io can share the port.
const server = createServer(app);
initRealtime(server);

server.listen(env.PORT, () => {
  console.log(`temetro backend listening on ${env.BETTER_AUTH_URL}`);
  console.log(`  • auth:     /api/auth/*  (frontend origin: ${env.FRONTEND_URL})`);
  console.log(`  • patients: /api/patients`);
  console.log(`  • notes:    /api/notes`);
  console.log(`  • appts:    /api/appointments`);
  console.log(`  • rx:       /api/prescriptions`);
  console.log(`  • stock:    /api/inventory`);
  console.log(`  • tasks:    /api/tasks`);
  console.log(`  • staff:    /api/staff`);
  console.log(`  • activity: /api/activity`);
  console.log(`  • stats:    /api/analytics`);
  console.log(`  • messages: /api/conversations  (+ Socket.io)`);
  console.log(`  • notifs:   /api/notifications`);
  console.log(`  • settings: /api/settings`);
});
