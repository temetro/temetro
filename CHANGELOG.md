# Changelog

All notable changes to temetro are recorded here. The format is loosely based on
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/). See [RELEASING.md](./RELEASING.md)
for how releases are cut and published.

## [Unreleased]

## [0.2.5] — 2026-07-01

### Fixed
- **Multi-arch Docker images** — the `release` workflow now builds and publishes
  `khalidxv/temetro-backend` and `khalidxv/temetro-frontend` for both
  `linux/amd64` and `linux/arm64`. Previously the images were amd64-only, so
  `docker compose pull` on Apple Silicon failed with *no matching manifest for
  linux/arm64/v8* and fell back to building from source.

### Changed
- **Language switcher** in Settings → Profile is now a **select** that asks for
  confirmation before switching the interface language, instead of applying the
  change instantly on a button tap.

## [0.2.4] — 2026-06-29

### Added
- **Pagination** on the Activity and Invoices pages (10 per page), matching the
  Patients page, via a shared `ListPagination` component.
- **French (Français)** interface language, with a language switcher in
  Settings → Profile. The choice persists on the device.
- **"Check for updates"** button in Settings → About & updates that forces a
  fresh check.

### Changed
- **Update detection** now reads the latest version from **Docker Hub** image
  tags (the channel clinics actually pull), falling back to the GitHub release
  if Docker Hub is unreachable. This fixes "About & updates" showing *Up to
  date* when a newer image was already published.
- **docker compose** host ports are now configurable (`BACKEND_PORT`,
  `FRONTEND_PORT`, `ADMINER_PORT`, alongside `POSTGRES_PORT`) so a port clash on
  `docker compose up -d` can be resolved from `.env` without editing the file.

## [0.2.3] — 2026-06-29

### Fixed
- **AI chat patient record cards** now render on Google Gemini for name
  lookups. "Show me <name>'s medical record" relied on the model chaining
  `searchPatients` → `getPatient`, but Gemini often called `searchPatients`
  and then emitted only a canned closing line ("Here's the record.") without
  the second tool call — so no card was ever drawn. `searchPatients` now
  displays the record card directly when exactly one patient matches, so the
  flow no longer depends on a follow-up tool call. (The previous Gemini fix in
  0.2.2 only covered the empty-schema list tools.)

## [0.2.2] — 2026-06-28

### Fixed
- **AI chat record cards** now render on Google Gemini. The card-emitting
  chat tools (`listAppointments`, `listTasks`, `listPrescriptions`,
  `getClinicInfo`, `getAnalytics`, `listInventory`) used an empty parameter
  schema; Gemini can't emit a function call for a schema with no properties,
  so it printed the call as `tool_code` text instead of invoking the tool —
  leaving replies as plain text (e.g. "Show today's schedule" leaked a raw
  `<tool_code>` block) with no cards. The tools now share a non-empty schema
  so Gemini calls them; other providers are unaffected.

## [0.2.1] — 2026-06-27

### Fixed
- **Patients pagination** controls now render as proper buttons — the prev/next
  and page-number controls were unstyled and wrapping (the COSS `PaginationLink`
  drops its button styling when given a `render` prop).
- **Patient detail sheet header** reflowed: actions (Download summary / Transfer
  / Edit / Delete) moved to their own wrapping row so the patient name is no
  longer truncated.
- **Messages thread** now shows **sender and recipient avatars** alongside the
  chat bubbles.
- **Release notes** — the `release` workflow now publishes the matching
  `CHANGELOG.md` section as the GitHub Release body (instead of only the
  auto-generated "Full Changelog" link).

## [0.2.0] — 2026-06-27

### Added
- **Patients table pagination.** The Patients list now paginates at 10 rows per
  page (COSS `Pagination`), so large clinics no longer scroll endlessly.
- **Per-patient record history.** The patient detail sheet shows an audit
  timeline of every add/change on that chart. `GET /api/activity/patient/:fileNumber`.
- **Patient summary PDF.** A **Download summary** action on the patient sheet
  produces a clean, printable one-page clinical summary (browser "Save as PDF").
- **AI setup notice.** A single, dismissible heads-up appears above the chat
  input on a fresh chat when no AI provider (API key or local Ollama) is
  configured; it clears itself once you send a message.
- **Version & update awareness.** `GET /api/version` reports the running version
  and checks GitHub Releases for a newer one; Settings → **About & updates** shows
  the current/latest version, and an optional, dismissible banner appears when an
  update is available.
- **LAN access.** The frontend now resolves the backend URL from the host the
  browser is using, so other departments can reach temetro at
  `http://<server-LAN-IP>:3000` with no rebuild. A Settings panel surfaces the
  shareable network address. `GET /api/network` reports detected LAN addresses.
- **Prebuilt Docker images** published to Docker Hub (`khalidxv/temetro-backend`,
  `khalidxv/temetro-frontend`) via a tag-triggered GitHub Actions release workflow.
- **Voice dictation** on the AI chat input (Web Speech API), with graceful
  fallback where the browser doesn't support it.

### Changed
- **Messages thread** rebuilt on the shadcn `Message` / `Bubble` / `Attachment`
  components (COSS colour tokens preserved) for a cleaner conversation surface.
- **Patient status badges** now use semantic colours (active → success,
  inpatient → info) instead of a flat secondary badge.
- `docker-compose.yml` references the published images (with a build fallback) and
  no longer bakes a fixed API URL into the frontend.

### Fixed
- **AI import approval card.** `previewImport` now declares a concrete record
  schema so Google Gemini emits a real tool call (and the approval card renders)
  instead of dumping a `tool_code`/JSON wall as text. The system prompt also
  forbids printing tool calls and re-listing fields.
- **Settings network address** no longer shows a bogus container IP / "Error"
  under Docker — the `/api/network` endpoint now skips container-internal
  interfaces, and the panel falls back to the helpful LAN hint.

## [0.1.0] — 2026-06-26

Initial baseline: clinician AI-chat UI wired to the TypeScript/Express/Postgres
API (Better Auth, multi-tenant clinics, org-scoped patient records), the patient
wallet encrypted-share flow, and Dockerised local run.
