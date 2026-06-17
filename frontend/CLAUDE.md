# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The import above is load-bearing: this is a **customized Next.js 16** with breaking changes vs.
> public docs. Before writing any Next.js code (routing, metadata, `next/image`, `next/font`,
> route handlers, config), read the relevant guide under `node_modules/next/dist/docs/01-app/`.

## What this is

`temetro` — an **open-source** clinical "AI middleman" (see the project vision in the root
`../CLAUDE.md`). This app is the clinician-facing chat UI. It is now **wired to the real
`../backend/`** for authentication and patient data (no longer a standalone UI-only demo); the AI
chat replies are **still mocked** (no LLM call yet).

- The chat parses `/patient <file#>` (or a bare `/<file#>`) in `components/chat/chat-panel.tsx` and
  renders the record as a horizontal row of cards (`components/chat/patient-cards.tsx`), with small
  dependency-free trend sparklines (`components/chat/sparkline.tsx`). Each card opens a detail
  dialog; the Summary card has an **Edit record** button.
- Patients can be **created and edited** via the shared `components/chat/patient-form-dialog.tsx`
  (mode `create` | `edit`). The "Add patient" pill in `chat-input.tsx` opens it.
- Non-command messages still get a mock assistant reply.

### Auth & data (talks to `../backend`)

- **`lib/patients.ts`** keeps the canonical `Patient` types but its data functions (`getPatient`,
  `listPatients`, `createPatient`, `updatePatient`) now call the backend via **`lib/api-client.ts`**
  (`fetch` with `credentials: "include"`; 401 → `/login`). The old in-memory fixture is gone.
- **`lib/auth-client.ts`** — Better Auth React client (`useSession`, `signIn/up/out`,
  `organization.*`, `useActiveOrganization`, `useListOrganizations`). Base URL from
  `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`); it appends `/api/auth`. **`lib/access.ts`**
  mirrors the backend's RBAC roles for the org client.
- **`app/(auth)/`** — designed auth pages (login, signup, verify-email, forgot/reset-password,
  onboarding = create clinic, accept-invite), in their own chrome-less layout.
- **Route protection:** this Next renames `middleware` → **`proxy.ts`** (root) — an optimistic
  redirect to `/login` when no session cookie. The authoritative gate is client-side:
  `components/auth/app-auth-guard.tsx` (wrapping `app/(app)/layout.tsx`) requires a session **and**
  an active clinic, else redirects to `/login` / `/onboarding`.
- **Clinics (organizations):** `components/sidebar-02/team-switcher.tsx` is now the `OrgSwitcher`;
  `components/settings/settings-care-team.tsx` manages members + invitations.
- `.env.local` / `.env.example` hold `NEXT_PUBLIC_API_URL`.

The signing / patient-owned-storage / approval features from the root vision are **still not built**.

## Commands

```bash
npm run dev      # Next dev server (Turbopack) on http://localhost:3000
npm run build    # production build (runs a full TypeScript typecheck — see caveat below)
npm run start    # serve the production build
npm run lint     # eslint (eslint-config-next: core-web-vitals + typescript)
```

There is **no test runner** configured (no `test` script, no vitest/jest/playwright). Don't invent
test commands; verify changes by running the dev server.

**Version control:** this folder is its own git repo. Commit after every change
(`git -C . add -A && git commit`), with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
trailer. See the root `../CLAUDE.md` for the project-wide per-folder commit policy.

## Architecture

- **Stack:** Next.js 16.2.6 (App Router) · React 19 · TypeScript · Tailwind CSS **v4**. Path alias
  `@/*` → repo root (`tsconfig.json`). `cn()` (clsx + tailwind-merge) lives in `lib/utils.ts`.
- **`app/`** — App Router. `app/(app)/page.tsx` is the product chat page (sidebar + chat panel);
  `app/layout.tsx` loads the fonts and wraps children in `ThemeProvider` (next-themes) +
  `I18nProvider` (see Theming and i18n below).
- **`components/ui/`** — **COSS components** (built on **Base UI `@base-ui/react`, not Radix**),
  installed via the shadcn CLI from the `@coss/*` registry. APIs follow Base UI: composition uses
  the `render` prop and `useRender`/`mergeProps`, **not `asChild`**, and popups use canonical COSS
  names (`DialogPopup`/`DialogPanel`, `MenuPopup`, `SelectPopup`, `TooltipPopup`, `PreviewCard`,
  `Group`) — COSS also ships back-compat aliases (`DialogContent`, `CardContent`, `SelectContent`,
  `TooltipContent`, …). Add/update primitives with `npx shadcn@latest add @coss/<name>`.
  `carousel.tsx` is the one **non-COSS** primitive kept (no COSS equivalent). Config in
  `components.json` (baseColor `neutral`).
- **`components/ai-elements/`** — a large AI-chat primitive library (`PromptInput`, `Conversation`,
  `Message`, `Suggestion`, etc.) typed against **AI SDK v6** (`ai` package: `UIMessage`,
  `ChatStatus`, `FileUIPart`). Note: `@ai-sdk/react` (`useChat`) is **not installed** — chat state
  is managed with local React state.
- **`components/sidebar-02/`** — the dashboard sidebar (`SidebarProvider` / `Sidebar` /
  `SidebarInset` from `components/ui/sidebar.tsx`). `app-sidebar.tsx` holds the nav config (New chat
  · Patients · Settings) + notifications; `team-switcher.tsx` is the `OrgSwitcher` (clinic switch).
