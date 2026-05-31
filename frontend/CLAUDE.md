# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The import above is load-bearing: this is a **customized Next.js 16** with breaking changes vs.
> public docs. Before writing any Next.js code (routing, metadata, `next/image`, `next/font`,
> route handlers, config), read the relevant guide under `node_modules/next/dist/docs/01-app/`.

## What this is

`temetro` — an open-source AI chat that lets clinicians retrieve patient information in natural
language. The product surface is currently **UI-only**: the chat appends a mock assistant reply
(`components/chat/chat-panel.tsx`); there is no backend, model call, or patient data yet.

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
- **`app/`** — App Router. `app/page.tsx` is the product chat page (sidebar + chat panel);
  `app/layout.tsx` **forces dark mode** by putting `dark` on `<html>` and loads the fonts.
- **`components/ui/`** — shadcn components, but built on **Base UI (`@base-ui/react`), not Radix.**
  APIs differ: composition uses the `render` prop and `useRender`/`mergeProps`, not `asChild`.
  Match existing files when adding/editing primitives. Config in `components.json` (style
  `base-luma`, baseColor `neutral`).
- **`components/ai-elements/`** — a large AI-chat primitive library (`PromptInput`, `Conversation`,
  `Message`, `Suggestion`, etc.) typed against **AI SDK v6** (`ai` package: `UIMessage`,
  `ChatStatus`, `FileUIPart`). Note: `@ai-sdk/react` (`useChat`) is **not installed** — chat state
  is managed with local React state.
- **`components/sidebar-02/`** — the dashboard sidebar (`SidebarProvider` / `Sidebar` /
  `SidebarInset` from `components/ui/sidebar.tsx`). `app-sidebar.tsx` holds the nav/teams config.
- **`components/chat/`** — the product chat UI. `chat-panel.tsx` owns message state + empty/active
  layouts; `chat-input.tsx` is a bespoke (non–ai-elements) input matching a specific design.

## Theming

Tailwind v4 with `@theme inline` and **oklch CSS variables** in `app/globals.css` (a
Linear-inspired dark palette; `--primary` is indigo `#5e6ad2`). The app is dark-only. The radius
scale (`rounded-2xl` … `rounded-4xl`) is derived from `--radius`, so those utilities are larger than
stock Tailwind.

## Gotchas

- `npm run build` currently **fails its typecheck** on a pre-existing error in
  `components/ai-elements/attachments.tsx` (`openDelay` prop). `npm run dev` (Turbopack) is
  unaffected because it only compiles the imported route and doesn't typecheck the whole tree.
- **`lucide-react@1.17` dropped brand glyphs** (e.g. `Github`, `Discord`) — import them and you get
  a build error. Use inline SVGs instead.
- A sibling **`../landing-page/`** directory is a copy of this app with a marketing landing page
  (`components/landing/`); it is a separate project, not part of this git repo.
- Multiple lockfiles in the tree produce a harmless Turbopack "inferred workspace root" warning.
