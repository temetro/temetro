# Releasing temetro

temetro is self-hosted: clinics run it with Docker and update by pulling new
images. Each release publishes prebuilt images to Docker Hub and cuts a GitHub
Release; the running app checks that release feed to tell admins an update is
available. This document is the checklist for cutting one.

## Versioning

We follow [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`,
starting at **0.1.0**. The canonical version lives in the root
[`package.json`](./package.json); `backend/package.json` and
`frontend/package.json` track the same number. `GET /api/version` reports it.

## One-time setup

Add these repository secrets (GitHub → Settings → Secrets and variables →
Actions) so the release workflow can publish:

| Secret | What |
| --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub account with push access to the `khalidxv` namespace |
| `DOCKERHUB_TOKEN` | A Docker Hub access token for that account |

Images are published as `khalidxv/temetro-backend` and `khalidxv/temetro-frontend`.

## Cutting a release

1. **Bump the version** in `package.json`, `backend/package.json`, and
   `frontend/package.json` to the new `X.Y.Z`.
2. **Update [`CHANGELOG.md`](./CHANGELOG.md)**: move the `Unreleased` notes under a
   new `## [X.Y.Z] — <date>` heading.
3. **Commit** the bump (`chore(release): vX.Y.Z`).
4. **Tag and push**:
   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```
5. The **`release` workflow** (`.github/workflows/release.yml`) then:
   - builds and pushes both images tagged `X.Y.Z` **and** `latest`, and
   - creates a **GitHub Release** with auto-generated notes.

That GitHub Release is what the in-app update check compares against, so update
notifications light up for everyone on an older version once it's published.

## How clinics update

On the server machine, from the directory holding `docker-compose.yml`:

```bash
docker compose pull && docker compose up -d
```

This pulls the new `latest` images and restarts. Pin a specific version with
`TEMETRO_VERSION=X.Y.Z docker compose up -d`. Updating is optional — the in-app
banner just makes it discoverable.