- **`components/chat/`** — the product chat UI. `chat-panel.tsx` owns message state + empty/active
  layouts; `chat-input.tsx` is a bespoke (non–ai-elements) input matching a specific design.

## Theming

Tailwind v4 with `@theme inline` in `app/globals.css`, using **COSS's default neutral tokens**
(`@coss/colors-neutral`; values reference Tailwind palette vars like `--color-neutral-*` plus
`--alpha()`/`color-mix()`). Both **light (`:root`) and dark (`.dark`)** palettes are defined;
`next-themes` (`components/theme-provider.tsx`) toggles them with **`defaultTheme="dark"`** +
`enableSystem`, so the app still defaults to dark. The **theme toggle** is the _Theme_ item in the
sidebar-footer user menu (`components/sidebar-02/nav-user.tsx`, via `useTheme()`). Fonts follow the
COSS variable contract (`--font-sans`, `--font-heading` = Inter; `--font-mono` = Geist Mono). The
radius scale (`rounded-2xl` … `rounded-4xl`) is derived from `--radius`, so those utilities are
larger than stock Tailwind.

**Always use semantic tokens** (`bg-muted`, `bg-input`, `border-border`, `text-muted-foreground`,
…), never hardcoded `oklch`/hex colors — the latter break the light theme. Dark surface tokens are
subtle alphas (`--muted`/`--secondary`/`--accent` ≈ white/4%, `--input` ≈ white/8%, `--border` ≈
white/6%), so layered surfaces stay close in lightness.

## i18n

`i18next` + `react-i18next` (config in `lib/i18n/config.ts`, English resources in
`lib/i18n/locales/en/translation.json`). `components/i18n-provider.tsx` wraps the app in
`app/layout.tsx`. Use `const { t } = useTranslation()` + nested keys (e.g. `t("auth.login.title")`)
in **client** components. To add a language, drop a `locales/<lng>/translation.json` and register it
in `resources`/`supportedLngs` in `config.ts`.

**Coverage:** essentially all user-facing strings are now keyed (every app page + its dialogs/sheets,
auth pages, settings panels, the sidebar/user menu, chat input, patient cards/detail/form, messages,
notifications, notes). Keys are grouped by feature (`appointments.*`, `patientCard.*`, `messages.*`,
…). When adding UI, add a key rather than a literal. The only intentional literals left are clinical
**option values** stored as data (appointment types, dose frequencies/durations) and proper nouns
(e.g. `Ed25519`). There is no language switcher yet (English only); locale is auto-detected.

## Gotchas

- **Route protection lives in `proxy.ts`, not `middleware.ts`** — this customized Next renamed the
  convention (`export function proxy(request)` + `config.matcher`, Node runtime). See
  `node_modules/next/dist/docs/01-app/.../proxy.md`.
- `components/ai-elements/*` has **pre-existing type/lint errors** (Base UI drift) that used to fail
  `next build`. `next.config.ts` now sets `output: "standalone"` plus
  `typescript.ignoreBuildErrors` / `eslint.ignoreDuringBuilds` so production/Docker builds succeed —
  **type-check app code with `npx tsc --noEmit`** (filter out `components/ai-elements/`), not via
  `next build`. There's a `Dockerfile` for the standalone build.
- **`lucide-react@1.17` dropped brand glyphs** (e.g. `Github`, `Discord`) — import them and you get
  a build error. Use inline SVGs instead.
- The marketing **landing page is not in this monorepo** — it lives in the sibling Desktop folder
  `~/Desktop/temetro/landing-page` (next to `~/Desktop/temetro/docs`), a separate Next.js app /
  git repo seeded from this app (with `components/landing/`). Edit and commit it there.
- Multiple lockfiles in the tree produce a harmless Turbopack "inferred workspace root" warning.

### COSS composition gotchas (hit during the shadcn→COSS migration)

- **`MenuGroupLabel` must live inside `<MenuGroup>` (or `<MenuRadioGroup>`)** — there is no standalone
  `MenuLabel`. Using it bare throws `MenuGroupContext is missing` at runtime.
- **`DialogPopup`/`SheetPopup` have no inner padding** — padding comes from
  `DialogHeader`/`DialogPanel`/`DialogFooter`. For a form dialog: keep the header outside the form,
  wrap **panel + footer** in `<form className="contents">`, and put the body in `DialogPanel`
  (see `components/chat/patient-form-dialog.tsx`). Content placed directly in the popup is flush.
- **`Card` has no `size` prop** and **`Avatar` has no `size` prop**. For compact cards, override the
  section padding via data-slot selectors (`compactCard` in `patient-cards.tsx`); for avatars use a
  `size-*` class.
- **Solid destructive buttons:** use `variant="destructive"`, not the default variant + a `bg-*`
  override — the default variant keeps `border-primary`, which is near-white in dark mode.
- **COSS `Field` is `items-start`** (children don't stretch). Add `w-full` to buttons/rows meant to
  fill the field. There is **no `FieldGroup`** (use a flex column) and **no `InputGroupButton`**
  (use `Button`).
- COSS keeps back-compat aliases (`DialogContent`, `CardContent` → `CardPanel`, `SelectContent`,
  `TooltipContent`, `PopoverContent`, `SheetContent`), so old imports still resolve — but prefer the
  canonical `*Popup`/`*Panel` names in new/edited code.
- The vendored `ai-elements/*` were repointed to COSS (live `conversation`/`message` fully migrated;
  dormant files via aliased imports). Their remaining `tsc` errors are **pre-existing Base UI drift**,
  not regressions — they stay behind `ignoreBuildErrors`.
