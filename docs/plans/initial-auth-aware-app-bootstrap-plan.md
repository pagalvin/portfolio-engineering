# Initial auth-aware app bootstrap plan

## Goal

Create the first runnable monorepo slice that can render a page showing the user's name when authenticated, or a clear "please log in" message when unauthenticated.

## Overall status

- Plan status: initialized
- Execution status: in progress
- Last updated: 2026-07-24 (frontend Google sign-in now wired to provider callback route)

## Status legend

- Not started
- In progress
- Done
- Blocked

## Source documents

- Primary architecture source: [architecture.md](C:/src/portfolio-engineering/portfolio-engineering.worktrees/plan-analysis-first-step/docs/brainstorming/architecture.md)
- This plan is a working execution layer derived from the architecture brainstorm and should stay aligned with it as implementation decisions solidify.

## How to use this plan

- Read [architecture.md](C:/src/portfolio-engineering/portfolio-engineering.worktrees/plan-analysis-first-step/docs/brainstorming/architecture.md) before changing scope, package boundaries, or auth behavior.
- Use this document as the execution tracker: update phase and checklist item statuses as work progresses.
- When starting work, mark the relevant phase or items as `In progress`; when finished, mark them `Done`; if blocked, record `Blocked` and the reason.
- Keep implementation details brief here; capture only decisions, sequencing, and status that help the next agent continue quickly.
- If implementation diverges from the architecture brainstorm, update this plan to note the divergence and why, then reconcile the architecture document separately if the change is intentional.

## Current starting point

- The repository currently has architecture and infrastructure docs, but no application scaffold yet.
- The architecture in [architecture.md](C:/src/portfolio-engineering/portfolio-engineering.worktrees/plan-analysis-first-step/docs/brainstorming/architecture.md) calls for a pnpm monorepo with React/Vite frontend, Fastify API, shared packages, and JWT-based auth.

## Planning assumptions

- We should follow the documented monorepo shape from day one so later growth does not require a repo reshuffle.
- Real OAuth provider setup should remain compatible with the architecture, but the first increment should avoid blocking on external app registrations.
- The first implementation should prioritize a clean auth boundary over full production auth completeness.

## Proposed phases

### 1. Bootstrap the workspace

Status: Done

- [Done] Add root `package.json`
- [Done] Add `pnpm-workspace.yaml`
- [Done] Add shared base `tsconfig`
- [Done] Create top-level folders:
  - [Done] `apps/frontend`
  - [Done] `apps/api`
  - [Done] `packages/shared-types`
  - [Done] `packages/auth`
  - [Done] `packages/validation`
  - [Done] `packages/ui`
  - [Done] `packages/database`

### 2. Scaffold the frontend

Status: Done

- [Done] Create a Vite + React + TypeScript app in `apps/frontend`
- [Done] Add a minimal app shell and routing only if needed for auth flow
- [Done] Add a home page that:
  - [Done] calls an auth/session endpoint
  - [Done] renders the user's display name when authenticated
  - [Done] renders a login-required message when not authenticated
- [Done] Keep styling light; Tailwind can be added immediately if it does not slow bootstrap

### 3. Scaffold the API

Status: Done

- [Done] Create a Fastify + TypeScript app in `apps/api`
- [Done] Establish the public/protected plugin split described in the architecture
- [Done] Add baseline routes:
  - [Done] `GET /health`
  - [Done] `GET /auth/session` or equivalent current-user route
  - [Done] `POST /auth/refresh` placeholder if needed for wiring
- [Done] Keep route structure aligned with future JWT enforcement

### 4. Introduce an initial auth slice

Status: Done

- [Done] Create shared auth types for user/session payloads
- [Done] Add JWT plumbing in the API
- [Done] For the first increment, use a development-safe auth bootstrap that mimics the future OAuth outcome instead of implementing full provider registration immediately
- [Done] Recommended first-step behavior:
  - [Done] an API-issued session representing a sample user in development
  - [Done] a current-user endpoint the frontend can query
  - [Done] clear seams for later Google/Microsoft/Facebook callback handlers

### 5. Wire shared packages

Status: In progress

