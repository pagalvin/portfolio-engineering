### 2026-09-29

- Added the authenticated in-app Change Log under System with a personal New indicator and accessible Markdown, freshness, and failure states.
- Added organization- and user-scoped release-note acknowledgments that survive sessions, remain outside profile backups, and are removed during transactional profile deletion.
- Reused the validated repository-content channel for automatic and authenticated manual changelog refresh, with cached and bundled fallback when the source is unavailable.
- Completed and archived the In-App Change Log implementation plan after final governance and verification.

### 2026-09-26

- Completed the organization-scoped Security Master under System navigation. Members can search, filter, create, view, edit, deactivate, reactivate, and safely delete securities.
- Securities use a fixed Exchange dropdown and free-text sector and industry, and duplicates are blocked by normalized symbol and exchange within each organization.
- Added organization-owned `securities` persistence and protected `/api/securities` routes. The list response includes an unfiltered `totalCount`.
- Added ADR 0016 to block deletion of any security that another record references, and to never cascade-delete dependent data.
- Added ADR 0017 to standardize data-grid list behavior: compact headings, one-row URL-owned filters with visible defaults, row hover plus an explicit row action, distinct empty and error states, and a "Showing N of T" count line.
- Accepted ADRs 0001 and 0016. ADR 0001 now requires `organizationId` in every mutating statement's own predicate, and the Journal and AI Connection stores were hardened to match (TD-018).
- Deferred AI-assisted classification and all Security Master import paths (catalog, spreadsheet, and copy/paste) to future specifications.
- Completed the Security Master implementation plan and archived it under `docs/plans/closed/`.

### 2026-09-07

- Completed the in-app Help System with an authenticated `/help` master page and topic routes beside Settings in System navigation, GitHub `main`-sourced Markdown pages and plain-text tooltips, a global validated content cache with bundled fallback, and an authenticated Preferences refresh control.
- Added ADR 0015 to require that Help content be reviewed and updated whenever the feature it describes changes.
- Added a Help content authoring runbook at `docs/specs/0007-help-system-content-guide.md`.
- Archived the completed in-app Help System implementation plan under `docs/plans/closed/`.
- Recorded the full build session for the in-app Help System on YouTube: https://youtu.be/PfTcHUP4ISk

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
