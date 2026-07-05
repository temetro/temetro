# Changelog

All notable changes to temetro are recorded here. The format is loosely based on
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/). See [RELEASING.md](./RELEASING.md)
for how releases are cut and published.

## [Unreleased]

## [0.7.0] — 2026-07-05

### Added
- **Temetro Network** — a standalone, high-performance **relay** (Rust + Axum + socketioxide) that
  connects the backend to patient wallet apps, in its own repo
  ([github.com/temetro/temetro-network](https://github.com/temetro/temetro-network)) and deployable
  on Railway. It replaces the flaky Cloudflare quick-tunnel that used to expose the backend's
  embedded `/wallet` Socket.io namespace to phones. The relay is a **dumb, stateless pipe**: a
  `/wallet` namespace for devices (challenge/Ed25519-signature auth, room keyed by wallet number)
  and a `RELAY_TOKEN`-authenticated `/hub` namespace for the backend. It forwards sealed ciphertext
  verbatim, keeps no database, and its only crypto is verifying a device's auth signature (proven
  byte-for-byte compatible with `wallet-crypto.ts`).

### Changed
- **The backend is now a client of the relay, not the wallet server.** The `/wallet` Socket.io
  namespace was removed from `src/realtime.ts`; a new `src/services/relay-client.ts` connects to the
  relay's `/hub` (`emitToWallet` delegates to its `sendToWallet`), handles device responses
  (`wallet:share-response` / `wallet:update-response` / `wallet:revoke`) and flushes missed updates on
  `wallet:online` — calling the same `wallet-share` / `wallet-updates` services as before. New
  `RELAY_URL` + `RELAY_TOKEN` env vars; the wallet-import QR now points at `RELAY_URL`.

## [0.6.0] — 2026-07-04

### Added
- **Read-only FHIR R4 server** — temetro can now be a FHIR **server**, not just a client.
  A new endpoint tree at **`/fhir`** (mounted outside `/api`, bearer-only) exposes each
  clinic's records as FHIR R4: **Patient**, **Observation** (labs + synthesized vital signs),
  **AllergyIntolerance**, **Condition**, **MedicationRequest**, **Encounter** and
  **Appointment**, plus an unauthenticated **`GET /fhir/metadata`** CapabilityStatement.
  Searches return searchset `Bundle`s with `_count`/`_offset` pagination and self/next/prev
  links. Because temetro stores free-text clinical values, every `CodeableConcept` is
  **text-only** (no SNOMED/LOINC) and patients carry an **age** extension rather than a
  `birthDate` — documented in the CapabilityStatement and API docs.
- **Per-clinic FHIR API keys** — machine-to-machine auth via `Authorization: Bearer tmf_…`.
  Keys are created/revoked under **Settings → Integrations → FHIR server** (owner/admin),
  **SHA-256-hashed** at rest, and shown **once** at creation. Every FHIR request is
  org-scoped (no cross-clinic reads) and written to the activity log with the key name and
  result count. New `fhir_api_keys` table, `middleware/fhir-auth.ts`, the
  `services/fhir-server/` mapping module (queries, resources, bundle, capability, keys), the
  `/fhir` router, and `GET/POST/DELETE /api/integrations/fhir-server/keys`. New `fhirServer`
  locale namespace across all five languages.

## [0.5.0] — 2026-07-03

### Added
- **Clinic → wallet record-update push** — a clinician can push an updated record to a
  **wallet-linked** patient (a permanent, approved share). The record snapshot is **signed**
  with the clinic's Ed25519 key and **sealed** to the wallet's X25519 key (derived from its
  Ed25519 wallet number via the birational map — verified byte-for-byte against the wallet's
  own derivation), stored `pending`, and delivered over the `/wallet` relay live **and** on
  the wallet's next authenticated connect (so an offline phone catches up). The patient
  reviews it in a **pending-updates inbox** and approves/denies; the wallet signs its
  decision, the backend verifies it, and the on-device record is replaced only on approval.
  The wallet **pins** the clinic key (TOFU) and warns on a key change. New
  `POST /api/patients/wallet/push`, `GET /api/patients/wallet/{link/:fileNumber,updates,updates/:id}`,
  `walletRecordUpdates` table + service, `wallet:update-request` / `wallet:update-response`
  relay events, a "Push to wallet" dialog with live status, and a "Sent updates" list under
  Settings → Signing. New `walletPush` / `walletUpdatesList` locale namespaces across all five
  languages. (The wallet app half ships in the sibling `temetro-app` repo.)

## [0.4.0] — 2026-07-03

### Added
- **Ambient AI visit scribe** — a **Record visit** action on the patient sheet turns a
  clinician↔patient conversation into a draft **SOAP** encounter note. Record with the
  microphone (`MediaRecorder`, stored as an auditable patient attachment) or paste a
  transcript; the backend transcribes via the user's **OpenAI (Whisper)** or **Gemini**
  key, de-identifies the transcript + patient context through **Veil**, and the model
  drafts a structured note that the clinician **reviews and edits before saving** — the
  same write-approval gate as the chat agent. New `POST /api/scribe/{transcribe,draft,save}`
  (`backend/src/routes/scribe.ts`, `services/ai/transcribe.ts`), a `veil.redactText()`
  free-text redactor, and an `appendEncounter` service that adds one note without touching
  the rest of the record. Gated by `patient:write` + the clinic AI policy (reception and
  disabled-AI accounts don't see it). New `scribe` locale namespace across all five
  languages. Drafting also works with local Ollama from a pasted transcript.

## [0.3.0] — 2026-07-02

### Added
- **Three new interface languages** — Somali (`so`), Arabic (`ar`) and German
  (`de`) join English and French, selectable in Settings → Profile → Language.
  Each locale carries a full translation of the ~1,660 UI strings, with native
  names shown in the selector (Soomaali, العربية, Deutsch).
- **Right-to-left (RTL) support** — selecting Arabic sets `dir="rtl"` on the
  document (applied before first paint via an inline script, so no flash), flips
  physical spacing/alignment to logical CSS utilities, mirrors directional icons,
  and loads an Arabic-capable typeface (IBM Plex Sans Arabic) appended to the
  font stack for per-character fallback.
- **Language roams across devices** — the chosen language is persisted to the
  per-user `user_settings` preferences and re-applied on sign-in, with
  localStorage remaining the offline source of truth.
- **`frontend/scripts/check-locales.mjs`** (+ `npm run check-locales`) — a parity
  check that fails on missing/extra keys or `{{placeholder}}` mismatches across
  locales and warns when Arabic count-keys lack the full CLDR plural forms.

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
