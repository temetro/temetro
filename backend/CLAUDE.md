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

- **`src/auth.ts`** — the Better Auth config (the CLI auto-discovers it). Email/password,
  organization plugin (clinics) with custom RBAC from **`src/lib/access.ts`**
  (`owner`/`admin`/`member`/`viewer` + a `patient` resource). Mounted in `src/index.ts` via
  `toNodeHandler(auth)` at `/api/auth/*`.
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

## Not built yet

The AI `/chat` endpoint (LLM proxy) and the signing / patient-owned-storage / approval flow.
