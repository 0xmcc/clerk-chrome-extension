# Agent Notes

## Overview
This repo contains a Plasmo-based Chrome extension with Clerk auth, plus a
"Spaces" React app that also ships as a standalone web build.

## Project Layout
- `src/`: Chrome extension entry points and core logic
- `spaces/`: Spaces app (pages + components)
- `web/`: Standalone web app build for Spaces

## Entry Points
- `src/background.ts`: service worker for auth/session refresh + interception
- `src/content.tsx`: content script injected into chat UIs
- `src/popup.tsx`: popup UI
- `src/options.tsx`: options UI (renders Spaces app)
- `web/src/main.tsx`: standalone web app entry

## Core Systems
- Message scanning: `src/hooks/useMessageScanner/*`
- Selective exporter UI: `src/components/SelectiveExporter/*`
- Endpoint config: `src/config/endpoints.ts`
- Debug logging: `src/utils/debug.ts` (tagged debug categories)

## Development Commands
- `pnpm dev`: Plasmo dev build (loads from `build/chrome-mv3-dev/`)
- `pnpm build`: production build (outputs `build/chrome-mv3-prod/`)
- `pnpm package`: zip for store distribution
- `pnpm web:dev` / `pnpm web:build`: Spaces web app via Vite

## Environment Variables
All client-visible vars must be prefixed with `PLASMO_PUBLIC_`.
Required for auth/session sync:
- `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `PLASMO_PUBLIC_CLERK_SYNC_HOST`
- `CLERK_FRONTEND_API` (background only)
Optional:
- `PLASMO_PUBLIC_API_BASE_URL`
- `PLASMO_PUBLIC_DEBUG` (comma-separated debug tags)

## Key Conventions / Pitfalls
- Popup auth state only refreshes on open; close/reopen after web login.
- Tailwind is configured with `plasmo-` prefix to avoid host-page collisions.
- Extension routing uses `MemoryRouter`; web app uses `BrowserRouter`.
- Path alias: `~*` maps to `./src/*` via `tsconfig.json`.

