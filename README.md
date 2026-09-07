# portfolio-engineering

Portfolio operating system app for retail traders.

## Quick start

From the repository root:

```powershell
corepack pnpm install
corepack pnpm db:up
corepack pnpm db:migrate:dev
corepack pnpm dev
```

Copy [.env.example](.env.example) to `.env` at the repository root before starting the app, and set `APP_MODE=local` for passwordless household profiles or `APP_MODE=hosted` for OAuth-backed hosted login.

The root dev command starts the API first, waits for `http://127.0.0.1:3001/health`, and then starts the frontend:
- frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001`

## Local development modes

### Local household profile mode

Set `APP_MODE=local` to run the app with passwordless household profiles and no external OAuth setup.

### Hosted OAuth mode

Set `APP_MODE=hosted` and configure:
- API provider verification: `GOOGLE_CLIENT_ID`
- frontend Google button initialization: `VITE_GOOGLE_CLIENT_ID`
- optional callback payload overrides:
  - `VITE_OAUTH_ORGANIZATION_SLUG`
  - `VITE_OAUTH_ORGANIZATION_NAME`

Current auth behavior:
- `GET /auth/session` reports the configured app mode and resumes valid refresh-cookie sessions.
- `APP_MODE=local` exposes `/auth/profiles`, `/auth/profiles/select`, and passwordless profile creation/selection.
- `APP_MODE=hosted` requires OAuth sign-in and rejects passwordless local-profile sessions.
- `POST /auth/refresh` rotates the refresh token with a short grace window and returns a fresh access token.
- `GET /api/me` requires an `Authorization` header that carries the access token.
- Provider callback routes verify provider tokens in hosted mode:
  - `POST /auth/google/callback`
  - `POST /auth/microsoft/callback`
  - `POST /auth/facebook/callback`
- The hosted unauthenticated frontend state includes Google sign-in and posts the received ID token to `POST /auth/google/callback`.

## Current architecture snapshot

- Monorepo with React frontend, Fastify API, shared auth/validation packages, and Prisma-backed PostgreSQL persistence
- organization-aware auth and data access
- JWT session plus refresh-token rotation

Key docs:
- canonical schema docs and ER diagram: [docs/schema/current.md](docs/schema/current.md)
- architecture ADRs: [docs/ADRs/](docs/ADRs/)
- ADR follow-up recommendations: [docs/ADRs/ADR Recommendations.md](docs/ADRs/ADR%20Recommendations.md)
- business requirements specs: [docs/specs/](docs/specs/)
- spec template: [docs/specs/spec_template.md](docs/specs/spec_template.md)
- implementation plans: [docs/plans/](docs/plans/)
- plan template: [docs/plans/plan_template.md](docs/plans/plan_template.md)
- current tech debt checklist: [docs/tech-debt/checklist.md](docs/tech-debt/checklist.md)
- UX design artifacts and prototypes: [docs/uxd/](docs/uxd/)
- closeout notes archive: [docs/archive/](docs/archive/)

Database bootstrap:
- Prisma schema, generated client source, and migrations live in [packages/database/](packages/database/)
- local Postgres container config is in [docker-compose.yml](docker-compose.yml)
- `corepack pnpm db:up` starts Postgres
- `corepack pnpm db:migrate:dev` applies migrations and generates Prisma client

## For contributors

Useful verification commands:

```powershell
corepack pnpm build
corepack pnpm lint
```

Project origin and vision resources:
- dedicated YouTube channel: https://youtube.com/@portfolioengineering?si=_LJDWD_X4kDJUirB
- introduction: https://youtu.be/Srf49Z7D3DM
- vision session (mind mapping): https://www.youtube.com/watch?v=XURAgoB7XPc
- vision cleanup, MVP, and roadmap discussion: https://youtu.be/SrLCx27_n3g?si=7dmsvELCGpN9eaMZ
- early predecessor codebase: https://github.com/pagalvin/options-manager

## Changelog

### 2026-09-06

- Added a safe profile deletion workflow with backup-before-delete export, typed confirmation, cascade cleanup of profile and journal data, and a self-describing versioned JSON backup format.
- Completed the Personal Investor Profile feature with plain-English trader context, repo-sourced investment objectives and strategy presets, Markdown custom strategy overlays, and a dismissable empty profile alert banner.
- Archived the completed Personal Investor Profile implementation plan under `docs/plans/closed/`.
- Completed explicit local and hosted deployment modes with passwordless local household profiles, hosted OAuth route isolation, durable session recovery, and hosted rejection of local profile sessions.
- Replaced the parallel development startup command with a readiness-aware dev script that waits for API health before starting the frontend.
- Captured hosted organization onboarding as follow-up technical debt so organization-owned settings remain intentionally shared only within the correct tenant.

### 2026-09-05

- Completed Journal Day AI analysis with ready BYOK connection selection, streamed Markdown output, stop/retry behavior, safe transient errors, and no saved analysis history.
- Archived the completed Journal Entry AI Analysis implementation plan under `docs/plans/closed/`.
- Completed organization-scoped BYOK AI provider connections with encrypted credentials, Azure OpenAI, Google Gemini, and official OpenAI adapters, persisted health states, and Settings workflows for connection management.
- Archived the completed AI provider connections implementation plan under `docs/plans/closed/`.
- Captured the initial AI integration direction around BYOK provider connections, repo-sourced runtime content, and generic actionable alerts.
- Added ADR 0009 to standardize public GitHub `main` runtime content fetched through raw URLs, validated server-side, cached in the database, and backed by bundled defaults.

### 2026-08-30

- Completed the private Portfolio Journal with Markdown authoring, safe rendered views, Sunday-through-Saturday review scopes, and deterministic copy/download exports.
- Added organization-scoped Journal persistence and protected APIs while preserving URL-addressable Day, Week, Month, and All views.
- Deferred WYSIWYG editing, embedded media, and shared AI integration to dedicated future specifications.
- Archived the completed Portfolio Journal implementation plan under `docs/plans/closed/`.

### 2026-07-28

- Added an ADR-aware business requirements agent for writing downstream-ready feature briefs and established `docs/specs/` with a searchable spec template for numbered requirement documents.
- Added the first Portfolio Journal business requirements spec at [docs/specs/0001-portfolio-journal.md](docs/specs/0001-portfolio-journal.md), covering timezone-aware journal grouping, markdown-first authoring, on-demand AI analysis, rules adherence placeholders, context injection placeholders, and clipboard export workflows.

### 2026-07-26

- Added a dedicated UXD agent with explicit guidance for inclusive, accessibility-first behavior design across desktop, tablet, and mobile workflows.
- Established a canonical UX design workspace under `docs/uxd/` with default folders for prototypes, flows, and research artifacts.
- Added ADR 0002 to require URL-addressable major views with deep-link, refresh, and browser-history continuity as a frontend navigation baseline.
- Replaced the single auth-only frontend view with a route-based workspace scaffold that includes placeholder pages for core portfolio, risk, execution, learning, and settings features.
- Added a machine-readable UI scaffold contract and semantic design-token foundation to support consistent future implementation by coding agents.

### 2026-07-25

- Bootstrapped the first runnable pnpm monorepo slice with a React frontend, Fastify API, shared auth packages, and Prisma-backed PostgreSQL persistence.
- Added JWT-backed session and refresh-token flows with organization-aware user, OAuth identity, and token storage managed through the API and database packages.
- Wired the unauthenticated frontend state to Google sign-in, verified provider callback handling, and documented the local OAuth setup required for realistic auth testing.

## License

The full license is in [LICENSE.md](LICENSE.md).

In a nutshell, the license allows personal and educational use. Commercialization is restricted to the author and designated delegates; see the full license for details.
