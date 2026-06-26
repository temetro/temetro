# Changelog

All notable changes to temetro are recorded here. The format is loosely based on
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/). See [RELEASING.md](./RELEASING.md)
for how releases are cut and published.

## [Unreleased]

### Added
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
- `docker-compose.yml` references the published images (with a build fallback) and
  no longer bakes a fixed API URL into the frontend.

## [0.1.0] — 2026-06-26

Initial baseline: clinician AI-chat UI wired to the TypeScript/Express/Postgres
API (Better Auth, multi-tenant clinics, org-scoped patient records), the patient
wallet encrypted-share flow, and Dockerised local run.
