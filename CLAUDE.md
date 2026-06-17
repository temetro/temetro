# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`temetro` — an **open-source** clinical tool that acts as an **AI middleman** between clinicians and
patient data. Clinicians use a natural-language AI chat to retrieve and organize patient information,
displayed as rich record cards.

The distinguishing idea is a **patient-owned data model**. Instead of (or alongside) living in a
doctor's own database, a patient's record can be stored on the **patient's own device**. When a
clinician adds or changes data, they **sign** it (blockchain-style); the change is written to the
patient's record and **cannot be modified until the patient approves it** through a companion app.
temetro can also **read existing patient databases** and present them in the same organized card UI.

This repository is a **monorepo**: the `frontend/` and `backend/` apps live side by side in one git
repository (published as `temetro`).

> **Status:** the **backend is built**. `backend/` is a TypeScript + Express + Postgres API
> (Drizzle ORM) with authentication and multi-tenant clinics via **Better Auth**, plus an
> **org-scoped patient records API**. The `frontend/` chat is **wired to it**: real auth
> (login/signup/reset/onboarding), route protection, clinic switching, and patient data fetched
> over the API — the old in-memory fixture is gone (`frontend/lib/patients.ts` now calls the backend).
>
> **Still vision, not built:** the patient companion app and the blockchain-style **signing /
> patient-owned storage / approval** flow. The AI chat itself is still **mock replies** (no LLM
> call yet — a `/chat` endpoint is the next planned step). Email verification is wired but
> currently **not enforced** at sign-in (see `backend/CLAUDE.md`).

## Layout

`frontend/` and `backend/` were previously separate per-folder git repos; they have been **merged
into this single monorepo with full history of both preserved**.

The marketing **landing page is not in this monorepo** — it lives in the sibling Desktop folder
`../temetro/landing-page` (`/Users/khalidabdi/Desktop/temetro/landing-page`), right next to the
`../temetro/docs` site. It is **its own git repository** (a Next.js app with the marketing
`components/landing/`); edit and commit it there, separately from this repo.

- **`frontend/`** — the Next.js product app (the AI chat UI). This is where almost all current work
  happens. **It has its own `CLAUDE.md`** — read `frontend/CLAUDE.md` for the stack, commands,
  architecture, and gotchas.
- **`backend/`** — the TypeScript + Express + Postgres API (Drizzle ORM + Better Auth). Built and
  Dockerised. **Has its own `CLAUDE.md`** (and `README.md`) — read it for the auth/schema workflow
  and gotchas.

`frontend/` and `backend/` are **independent apps**, each with its own `package.json` /
`node_modules`. Run `npm` commands from inside the relevant app directory, not from this root.

## Documentation (very important)

The **project documentation lives outside this repo**, in the sibling Desktop folder
`../temetro/docs` (`/Users/khalidabdi/Desktop/temetro/docs`) — a Fumadocs (Next.js) site with
user guides (`content/docs/guides/`), an API reference (`content/docs/api/`), admin docs, and a
roadmap (`content/docs/roadmap.mdx`). It is its own git repository.

**Whenever you make a significant change here — a new feature, endpoint, page, or behavior
change — update the affected docs pages in the same work session** so the documentation stays
accurate (e.g. a new backend route needs an `content/docs/api/*.mdx` entry; a UI feature belongs
in the matching guide; status changes belong in the roadmap). Commit docs changes inside that
repo, separately from this one.

## Running the stack

From `backend/`: ensure a `.env` exists (`cp .env.example .env`, then set `BETTER_AUTH_SECRET` via
`openssl rand -base64 32`), then `docker compose up --build` → frontend :3000, backend :4000,
Postgres. Compose builds the sibling `../frontend` app, which works because they remain siblings in
the monorepo. See `backend/README.md`.

> **Port note:** if another Postgres already holds host port 5432, set `POSTGRES_PORT` (e.g. `5433`)
> in `backend/.env` — the app still talks to Postgres internally on `db:5432`; only the published
> host port changes.

For local dev without Docker, run `npm run dev` in `backend/` and `frontend/` separately (the
frontend reads `NEXT_PUBLIC_API_URL`, default `http://localhost:4000`).

## Version control (single monorepo)

This root is **one git repository** (`temetro`). The old per-folder `.git` repos are gone —
`frontend/` and `backend/` are plain subdirectories now.

**Commit after every change.** When you finish a task, commit from the repo root
(`git add -A && git commit`). Keep each commit focused on one logical change, and prefix the subject
with the area when useful (e.g. `frontend:` / `backend:`). End commit messages with the
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

`.env` files are git-ignored (only `.env.example` is tracked) — never commit real secrets.

## Customized Next.js (frontend)

The `frontend/` app runs a **customized Next.js 16** whose APIs/conventions differ from public docs.
Before writing Next.js code, read the relevant guide under
`frontend/node_modules/next/dist/docs/01-app/`.

## Root tooling

- `.mcp.json` registers the **shadcn MCP server**, and the root `package.json` pins the `shadcn`
  CLI — used to browse/add registry components into the apps. There is nothing to build or run at
  this root level.
