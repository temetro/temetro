# Contributing to temetro

Thanks for your interest in contributing! temetro is an open-source clinical tool — contributions that improve reliability, usability, and data privacy are especially welcome.

## Getting started

1. Fork the repository and create a branch from `main`.
2. Follow the setup steps in the root `README.md` to get the stack running locally.
3. Make your changes, test them, and open a pull request.

## Project structure

This is a monorepo. Read the relevant `CLAUDE.md` before working in each area:

- `frontend/` — Next.js chat UI (`frontend/CLAUDE.md`)
- `backend/` — Express + Postgres API (`backend/CLAUDE.md`)

Run `npm` commands from inside the relevant subdirectory, not the root.

## Development workflow

- **Branch naming:** `feat/...`, `fix/...`, `chore/...`, `docs/...`
- **Commits:** one logical change per commit; prefix with `frontend:` or `backend:` when scoped
- **PR size:** keep PRs focused — a feature and its tests, not a feature + unrelated cleanup

## Code style

- TypeScript throughout; no `any` without a comment explaining why
- No dead code, no commented-out blocks
- Comments only when the *why* is non-obvious

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include steps to reproduce and your environment.

## Security issues

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
