# temetro

**temetro** is an **open-source** clinical tool that acts as an **AI middleman** between clinicians
and patient data. Clinicians use a natural-language AI chat to retrieve and organize patient
information, displayed as rich record cards.

Its distinguishing idea is a **patient-owned data model**: instead of (or alongside) living in a
doctor's own database, a patient's record can be stored on the **patient's own device**. When a
clinician adds or changes data, they **sign** it (blockchain-style); the change is written to the
patient's record and **cannot be modified until the patient approves it** through a companion app.
temetro can also **read existing patient databases** and present them in the same organized card UI.

> **Status.** The **backend is built** — a TypeScript + Express + Postgres API (Drizzle ORM) with
> authentication and multi-tenant clinics via [Better Auth](https://better-auth.com), an org-scoped
> patient records API, plus appointments, prescriptions, tasks, doctor's notes, analytics, an
> activity audit log, real-time staff messaging (Socket.io), and notifications. The **frontend chat
> is wired to it** (real auth, route protection, clinic switching, live patient data).
>
> **Still vision, not built:** the patient companion app and the blockchain-style
> **signing / patient-owned storage / approval** flow, and the AI chat replies themselves (currently
> mock — no LLM call yet; a `/chat` endpoint is the next planned step).

## Monorepo layout

This repository is a **monorepo** containing two independent apps that live side by side (each with
its own `package.json` / `node_modules` and its own `CLAUDE.md`):

- **[`frontend/`](./frontend)** — the Next.js 16 product app (the clinician-facing AI chat UI).
  See [`frontend/CLAUDE.md`](./frontend/CLAUDE.md).
- **[`backend/`](./backend)** — the Express 5 + Postgres API (Drizzle ORM + Better Auth).
  See [`backend/CLAUDE.md`](./backend/CLAUDE.md) and [`backend/README.md`](./backend/README.md).

The marketing **landing page lives in its own separate repository** (`temetro-landing`), not here.

## Run locally with Docker (recommended)

Docker Compose builds and runs Postgres, the backend, and the frontend together. From the
**`backend/`** directory (the Compose file builds the sibling `../frontend`):

```bash
cd backend
cp .env.example .env

# generate a strong auth secret and paste it into BETTER_AUTH_SECRET in .env:
openssl rand -base64 32

docker compose up --build
```

Then open:

- Frontend → http://localhost:3000
- Backend → http://localhost:4000 (health check: `GET /health`)
- Postgres → localhost:5432

Database migrations are applied automatically on backend container start.

**Port conflict?** If another Postgres already holds host port `5432`, set `POSTGRES_PORT` (e.g.
`5433`) in `backend/.env`. The app still talks to Postgres internally on `db:5432`; only the
published host port changes.

Run just the API + database with `docker compose up db backend`. To browse the database with
Adminer: `docker compose --profile tools up adminer` → http://localhost:8080.

## Run locally without Docker

Run each app in its own terminal (you'll need a local Postgres reachable from `DATABASE_URL`):

```bash
# backend
cd backend
npm install
cp .env.example .env        # point DATABASE_URL at your local Postgres
npm run db:migrate          # apply migrations
npm run dev                 # http://localhost:4000

# frontend (second terminal)
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

The frontend reads `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`) to reach the backend.

> If `SMTP_HOST` is unset, verification / reset / invitation emails are **printed to the backend
> console** instead of being sent — no email setup is needed for local development.

## Tech stack

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · i18next ·
  Socket.io client.
- **Backend:** Node ≥ 20 · TypeScript (ESM) · Express 5 · Postgres · Drizzle ORM · Better Auth
  (email/password + organizations/RBAC) · Socket.io.

## License

MIT.
