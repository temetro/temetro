# temetro backend

TypeScript + Express + Postgres API for [temetro](../). Authentication is powered by
[Better Auth](https://better-auth.com) (email/password with verification, password reset, and
multi-tenant **organizations** with role-based access control). Patient records are **scoped to an
organization** (a clinic) and exposed over a small REST API that mirrors the frontend's `Patient`
shape exactly.

## Quick start (Docker)

```bash
docker compose pull          # fetch prebuilt images from Docker Hub (fast)
docker compose up -d         # db + backend + frontend — no setup needed
```

`docker compose up --build` instead builds from source (for development). The
Compose file references the published `temetro/temetro-backend` and
`temetro/temetro-frontend` images with a build fallback, so the same file serves
both clinics and developers. Update with `docker compose pull && docker compose
up -d` (see [`../RELEASING.md`](../RELEASING.md)).

No `.env` or manual secret generation is required: on first start the backend
generates any missing secrets (`BETTER_AUTH_SECRET`, `AI_CREDENTIALS_KEY`) and
persists them to a Docker volume, so they stay stable across restarts. Create a
`.env` (from `.env.example`) only if you want to **override** something — your
own auth secret, SMTP, etc.

- Frontend → http://localhost:3000
- Backend → http://localhost:4000 (health: `GET /health`, auth health: `GET /api/auth/ok`)
- Postgres → localhost:5432

Run only the API + database: `docker compose up db backend`.
Browse the DB with Adminer: `docker compose --profile tools up adminer` → http://localhost:8080.

Migrations are applied automatically on container start (`node dist/migrate.js`).

## Local development (without Docker)

```bash
npm install
cp .env.example .env          # point DATABASE_URL at a local Postgres (localhost:5432)
npm run db:migrate            # apply migrations (drizzle-kit)
npm run dev                   # tsx watch on http://localhost:4000
```

## Auth & schema workflow

The Better Auth tables are generated into `src/db/schema/auth.ts` from `src/auth.ts`. **Re-run after
changing auth config/plugins**, then regenerate the SQL migration:

```bash
npm run auth:generate   # better-auth CLI -> src/db/schema/auth.ts
npm run db:generate     # drizzle-kit -> ./drizzle/*.sql
npm run db:migrate      # apply
```

## API

All patient routes require a signed-in user (Better Auth session cookie) **and** an active
organization; access is gated by the caller's clinic role.

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/patients` | `patient:read` | list patients in the active clinic |
| GET | `/api/patients/:fileNumber` | `patient:read` | one patient (404 if absent) |
| POST | `/api/patients` | `patient:write` | create (409 if file number exists) |
| PUT | `/api/patients/:fileNumber` | `patient:write` | replace the full record |
| DELETE | `/api/patients/:fileNumber` | `patient:delete` | remove a patient |

Other org-scoped resources follow the same pattern (CRUD, role-gated):

| Resource | Base path | Permission | Notes |
| --- | --- | --- | --- |
| Appointments | `/api/appointments` | `appointment:*` | list / create / update / delete |
| Prescriptions | `/api/prescriptions` | `prescription:*` | prescriber defaults to the signed-in user |
| Tasks | `/api/tasks` | `task:*` | `PATCH /:id` for partial updates / the done toggle |
| Notes | `/api/notes` | — (author-scoped) | private to the signed-in author |
| Activity | `GET /api/activity` | — (any member) | audit feed of record changes |
| Analytics | `GET /api/analytics` | — (any member) | computed clinic aggregates |
| Conversations | `/api/conversations` | — (participant-scoped) | staff messaging; real-time over Socket.io |
| Notifications | `/api/notifications` | — (per-recipient) | auto-generated; `read-all` + per-id read |
| Version | `GET /api/version` | — (public) | running version + GitHub-release update check |
| Network | `GET /api/network` | — (public) | detected LAN addresses for sharing the app |

Real-time messaging and live notifications are delivered over **Socket.io**, attached to the same
HTTP server; the handshake is authenticated with the Better Auth session cookie.

Auth endpoints (sign up / in / out, verify email, reset password, organizations & invitations) are
served by Better Auth under `/api/auth/*`.

### Roles

| Role | Patient access | Prescriptions | Lab results | Clinic management |
| --- | --- | --- | --- | --- |
| `owner` | read / write / delete | read / write / delete | read / write | full |
| `admin` | read / write / delete | read / write / delete | read / write | members, invitations, settings |
| `doctor` / `member` (clinician) | read / write | read / write / delete | read / write | — |
| `reception` | read / write (demographics) | — | — | — |
| `pharmacy` | read | read / write | — | — |
| `lab` | read | — | read / write | — |

## Environment

See `.env.example`. If `SMTP_HOST` is unset, verification / reset / invitation emails are **printed
to the server console** instead of being sent — no setup required for local development.
