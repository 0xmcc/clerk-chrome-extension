# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
clerk-chrome-extension/
├── src/                          # Extension source code (all entry points)
│   ├── background.ts             # Background service worker (auth, messaging)
│   ├── content.tsx               # Content script (overlay injection)
│   ├── popup.tsx                 # Popup window UI
│   ├── options.tsx               # Options page (minimal)
│   ├── interceptor.ts            # Network interceptor (MAIN world)
│   ├── style.css                 # Global styles
│   ├── components/
│   │   └── SelectiveExporter/    # Main UI component for conversation export
│   │       ├── index.tsx         # Root component with state management
│   │       ├── types.ts          # SelectiveExporter props and types
│   │       ├── constants.ts      # UI constants (colors, etc.)
│   │       ├── hooks/            # Exporter-specific hooks
│   │       ├── views/            # UI views (ExportView, AnalysisView, etc.)
│   │       ├── components/       # Sub-components (ActivityDashboard, etc.)
│   │       ├── services/         # External service integrations (agentmail)
│   │       └── __tests__/        # Component tests
│   ├── features/
│   │   ├── floating-button.tsx   # Overlay trigger button
│   │   └── count-button.tsx      # Demo component
│   ├── hooks/
│   │   ├── useCaptureSource.ts   # Determine capture mode and format
│   │   ├── useActivityMetrics.ts # Activity dashboard metrics
│   │   ├── useMessageScanner.ts  # Main hook for message capture (barrel)
│   │   └── useMessageScanner/
│   │       ├── index.ts          # Hook exports
│   │       ├── useMessageScanner.ts  # Hook implementation
│   │       ├── types.ts          # Message, Conversation, Interceptor types
│   │       ├── store.ts          # IndexedDB persistence, auth token cache
│   │       ├── state.ts          # useConversationStore hook
│   │       ├── ingestion.ts      # Pipeline for parsing/merging messages
│   │       ├── handlers.ts       # Message event handler factory
│   │       ├── rescan.ts         # Rescan handler for failed/empty captures
│   │       ├── mergers.ts        # Conversation merge logic
│   │       ├── utils.ts          # Platform/URL detection utilities
│   │       ├── urlMatchers.ts    # URL pattern matching
│   │       ├── parsers/          # Platform-specific message parsers
│   │       │   ├── chatgpt.ts
│   │       │   └── claude.ts
│   │       └── __tests__/        # Hook tests
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client initialization
│   │   ├── capture.ts            # Capture formatting (JSON, Markdown)
│   │   ├── pageCapture.ts        # Page-wide capture fallback
│   │   ├── tweet-extractor.ts    # Twitter/X specific extraction
│   │   ├── tweet-saver.ts        # Twitter bookmark persistence
│   │   └── __tests__/            # Lib tests
│   ├── scrapers/
│   │   └── domUtils.ts           # DOM traversal utilities
│   ├── config/
│   │   ├── endpoints.ts          # API endpoint patterns (ChatGPT, Claude)
│   │   ├── api.ts                # API base URLs
│   │   └── features.ts           # Feature flags
│   ├── ui/
│   │   └── CheckboxOverlay.ts    # Message selection overlay
│   ├── utils/
│   │   ├── clerk.ts              # Clerk auth utilities
│   │   ├── debug.ts              # Structured logging
│   │   ├── navigation.ts         # Browser tab opening
│   │   ├── platform.ts           # Platform detection (chatgpt, claude, etc.)
│   │   ├── conversation.ts       # Conversation utilities
│   │   ├── domSkeleton.ts        # DOM tree extraction
│   │   ├── proxyFetch.ts         # CORS bypass via background
│   │   └── __tests__/            # Util tests
│   └── contents/
│       ├── twitter-save-button.ts  # Twitter bookmark integration
│       └── twitter-save-button.test.ts
├── spaces/                       # Standalone web app (Spaces)
│   ├── SpacesApp.tsx            # Main app component with routing
│   ├── data.ts                  # Mock conversation data
│   ├── utils.ts                 # Spaces-specific utilities
│   ├── pages/                   # Route pages
│   │   ├── LandingPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── ConversationPage.tsx
│   │   ├── WorkspacePage.tsx
│   │   ├── PaymentPage.tsx
│   │   ├── SurveyPage.tsx
│   │   ├── SyncingPage.tsx
│   │   ├── InstallPage.tsx
│   │   └── ExplainerPage.tsx
│   └── components/              # Shared components
│       ├── TransformPanel.tsx
│       └── ui.tsx
├── web/                         # Web sync service
│   ├── src/
│   │   └── main.tsx            # Vite entry point
│   ├── index.html
│   ├── .env.development
│   ├── .env.chrome
│   └── .env.production
├── supabase/                    # Supabase migrations
│   └── migrations/
├── assets/                      # Extension assets (icons, etc.)
├── files/                       # Additional assets
├── docs/                        # Documentation
├── scripts/
│   └── prepare-prod-manifest.js # Production manifest script
├── test/                        # Test build outputs
├── build/                       # Build outputs (dev/prod)
├── .plasmo/                     # Plasmo cache
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript config
├── vite.web.config.ts          # Web app Vite config
├── .gitignore
└── CLAUDE.md                    # Development notes
```

## Directory Purposes

**src/**
- Purpose: All TypeScript/React source code for the extension
- Contains: Entry points, components, hooks, utilities, configuration
- Key files: `background.ts`, `content.tsx`, `popup.tsx`, `interceptor.ts`

**src/components/SelectiveExporter/**
- Purpose: Core UI component for selective message export
- Contains: Root component, sub-views (ExportView, AnalysisView, SettingsView), exporter-specific hooks
- Key files: `index.tsx` (main component), `hooks/` (useExportActions, useAnalysisActions, etc.)

**src/hooks/useMessageScanner/**
- Purpose: Unified message capture and state management
- Contains: Conversation store, message ingestion, platform parsers, event handlers
- Key files: `useMessageScanner.ts` (hook), `store.ts` (persistence), `parsers/` (platform-specific)

**src/lib/**
- Purpose: Shared utility libraries (not hooks)
- Contains: Supabase client, capture formatting, page scraping
- Key files: `capture.ts` (format conversations), `supabase.ts` (DB client)

**src/config/**
- Purpose: Centralized configuration
- Contains: API endpoints, feature flags, base URLs
- Key files: `endpoints.ts` (single source of truth for ChatGPT/Claude endpoints)

**src/utils/**
- Purpose: General utilities (helpers, platform detection, logging)
- Contains: Clerk auth wrappers, debug logging, DOM utilities, platform detection
- Key files: `debug.ts` (structured logging), `platform.ts` (detect browser context)

**spaces/**
- Purpose: Standalone web app sharing UI components
- Contains: React Router pages, data mocks, reusable components
- Key files: `SpacesApp.tsx` (main router), `pages/` (route handlers)

**web/**
- Purpose: Web sync service for extension auth
- Contains: Vite build config, minimal entry point
- Key files: `src/main.tsx` (entry point)

## Key File Locations

**Entry Points:**
- `src/background.ts`: Background service worker
- `src/content.tsx`: Content script (injects overlay)
- `src/popup.tsx`: Popup window
- `src/options.tsx`: Options page
- `spaces/SpacesApp.tsx`: Web app root
- `web/src/main.tsx`: Web service entry

**Configuration:**
- `src/config/endpoints.ts`: API endpoint patterns (critical)
- `src/config/features.ts`: Feature flags
- `package.json`: Dependencies, build scripts
- `tsconfig.json`: TypeScript configuration

**Core Logic:**
- `src/hooks/useMessageScanner/`: Message capture and state
- `src/components/SelectiveExporter/`: Export UI
- `src/interceptor.ts`: Network interception
- `src/background.ts`: Auth and messaging

**Testing:**
- `src/**/__tests__/`: Co-located test files
- `*.test.ts`, `*.test.tsx`: Test file convention

## Naming Conventions

**Files:**
- Lowercase with hyphens for multi-word files: `floating-button.tsx`, `tweet-extractor.ts`
- React components (PascalCase content): `SelectiveExporter/index.tsx`, `ActivityDashboard/index.tsx`
- Utilities (lowercase): `debug.ts`, `platform.ts`
- Tests: `*.test.ts` or `*.test.tsx` (co-located with source)

**Directories:**
- PascalCase for component directories: `SelectiveExporter/`, `ActivityDashboard/`
- Lowercase for feature/utility directories: `hooks/`, `utils/`, `lib/`, `config/`
- Plural for collections: `scrapers/`, `parsers/`, `contents/`

**Functions:**
- React components (PascalCase): `SelectiveExporter()`, `FloatingButton()`
- Hooks (camelCase with use prefix): `useMessageScanner()`, `useCaptureSource()`
- Utilities (camelCase): `getConversationKey()`, `isCapturedPlatform()`
- Event handlers (camelCase with handle prefix): `handleInterceptorEvent()`, `handleExport()`

**Variables:**
- Constants (UPPER_SNAKE_CASE): `RESCAN_COOLDOWN_MS`, `MESSAGE_SOURCE`
- State (camelCase): `isExporterOpen`, `conversations`, `authStatus`
- Types (PascalCase): `Conversation`, `Message`, `CaptureSurface`

## Where to Add New Code

**New Feature (Capture Format or Export Method):**
- Primary code: `src/components/SelectiveExporter/hooks/useExportActions.ts` (add export handler)
- Format logic: `src/lib/capture.ts` (add serialization function)
- Tests: `src/components/SelectiveExporter/hooks/useExportActions.test.tsx`

**New Component or UI View:**
- Implementation: `src/components/SelectiveExporter/views/` (for exporter views) or `src/features/` (for floating UI)
- Hooks: `src/components/SelectiveExporter/hooks/` (exporter-specific) or `src/hooks/` (shared)
- Tests: `src/components/SelectiveExporter/__tests__/` or co-located `.test.tsx`

**New Platform Support (beyond ChatGPT/Claude):**
- Parser: `src/hooks/useMessageScanner/parsers/[platform].ts`
- URL utilities: `src/utils/platform.ts` (add platform detection)
- Endpoint config: `src/config/endpoints.ts` (add ENDPOINTS entry)
- Types: `src/hooks/useMessageScanner/types.ts` (extend CapturedPlatform union)

**Utilities and Helpers:**
- Shared helpers: `src/utils/` (e.g., `src/utils/conversation.ts` for conversation utilities)
- Library code (non-hooks): `src/lib/` (e.g., `src/lib/supabase.ts` for DB client)
- DOM utilities: `src/scrapers/` (e.g., `src/scrapers/domUtils.ts`)

## Special Directories

**build/:**
- Purpose: Build artifacts (dev and prod)
- Generated: Yes
- Committed: No (in .gitignore)

**.plasmo/:**
- Purpose: Plasmo framework cache and asset generation
- Generated: Yes
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes
- Committed: No (in .gitignore)

**supabase/migrations/:**
- Purpose: Database schema migrations
- Generated: No (manually created)
- Committed: Yes

## Path Aliases

The project uses Plasmo's `~*` alias:
- `~*` maps to `src/*`
- Used in imports: `import { SelectiveExporter } from "~components/SelectiveExporter"`
- Configured in Plasmo (implicit, no tsconfig alias needed)

---

*Structure analysis: 2026-03-20*
