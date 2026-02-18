# Claude Notes

## What This Repo Is
Chrome extension (Plasmo + React + TS) for capturing and exporting AI chat
conversations, plus a Spaces web app that reuses the same UI.

## Where to Look First
- Extension entry points: `src/background.ts`, `src/content.tsx`,
  `src/popup.tsx`, `src/options.tsx`
- Spaces app: `spaces/SpacesApp.tsx` and `spaces/pages/*`
- Web app entry: `web/src/main.tsx`

## Important Mechanics
- Auth/session sync lives in the background service worker.
- Content script injects the Selective Exporter overlay into chat UIs.
- Message parsing logic is in `src/hooks/useMessageScanner/parsers/*`.

## Conventions to Respect
- Tailwind uses `plasmo-` prefix.
- `~*` path alias maps to `src/*`.
- Env vars must use `PLASMO_PUBLIC_` prefix to reach the client.
- Popup auth state updates only on open (close/reopen after web login).

## Preferred Commands
- `pnpm dev` for extension dev build
- `pnpm build` / `pnpm package` for production builds
- `pnpm web:dev` / `pnpm web:build` for the Spaces web app

## Notes for Changes
- Keep changes minimal and scoped to the requested feature.
- If a file grows large, split into smaller components/modules.
- Avoid redundant logic; justify any necessary duplication.

