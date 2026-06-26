# temetro frontend

The clinician-facing **AI chat UI** for [temetro](../) — a Next.js 16 app where
clinicians retrieve and organize patient data in natural language, rendered as
rich record cards. It's wired to the [`../backend`](../backend) for real auth,
multi-tenant clinics, and live patient data.

![temetro AI chat](../.github/assets/screenshot-chat.png)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
[COSS](https://coss.dev) UI components (Base UI) · i18next · Socket.io client.

> This app runs a **customized Next.js 16** whose conventions differ from the
> public docs (e.g. route protection lives in `proxy.ts`, not `middleware.ts`).
> See [`CLAUDE.md`](./CLAUDE.md) and `node_modules/next/dist/docs/` before
> writing Next.js code.

## Develop

```bash
npm install
npm run dev      # Next dev server (Turbopack) on http://localhost:3000
```

Other scripts: `npm run build` (production build), `npm run start` (serve the
build), `npm run lint`. There is no test runner — verify changes by running the
dev server.

### Talking to the backend

The frontend needs the API running (see [`../backend`](../backend)). It resolves
the backend URL **from the host you open the app on** — so it works on
`localhost` and across the clinic LAN (`http://<server-IP>:3000`) without a
rebuild. Set `NEXT_PUBLIC_API_URL` only to pin a fixed or reverse-proxied URL;
see [`lib/backend-url.ts`](./lib/backend-url.ts).

## Architecture

- **`app/`** — App Router. `app/(app)/` is the authenticated product shell;
  `app/(auth)/` holds the login / signup / onboarding pages.
- **`components/chat/`** — the chat UI (input, message state, patient cards).
- **`components/settings/`** — settings panels, including **About & updates**
  (version + LAN access).
- **`components/ui/`** — COSS primitives (Base UI, added via the shadcn CLI).
- **`lib/`** — API + auth clients, i18n, and data helpers.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, theming, and gotchas.

## License

[MIT](./LICENSE).
