# Changelog

All notable changes to temetro are recorded here. The format is loosely based on
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/). See [RELEASING.md](./RELEASING.md)
for how releases are cut and published.

## [Unreleased]

## [0.17.0] — 2026-07-19

### Changed
- **Pharmacy Add-item now uses a hardware barcode scanner.** The inventory Add-item dialog is
  built for a USB barcode scanner connected to the computer (a keyboard wedge): scanning a
  medication types the code as a fast keystroke burst ending in Enter, which is parsed and
  auto-fills the Barcode/NDC, expiry (AI 17), and lot (AI 10) fields — no need to focus any input
  first. The barcode field also parses on Enter for manual entry. This replaces the camera scanner
  in this dialog (the camera scanner stays for importing a patient's wallet code)
  (`frontend/components/pharmacy/add-inventory-dialog.tsx`).
- **Care team settings use Separated Panels.** The Care team section now renders as distinct
  bordered panels on a muted tray, matching the Preferences and AI settings frames
  (`frontend/components/settings/settings-care-team.tsx`).

### Fixed
- **Pointer cursor on Activity rows.** Hovering an entry in the Activity feed now shows the pointer
  cursor (`frontend/components/activity/activity-view.tsx`).

## [0.16.0] — 2026-07-18

### Added
- **Show / Add tabs on the patient record dialog.** Editing a record now opens on a read-only
  "Show" view (the existing `PatientDetail`), with an "Add" tab for the editable form and its Add
  buttons. Saving from the Add tab still offers the existing "send to the patient's wallet" step
  when the patient is wallet-linked (`frontend/components/chat/patient-form-dialog.tsx`).
- **Barcode scanning in the pharmacy.** The inventory Add-item dialog can now scan a medication
  barcode with the camera (`@zxing/browser`, native `BarcodeDetector` where available) into a new
  Barcode/NDC field, auto-filling expiry (AI 17) and lot (AI 10) from a GS1 DataMatrix. Adds a
  nullable `inventory.barcode` column (migration `0036`).
- **Scan a patient's wallet code when importing.** "Import from a patient app" gains a Scan button
  that reads the QR or 2D barcode shown in the patient's wallet app and fills the wallet number
  (`frontend/components/patients/import-from-wallet-dialog.tsx`).

### Changed
- **Settings "separated panels" now match COSS exactly.** The opt-in `separated` settings frames
  render a real COSS Frame — a muted tray holding distinct bordered panels spaced apart — instead
  of a `gap-4` bolted onto the panel-fusing `CardFrame`. New `frontend/components/ui/frame.tsx`.

## [0.15.1] — 2026-07-17

### Fixed
- **Settings frames with more than one panel now breathe.** When a settings section stacked
  several cards — the AI availability toggles and the patient/account notification lists — the
  panels sat flush against each other with no gap, reading as one joined block. Those frames now
  use the COSS "separated panels" spacing (a 1rem gap that keeps each card's rounded corners),
  while intentional joined lists (care team, records) stay flush. Opt-in via a new `separated`
  prop on `SettingsFrame`/`SettingsSection` (`frontend/components/settings/settings-parts.tsx`).

## [0.15.0] — 2026-07-15

### Fixed
- **Prescriptions pushed to a wallet now actually arrive.** `createPrescription` writes to the
  `prescriptions` table, but the sealed bundle only carried `patient.medications`, which comes from
  the separate `patient_medications` table and never grows when a prescription is written. The
  patient approved a bundle identical to what they already had, so nothing appeared in the app's
  Prescriptions section — the "New prescription: X" line in `changes` is display text, not data.
  The bundle now ships `prescriptions` alongside the appointments and invoices that were already
  handled this way, keeping prescriber/status/dates (`backend/src/services/wallet-updates.ts`).
- **No more bogus "this clinic's key changed" warnings.** Update events now carry a stable
  `clinicId`. Wallets pinned a clinic's signing key against its display *name*, which is mutable
  and falls back to the literal "A clinic" for unnamed orgs — so two unnamed clinics collided on
  one pin and the second always warned.
- **Silent drops on the wallet-push path are now logged.** `sendToWallet` no-ops when an org has no
  live relay hub, and `applyUpdateResponse` returned `null` without a word when a response arrived
  unsigned or already resolved. From the clinic side both looked exactly like a patient who never
  tapped Approve.
- **Windows checkouts no longer break the backend image.** The repo had no `.gitattributes`, so Git
  for Windows' default `core.autocrlf=true` rewrote `docker-entrypoint.sh` to CRLF; the container
  then died with `exec /usr/local/bin/docker-entrypoint.sh: no such file or directory`. Line
  endings are pinned, and the image strips CR before `chmod` so existing checkouts are fixed too.
- **Settings frames use the COSS default padding.** `CardFramePanel` (added in 0.14.0) isn't part of
  the COSS registry: its `p-5` inset content twice over, and wrapping the body made every card a
  grandchild of `CardFrame`, so the frame's direct-child selectors never applied and each card drew
  its own border — a box inside a box. Body padding now sits on the card, where COSS puts it.
- **99 lint errors cleared.** `npm run lint` had been failing (the build hides it via
  `eslint.ignoreDuringBuilds`). Vendored `components/charts` and `components/ai-elements` are now
  ignored; the 31 in our own code are fixed. Two were real bugs: the employee dialog could keep a
  typed password when switching to another member, and the wallet-sync hook could carry a patient's
  `linked` state to a newly-selected patient, briefly offering to push a record to someone else's
  wallet.

### Changed
- The clinic→wallet update event carries `clinicId`, and the sealed bundle carries `prescriptions`.
  Both are additive; older wallets ignore them. See the
  [signing API docs](https://docs.temetro.com/docs/api/signing#clinic--wallet-record-updates).

## [0.14.2] — 2026-07-15

### Fixed
- **Docker images build on ARM64 again.** Next 16's default Turbopack production build has no native
  bindings for `linux/arm64` in the Alpine image, so `docker compose up --build` failed with
  "Turbopack is not supported on this platform". The frontend now builds with Webpack
  (`next build --webpack`), which builds on every architecture (`frontend/package.json`).

## [0.14.1] — 2026-07-15

### Fixed
- **"Send to wallet" now works from every dialog, not just the patient sheet.** The wallet step in
  the appointment, invoice, prescription, patient-edit, and scribe dialogs was gated on a wallet-link
  check that resolved asynchronously; if the clinician saved before it resolved (or it briefly
  failed), the dialog silently closed without pushing. The dialogs now await the link check before
  deciding, and an empty change summary can no longer be sent
  (`frontend/components/wallet/use-wallet-sync.ts`, `wallet-sync-step.tsx`).

### Changed
- **Settings sections composed from `CardFrame` primitives.** Each settings section now builds on
  `CardFrameHeader`/`CardFrameTitle`/`CardFrameDescription` + a new `CardFramePanel` body, and the
  per-row `SettingsCard` renders a real `Card`, giving a consistent framed surface
  (`frontend/components/ui/card.tsx`, `frontend/components/settings/settings-parts.tsx`).

## [0.14.0] — 2026-07-13

### Changed
- **Patients page filter moved to its own row.** The status filter left the toolbar and now sits on a
  dedicated **"Filter"** row directly above the table, so the header stays a clean title + search +
  "Add patient" + `⋯` cluster (`frontend/components/patients/patients-view.tsx`).
- **Patient detail sheet header.** The patient name, status badge, and the `⋯` menu now share one
  left-aligned row, and the standalone **Edit** button moved to be the first item inside the `⋯` menu
  (`frontend/components/patients/patient-detail.tsx`).
- **Settings redesigned with the COSS frame surface.** Every settings section now renders in a
  `CardFrame` (header + body) via a new `SettingsFrame` part, replacing the flat `SettingsCard` divs
  (`frontend/components/settings/settings-parts.tsx`, `settings-ai.tsx`).

### Added
- **AI Mode: Automatic and Off.** Settings → AI gains two modes beyond API / Local: **Automatic**
  (use a cloud API key when set, else fall back to local Ollama) and **Off** (assistant disabled).
  Automatic is the new default, so a fresh install shows the setup banner until a provider is wired
  (`frontend/lib/ai-settings.ts`, `backend/src/services/ai/{config,provider}.ts`, `types/ai.ts`).

### Fixed
- **AI setup banner now appears when no provider is configured.** Previously the defaulted Ollama URL
  counted as "configured," so the "connect an AI model" banner never showed; it now reflects the
  actual mode (`frontend/components/chat/ai-setup-notice.tsx`).
- **Chat cards no longer silently vanish.** An unrecognized/renamed streamed data part now renders a
  small placeholder instead of nothing (`frontend/components/chat/chat-panel.tsx`).

### Wallet app
- **Documents/files reach the wallet.** Clinic record-update pushes now include attachment metadata,
  which the wallet folds into the record so the **Documents** tile counts them and the Documents
  screen lists them (`backend/src/services/wallet-updates.ts`, `temetro-app` types + home/documents).
- **Failed pushes are no longer swallowed.** A record update that fails signature verification or
  decoding is now logged (and a "couldn't verify" notice is raised) instead of disappearing silently.
- **i18next translation.** The wallet app now uses `i18next` + `react-i18next` + `expo-localization`
  (English shipped; other locales can be added later), with the home, record-update inbox, navigation
  titles, and the visits/prescriptions-adjacent detail screens extracted to translation keys.

## [0.13.1] — 2026-07-13

### Changed
- **New Invoice checkboxes.** The Back-date / Due-date toggles now use the COSS `Checkbox`
  (`frontend/components/ui/checkbox.tsx`) instead of raw, misshapen native checkboxes.
- **Patients page toolbar & table.** The list is now a COSS **Table in a `CardFrame`**
  (`frontend/components/ui/table.tsx`), and the secondary "Import from a patient app" action moved
  into a `⋯` overflow menu so the toolbar keeps a single primary "Add patient" CTA.
- **Patient detail sheet header.** The five action buttons plus delete collapse into a primary
  **Edit** button and a `⋯ More` menu (Download summary, Record visit, Transfer, Push to wallet, and
  a destructive Delete).

### Wallet app
- **Home quick actions open sheets.** "Share record" now opens a bottom sheet with a scannable **QR**
  of the wallet number (`react-native-qrcode-svg`); "My wallet" opens a bottom sheet with copyable
  wallet number / fingerprint / algorithm; and the duplicate "Notifications" action (the header
  already has a bell) is replaced with **Scan**.

## [0.13.0] — 2026-07-12

### Added
- **Prescription date pickers.** The New Prescription dialog's Start/End date now use a proper COSS
  date picker (`frontend/components/ui/date-picker.tsx`, Popover + Calendar) instead of the raw
  native date input.
- **Working profile fields.** Settings → Profile **Specialty** (a Select) and **Professional links**
  (editable rows) are now wired to persisted preferences — previously they were inert stubs.
- **Patient filters.** The Patients page gains a status filter (all / active / inpatient /
  discharged) and its search now also matches conditions and allergies.
- **Language quick-switch.** A language submenu in the sidebar user menu (alongside Theme), applied
  immediately with Arabic RTL.
- **Wallet app — home & settings.** The patient app home screen adds a quick-action row (Share
  record / My wallet / Notifications) and a recent-activity feed; the settings screen adds an About
  section (version, docs, blog) and a privacy footer.

### Changed
- **Record history renders in full.** The patient sheet's Record history replaces the fragile
  timeline-separator layout with a continuous-rail list, so every audited change shows completely
  (and mirrors correctly under RTL).
- **Update banner + AI setup notice.** The "update available" banner now uses the COSS warning Alert
  and stays bottom-right under Arabic; the "connect an AI provider" notice is a clearer, thinner bar
  shown above the chat input in active conversations too.
- **Wallet app — bottom sheets.** Polished the shared sheet building blocks (spacing, radii, close
  and action affordances).

### Fixed
- **Blog reachable.** `blog.temetro.com` was returning 502 due to a custom-domain target-port
  mismatch (Ghost listens on 2368); documented and corrected.
- **Docs freshness.** Corrected stale `CLAUDE.md` claims (the AI chat is real and `@ai-sdk/react` is
  installed; the signing/approval flow is built) and reduced the vendored `ai-elements` Base UI
  type-drift errors.

## [0.12.1] — 2026-07-10

### Changed
- **Centered wallet-sync stepper.** The in-dialog "Sync to wallet" stepper (`DialogStepper` in
  `frontend/components/wallet/wallet-sync-step.tsx`) now uses a proper Stepper primitive
  (`components/ui/stepper.tsx`), so the numbered indicators sit centered inline with their labels
  instead of the previous left-aligned look.
- **Record history is now a timeline.** The patient sheet's **Record history** section
  (`RecordHistory` in `frontend/components/patients/patient-detail.tsx`) renders as a vertical
  timeline (`components/ui/timeline.tsx`) — who made the change, an entity-type icon, what happened,
  and when — replacing the flat avatar list.

### Performance
- **Landing page: defer the 3D globe.** The Temetro Network globe (three.js) on the marketing site
  now mounts only when its section scrolls near the viewport (IntersectionObserver), instead of on
  hydration — removing ~730 KB of JS and its main-thread execution from initial page load. (Landing
  page lives in the sibling `temetro/landing-page` repo.)

## [0.12.0] — 2026-07-09

### Added
- **In-dialog "Sync to wallet" stepper.** When a clinician adds or edits a record for a
  wallet-linked patient — invoice, appointment, prescription, patient demographics, or an AI
  scribe note — the create/edit dialog shows a two-step stepper: after saving, step 2 offers to
  push the change to the patient's wallet (reusing `pushWalletUpdate` + approval polling). Shared
  `useWalletSync` hook and `DialogStepper` / `WalletSyncStep` components under `components/wallet/`.
  Patients without a linked wallet see the old close-on-save behaviour.

### Changed
- **Appointment & invoice date pickers block past dates.** The new-appointment date picker disables
  days before today; the invoice issue-date picker does too, with an opt-in **Back-date** checkbox
  for recording genuinely older invoices (edit mode keeps existing past dates).
- **Patient Portal wallet link is identified by wallet number only.** The portal `link` action no
  longer asks the wallet app for a name + file number — it resolves the file the clinic already
  paired the wallet number to (`services/portal.ts#linkWallet`), returning a friendly 404 when the
  wallet isn't paired yet.

### Removed
- **Stale Settings "Features" section.** Dropped the inert "patient-owned storage" / "require signed
  records" toggles (and their unused i18n keys) that did nothing.

## [0.11.0] — 2026-07-09

### Added
- **Patient Portal over the Temetro Network relay + wallet linking.** The wallet app now reaches a
  clinic's Patient Portal through the relay instead of a direct HTTP API, so it works from a real
  phone. New `services/portal.ts` (clinic info, doctors, availability, wallet linking, conflict-aware
  booking, results, downloadable lab files) runs behind a `portal:request` hub handler
  (`backend/src/services/relay-client.ts`). A new nullable `patients.wallet_number` column stores the
  link, and `walletNumberForPatient` resolves through it so clinic→wallet pushes work after a portal
  link (not only after a permanent share). `GET /api/portal/:clinic/link` returns the relay-based
  pairing descriptor (clinic signing key + relay URL).
- **Portal "Link my wallet" option.** The Patient Portal kiosk adds a third card that shows a QR the
  wallet app scans to link over the relay (`components/portal/portal-kiosk.tsx`).
- **Appointments & invoices reach the wallet.** Clinic→wallet pushes now include the patient's
  appointments and invoices in the sealed bundle, so they show up in the wallet app.
- **Clinic location reverse-geocoding.** "Use my current location" now fills address / city /
  country (OpenStreetMap Nominatim), not just latitude / longitude (`lib/geocode.ts`).

### Fixed
- **Patient Portal QR was unreachable from a phone.** Settings → Signing now encodes a
  `temetro-portal:` pairing URI (relay URL + clinic signing key) instead of a `localhost` API URL, so
  the wallet app can actually connect (`components/settings/settings-portal.tsx`).
- **Arabic (RTL) sidebar.** The collapse arrow and notification bell now stack **above** the nav
  icons instead of being pinned to the opposite edge; the toggle glyph mirrors and the notifications
  popover opens toward the content side (`components/sidebar-02/app-sidebar.tsx`,
  `components/ui/sidebar.tsx`, `components/sidebar-02/nav-notifications.tsx`).

## [0.10.0] — 2026-07-07

### Added
- **Patient Portal doctor picker & availability.** The portal now lists the clinic's doctors and
  books against a chosen provider, showing only free slots. New public endpoints
  `GET /api/portal/:clinic/doctors` and `GET /api/portal/:clinic/availability?provider=&date=`
  (display-safe fields only), and `POST /api/portal/:clinic/appointments` accepts an optional
  `provider` (`backend/src/routes/portal.ts`). The existing 409 conflict check stays authoritative.
- **Patient Portal links in Settings.** Settings → Signing → Patient Portal adds **open**, **copy
  link**, and **QR code** actions (`components/settings/settings-portal.tsx`); the QR carries the
  backend base (`?api=`) so the patient wallet app can book natively when it scans it.
- **Clinic location "Use my current location".** The location editor fills map coordinates from the
  browser's geolocation (`components/settings/settings-location.tsx`).
- **Wallet app native Patient Portal.** Scanning a clinic's portal QR opens a native booking screen
  (doctor list → free-slot picker → confirm) in the patient wallet app.

### Fixed
- **Arabic (RTL) layout.** The sidebar now anchors to the **right** for RTL locales and the toggle
  switch mirrors correctly, instead of leaving the shell misaligned
  (`components/sidebar-02/app-sidebar.tsx`, `components/ui/switch.tsx`).
- **Wallet app:** record-card **bottom sheet no longer freezes** the app (dropped the per-frame
  animated blur overlay for HeroUI's built-in overlay); **Reset wallet** now confirms in a native
  HeroUI dialog with Liquid Glass actions; fixed the **white edge flash** on screen transitions in
  dark mode; the home/onboarding/register **logo** is now the Temetro mark.

### Changed
- New i18n keys (`settings.portal.*`, geolocation strings) are translated into **all** shipped
  locales (en, de, fr, ar, so).

## [0.9.0] — 2026-07-06

### Added
- **Patient blood type & phone number.** The patient record now carries a `bloodType` (e.g. `O+`)
  and a `phone` number. Both are shown in the record sheet and chat summary card and are editable in
  the add/edit patient form. `phone` is a demographic/contact field (visible to and editable by the
  **reception** role); `bloodType` is treated as clinical PHI and is **redacted for reception** (like
  allergies/vitals). New columns `patients.phone` / `patients.blood_type` (migration `0033`).
- **Clinic location setting.** A new org-scoped `clinic_settings` table (migration `0034`) stores the
  clinic's address (address / city / country) plus optional map coordinates (latitude / longitude),
  set in **Settings → Signing → Clinic location** (owner/admin only). New endpoints
  `GET /api/clinic/settings` (any clinician) and `PUT /api/clinic/location` (owner/admin). This will
  be surfaced in the patient wallet app to show a clinic's location.

### Changed
- New i18n keys for the above are translated into **all** shipped locales (en, de, fr, ar, so), per
  the coverage rule now documented in `frontend/CLAUDE.md`.

## [0.8.2] — 2026-07-05

### Fixed
- **`RELAY_URL` now defaults to the hosted relay** (`https://network.temetro.com`) instead of
  `http://localhost:8080`. The old default silently failed for anyone who joined the network without
  explicitly setting `RELAY_URL` — the backend's hub connection could never reach the relay (inside
  Docker `localhost` is the container itself), so it never authenticated and QR pairing generated a
  QR pointing at an unreachable `localhost`. Self-hosters running their own relay still override
  `RELAY_URL`. Updated `.env.example` accordingly.

### Changed
- Generating a pairing QR (`POST /api/patients/wallet/pair`) now ensures the clinic's relay hub is
  connected before pre-registering the request, so the routing is set up even if the connection was
  opened lazily.

### Fixed
- **QR "scan to connect" pairing** was broken by the multi-clinic relay routing (v0.8.0): pairing
  has no wallet number, so the clinic never sent a `wallet:send` to register the request, and the
  relay rejected the scanning device's response as "unknown or expired". The clinic now
  **pre-registers** the pairing request with the relay (a new `hub:expect { requestId }` event on
  `POST /api/patients/wallet/pair`), so the device's response routes back correctly. On hub
  (re)connect the backend re-registers its still-pending requests, so routing also survives a relay
  restart. `POST /pair` now also requires the clinic to have joined the network (clear 409 instead of
  a dead QR), surfaced in the import dialog.

### Added
- **Multi-clinic Temetro Network.** The relay now serves many self-hosted clinics at once. Each
  clinic authenticates to the `/hub` namespace by **signing a challenge with its own Ed25519 clinic
  signing key** (`services/signing.ts`) — a per-clinic identity, not a shared password — and the
  relay routes every device response back to only the clinic that originated the request (keyed by
  `requestId`), so clinics never see each other's traffic. `wallet:online` is fanned out only to
  clinics with pending work for that wallet.
- **"Join Temetro Network" opt-in.** A per-clinic toggle in **Settings → Signing** (backed by
  `clinic_signing_keys.network_enabled`, `GET`/`PUT /api/signing/network`, owner/admin only). Off by
  default; enabling opens the clinic's relay connection, disabling tears it down. Wallet
  import/push endpoints return **409** while a clinic hasn't joined. Localised in all five languages.

### Changed
- **The backend keeps one authenticated relay connection per network-enabled org**
  (`services/relay-client.ts` — `connectOrg`/`disconnectOrg`, a `hubs` map keyed by `orgId`), instead
  of a single shared-token connection. `emitToWallet`/`sendToWallet` now take an `orgId`, and the
  offline-flush (`pendingUpdatesForWallet`) is org-scoped.
- **`RELAY_TOKEN` is now optional/legacy.** Clinics authenticate with their signing key, so an open
  relay needs no shared secret; `RELAY_TOKEN` only gates an optional *private* relay.

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