- [Done] `packages/shared-types`: auth/user contracts
- [Done] `packages/auth`: shared token and auth utility logic where reuse makes sense
- [Done] `packages/validation`: request/response schemas
- [Not started] `packages/ui`: optional shared presentational primitives if needed
- [Done] `packages/database`: placeholder package for future Prisma schema and migrations

### 6. Verify the bootstrap

Status: Done

- [Done] Install dependencies
- [Done] Run scaffolded build/typecheck/lint/test commands that already exist
- [Done] Verify the home page behavior for:
  - [Done] authenticated state -> user name visible
  - [Done] unauthenticated state -> login-required message visible

## Deliverable for this first milestone

Status: Done

A runnable monorepo scaffold that proves the end-to-end auth-aware page behavior without yet requiring full external OAuth provider setup.

## Suggested implementation order

1. Root workspace bootstrap
2. Frontend scaffold
3. API scaffold
4. Shared auth/session contracts
5. Auth-aware page + current-user endpoint
6. Verification

## Risks / decisions to confirm during implementation

- [Decided] Tailwind is deferred until after the API/auth slice works so the first runnable scaffold stays focused.
- [Decided] The first auth slice now uses a Fastify-backed development session contract at `GET /auth/session`, with Vite proxying requests locally to the API.
- [Decided] `apps/admin` is deferred until there is a concrete admin workflow to implement.

## Notes from current execution

- The frontend and API now share auth/session contracts from `packages/shared-types`.
- Local `pnpm dev` runs both the frontend and API; Vite proxies `/auth`, `/api`, and `/health` to the Fastify server on port `3001`.
- The development auth seam supports `?demoAuth=authenticated` and `?demoAuth=unauthenticated` for verifying the first page state without external OAuth setup.
- `GET /auth/session?demoAuth=authenticated` now signs a real JWT and exposes it through the `x-dev-access-token` response header for development verification of protected routes.
- The protected Fastify plugin now uses `request.jwtVerify()` with a shared auth package secret/helper seam instead of the old hardcoded bearer token.
- The authenticated session path now sets an `httpOnly` refresh-token cookie, and `POST /auth/refresh` rotates that cookie while returning a fresh access token.
- `packages/validation` now provides shared auth-related Zod schemas used by the API routes to validate query input and response shapes.
- `packages/database` now contains a Prisma 7 setup with `prisma.config.ts`, an initial PostgreSQL schema, generated client exports, and an initial SQL migration under `prisma/migrations/20260724_initial_auth_bootstrap/`.
- The initial persistence schema covers organizations, users, OAuth providers, and refresh tokens, matching the current auth architecture constraints.
- The database package exports a Prisma client singleton plus an auth-store seam so the API can adopt persistent users and refresh tokens without changing its external route contracts.
- The API auth bootstrap now persists its development organization, user, OAuth identity, and refresh-token hashes through `packages/database` instead of using in-memory sample auth records.
- Database-backed auth queries and writes now scope organization-owned records with direct `organizationId` usage in line with [0001-organization-aware-data-access.md](../ADRs/0001-organization-aware-data-access.md).
- Full runtime verification of the authenticated persisted flow has now succeeded against a real local PostgreSQL instance, including refreshed access-token issuance and a protected-route call returning persisted user and organization IDs.
- Provider callback routes now exist at `POST /auth/google/callback`, `POST /auth/microsoft/callback`, and `POST /auth/facebook/callback`, each persisting organization-aware user and OAuth identity records before issuing session tokens.
- Provider callback payloads now require a provider token, and callback identity fields are now verified from provider systems rather than trusted directly from request body input.
- Callback role assignment is now server-controlled to prevent client-side role escalation.
- The unauthenticated frontend page now loads Google Identity Services, renders a Google sign-in button, submits the ID token to `POST /auth/google/callback`, and updates app state to the authenticated session contract on success.
- `apps/api` now loads workspace-root `.env` values at startup (without overriding already-set process env vars), and frontend Vite now reads env files from the workspace root to keep OAuth configuration consistent across local app processes.

## Recommended next step

Phase out the `demoAuth` bootstrap path once real provider callback usage is stable across development checks.
