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

This directory is the project root; the actual apps live in subdirectories.

> **Status:** the **backend is now built**. `backend/` is a TypeScript + Express + Postgres API
> (Drizzle ORM) with authentication and multi-tenant clinics via **Better Auth**, plus an
> **org-scoped patient records API**. The `frontend/` chat is **wired to it**: real auth
> (login/signup/reset/onboarding), route protection, clinic switching, and patient data fetched
> over the API — the old in-memory fixture is gone (`lib/patients.ts` now calls the backend).
>
> **Still vision, not built:** the patient companion app and the blockchain-style **signing /
> patient-owned storage / approval** flow. The AI chat itself is still **mock replies** (no LLM
> call yet — a `/chat` endpoint is the next planned step). Email verification is wired but
> currently **not enforced** at sign-in (see `backend/CLAUDE.md`).

## Layout

- **`frontend/`** — the Next.js product app (the AI chat UI). This is where almost all current work
  happens. **It has its own `CLAUDE.md`** — read `frontend/CLAUDE.md` for the stack, commands,
  architecture, and gotchas. It is also its own git repository.
- **`landing-page/`** — the marketing landing page. A standalone copy of `frontend/` (same
  customized Next.js stack) with the landing sections in `components/landing/`.
- **`backend/`** — the TypeScript + Express + Postgres API (Drizzle ORM + Better Auth). Built and
  Dockerised. **Has its own `CLAUDE.md`** (and `README.md`) — read it for the auth/schema workflow
  and gotchas. Its own git repository.
- **`database/`, `docs/`** — still empty placeholders.
- **`landing-page/`** — see above; unchanged, still UI-only marketing.

`frontend/`, `landing-page/`, and `backend/` are **independent** apps, each with its own
`package.json`/`node_modules`. Run `npm` commands from inside the relevant app directory, not from
this root.

## Running the stack

From `backend/`: `cp .env.example .env` (set `BETTER_AUTH_SECRET`; set `POSTGRES_PORT` if 5432 is
already in use), then `docker compose up` → frontend :3000, backend :4000, Postgres. See
`backend/README.md`. For local dev without Docker, run `npm run dev` in `backend/` and `frontend/`
separately (the frontend reads `NEXT_PUBLIC_API_URL`, default `http://localhost:4000`).

## Version control (per-folder git)

Each top-level folder is its **own git repository** (`frontend/`, `landing-page/`, `backend/`,
`database/`, `docs/`); there is intentionally **no git repo at this root**.

**Commit after every change.** Whenever you modify files in a folder that contains a `.git`, finish
the task by committing those changes *in that folder*
(`git -C <folder> add -A && git -C <folder> commit`), so each folder's history tracks its own
changes. Keep each commit scoped to one folder — a change spanning two folders is two commits. End
commit messages with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

## Customized Next.js (applies to both apps)

Both apps run a **customized Next.js 16** whose APIs/conventions differ from public docs. Before
writing Next.js code, read the relevant guide under `<app>/node_modules/next/dist/docs/01-app/`.

## Root tooling

- `.mcp.json` registers the **shadcn MCP server**, and the root `package.json` pins the `shadcn`
  CLI — used to browse/add registry components into the apps. There is nothing to build or run at
  this root level.
