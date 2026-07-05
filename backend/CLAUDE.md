# CLAUDE.md

Guidance for Claude Code when working in `backend/`. See the root `../CLAUDE.md` for the project
vision and `README.md` here for run/setup instructions.

## What this is

The temetro API: **TypeScript + Express 5 + Postgres (Drizzle ORM)**, with authentication and
multi-tenant clinics via **Better Auth**. Serves the `../frontend` app. ESM (`"type": "module"`),
Node ≥ 20. This is its own git repo — commit changes here with the
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

## Commands

```bash
npm run dev          # tsx watch on http://localhost:4000
npm run build        # tsc -> dist/
npm run typecheck    # tsc --noEmit
npm run auth:generate  # Better Auth CLI -> src/db/schema/auth.ts (re-run after auth config changes)
npm run db:generate    # drizzle-kit: schema -> ./drizzle/*.sql migration
npm run db:migrate     # drizzle-kit: apply migrations (local dev)
npm run db:apply       # node dist/migrate.js — runtime migrator (used by Docker)
```

No test runner is configured. Verify by running the stack (`docker compose up`) and curling, or
`npm run dev` against a local Postgres. See `README.md`.

## Architecture

- **`src/auth.ts`** — the Better Auth config (the CLI auto-discovers it). Email/password +
  **username** plugin (staff sign in by username) and the organization plugin (clinics) with custom
  RBAC from **`src/lib/access.ts`** (`owner`/`admin`/`doctor`/`reception`/`pharmacy`/`lab`/`member`
  over `patient`/`appointment`/`prescription`/`task`/`lab` resources). `reception` has no
  `prescription` statement — it's scoped to scheduling + registration, and
  `src/services/patients.ts` redacts clinical fields for it. `pharmacy` has `prescription`
  read/write (no delete — `prescription:delete` is the full-clinician marker the frontend route
  gating probes); `lab` submits results via the `lab` statement (`POST
  /api/patients/:fileNumber/labs`) without `patient:write`. Mounted in `src/index.ts` via `toNodeHandler(auth)` at `/api/auth/*`.
- **`src/routes/staff.ts`** — admin-provisioned staff: `POST /api/staff` creates a user
  (`auth.api.signUpEmail`) + attaches them to the clinic (`auth.api.addMember`); `GET /api/staff`
  lists members with usernames. Replaces the old email-invitation flow. Gated by
  `requirePermission({ member: ["create"] })`.
- **Better Auth = the single source of RBAC.** Manage all permissions through Better Auth, not a
  custom layer. Authoritative references live as repo skills under
  `.claude/skills/{better-auth-best-practices,organization-best-practices,
  email-and-password-best-practices,better-auth-security-best-practices}` — consult them before
  changing `auth.ts`, `src/lib/access.ts`, or the auth schema.
- **`src/db/`** — `index.ts` is the Drizzle client (no schema passed; we use the core query builder).
  `schema/auth.ts` is **generated** by the Better Auth CLI; `schema/patients.ts` is hand-written and
  references the generated `organization`/`user` tables.
- **`src/services/patients.ts`** maps DB rows ⇆ the canonical `Patient` shape
  (`src/types/patient.ts`, mirrors `../frontend/lib/patients.ts`). **`src/routes/patients.ts`** is
  org-scoped CRUD, gated by **`src/middleware/auth.ts`** (`requireAuth` → `requireOrg` →
  `requirePermission`).
- **Other resources** follow the patients/notes pattern (schema → validation → types → service →
  org-scoped route): **appointments**, **prescriptions**, **tasks** (RBAC-gated like patients),
  plus **activity** (an audit log written best-effort from every resource route via
  `services/activity.ts`), **analytics** (computed aggregates), **messaging** (conversations /
  participants / messages) and **notifications** (per-recipient, auto-generated).
- **Real-time** lives in **`src/realtime.ts`** — a Socket.io server attached to the same HTTP server
  in `index.ts`; the handshake reuses Better Auth's `getSession`. Other modules push via
  `emitToUser` / `emitToConversation` (no direct socket import, so no circular deps).
