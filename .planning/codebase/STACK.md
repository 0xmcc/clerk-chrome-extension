# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- TypeScript 5.3.3 - Extension and web app source code
- JavaScript - Build scripts and configuration

**Secondary:**
- SQL - Supabase migrations and database schema

## Runtime

**Environment:**
- Chrome Extensions (Manifest V3)
- Node.js - Build and development tooling

**Package Manager:**
- pnpm (lockfile: `pnpm-lock.yaml` present)

## Frameworks

**Core:**
- React 18.2.0 - UI components for extension popup and web app
- Plasmo 0.90.5 - Chrome extension framework (handles build, content scripts, background workers)

**Routing:**
- react-router-dom 6.30.2 - Client-side routing for web app

**Build/Dev:**
- Vite 5.2.0 - Module bundler and dev server
- Vitest 4.0.18 - Unit and integration testing framework

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS (with `plasmo-` prefix for scoping)
- PostCSS 8.4.33 - CSS transformation

**Code Quality:**
- Prettier 3.2.4 - Code formatting with `@ianvs/prettier-plugin-sort-imports`
- TypeScript - Static type checking

## Key Dependencies

**Critical:**
- @clerk/chrome-extension 2.8.4 - Authentication provider for user sessions in extension
- @supabase/supabase-js 2.94.1 - Database and API client for Supabase backend

**UI & Content:**
- react-markdown 10.1.0 - Markdown rendering for chat content
- marked 17.0.1 - Markdown parser
- remark-gfm 4.0.1 - GitHub-flavored Markdown support

**Development Tools:**
- @vitejs/plugin-react 4.3.4 - React JSX transformation for Vite
- @types/chrome 0.0.258 - Chrome extension API type definitions
- @types/react, @types/react-dom, @types/node - TypeScript type definitions

**Utilities:**
- defuddle 0.10.0 - Custom utility library (purpose unclear from code)
- get-shit-done-cc (github:gsd-build/get-shit-done) - Custom task/state management

**Testing:**
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/dom 10.4.1 - DOM query and assertion utilities
- @testing-library/jest-dom 6.9.1 - Custom matchers for jest-dom
- jsdom 28.1.0 - DOM implementation for Node.js (used by Vitest)

## Configuration

**Environment:**
- Environment variables use `PLASMO_PUBLIC_` prefix to be accessible in client code
- Configuration files:
  - `.env.chrome` - Chrome extension environment (development)
  - `.env.development` - Development environment variables
  - `.env.production` - Production environment variables (contains secrets, not committed)

**Required Environment Variables:**
- `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key for auth
- `PLASMO_PUBLIC_CLERK_SYNC_HOST` - Clerk sync host URL
- `PLASMO_PUBLIC_API_BASE_URL` - Backend API base URL (defaults to `http://localhost:3000`)
- `PLASMO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `PLASMO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `PLASMO_PUBLIC_DEBUG` - Debug logging flag

**Build:**
- `tsconfig.json` - TypeScript configuration with path alias `~*` → `src/*`
- `.prettierrc.mjs` - Prettier formatting config (80 char line width, no semicolons, import sorting)
- `vite.web.config.ts` - Vite config for web app (`web/` root, outputs to `build/web`)
- `vitest.config.ts` - Vitest config (jsdom environment, React plugin, path alias)
- `postcss.config.js` - PostCSS with Tailwind CSS plugin
- `tailwind.config.js` - Tailwind config with `plasmo-` prefix, dark mode

## Platform Requirements

**Development:**
- Chrome browser (for extension testing)
- Node.js (version unspecified, but TypeScript 5.3.3+ typically requires Node 14+)
- PNPM package manager

**Chrome Extension Requirements:**
- Manifest V3 (Chrome 88+)
- Permissions: `cookies`, `storage`, `scripting`
- Host permissions: ChatGPT, Claude, X/Twitter, Clerk sync host, API endpoints

**Production:**
- Chrome Web Store distribution
- Supabase backend (for data storage)
- Clerk authentication backend (for user sessions)

## Scripts

**Development:**
- `pnpm dev` - Plasmo dev build with hot reload
- `pnpm web:dev` - Vite dev server for web app

**Building:**
- `pnpm build` - Plasmo production build
- `pnpm build:store` - Store release build with manifest preparation script
- `pnpm package` - Package extension for distribution
- `pnpm web:build` - Vite production build for web app

**Testing:**
- `pnpm test` - Run Vitest once
- `pnpm test:watch` - Run Vitest in watch mode

---

*Stack analysis: 2026-03-20*