- **Patient-wallet relay** is **no longer hosted here.** Devices connect to the standalone **Temetro
  Network** service (`~/Desktop/Temetro-network`, see root `CLAUDE.md`), which is **multi-clinic**.
  This backend connects to it as a `/hub` client in **`src/services/relay-client.ts`**, keeping **one
  authenticated connection per network-enabled org** (`hubs` map keyed by `orgId`). Each org
  authenticates by signing the relay's `hub:challenge` with its clinic signing key
  (`signWithClinicKey`) — no shared `RELAY_TOKEN` needed (it's now optional/legacy, only for a
  private relay). `emitToWallet(orgId, …)` (realtime.ts) delegates to `sendToWallet(orgId, …)`, and
  device responses (`wallet:share-response` / `wallet:update-response` / `wallet:revoke`) +
  `wallet:online` replay are handled per-org there, calling the same `wallet-share` /
  `wallet-updates` services the old `/wallet` namespace did. A clinic opts in via **"Join Temetro
  Network"** (Settings → Signing → `PUT /api/signing/network`, `clinic_signing_keys.network_enabled`);
  `connectOrg`/`disconnectOrg` open/close its connection, and wallet routes 409 when it's off.
- **`src/lib/email.ts`** — `sendEmail` logs links to the console when SMTP is unset.

## Gotchas / conventions

- **Schema generation order (circular bootstrap):** `auth.ts` → `db/index.ts` must NOT pull in the
  patient schema, so the Better Auth CLI can load `auth.ts` to (re)generate `schema/auth.ts`. After
  any auth/plugin change: `npm run auth:generate` → `npm run db:generate` → `npm run db:migrate`.
- **Express 5** needs a named wildcard: `app.all("/api/auth/*splat", …)`, and the Better Auth handler
  must be registered **before** `express.json()`.
- **Secure cookies** key off `BETTER_AUTH_URL` scheme (https), **not** `NODE_ENV` — otherwise login
  breaks over `http://localhost` in the production-mode Docker stack.
- **Rate limiting** needs a client IP; behind no proxy we backfill `x-forwarded-for` from the socket
  in `index.ts` so it still applies.
- **Env:** `src/env.ts` (zod) treats empty strings as unset (compose passes `${VAR:-}` as `""`) and
  has dev defaults so the CLIs can load the config offline.
- **Email verification is wired but NOT enforced** at sign-in
  (`emailAndPassword.requireEmailVerification: false` in `auth.ts`) — re-enable by flipping it to
  `true` (and route signup back to `/verify-email` in the frontend).
- Docker: migrations run on container start (`node dist/migrate.js`); `docker-compose.yml` exposes a
  configurable `POSTGRES_PORT` host port.

## AI chat

- **`src/routes/chat.ts`** — `POST /api/chat`, a tool-using agent (AI SDK v6 `streamText`)
  gated by `patient:read`. Providers resolve from the picked model id via
  **`src/services/ai/provider.ts`** (Anthropic / OpenAI / Gemini for API-key mode, or a
  local Ollama via the OpenAI-compatible endpoint). Tools (`src/services/ai/tools.ts`)
  reuse the patient service under the same role scoping and stream **real** record data to
  the client as custom data parts while the model sees only Veil-redacted results.
- **Veil** (`src/services/ai/veil.ts`) de-identifies PHI to tokens before external calls,
  resolves tokens on tool args, and rehydrates the final text (external mode runs
  non-streamed so the rehydrated text is correct). Local mode bypasses it.
- **AI config** lives in **`src/routes/ai.ts`** (`/api/ai/config`, `/test`, `/import`) over
  the `user_ai_settings` table; provider keys are encrypted with `src/lib/crypto.ts`
  (`AI_CREDENTIALS_KEY`). The migration **import** is gated behind a client approval step
  and re-validated server-side.

## Not built yet

The signing / patient-owned-storage / approval flow.
