# Initial auth-aware app bootstrap plan

## Goal

Create the first runnable monorepo slice that can render a page showing the user's name when authenticated, or a clear "please log in" message when unauthenticated.

## Overall status

- Plan status: initialized
- Execution status: not started
- Last updated: 2026-07-24

## Status legend

- Not started
- In progress
- Done
- Blocked

## Source documents

- Primary architecture source: [architecture.md](C:/src/portfolio-engineering/portfolio-engineering.worktrees/user-auth-page-setup-and-structure/docs/brainstorming/architecture.md)
- This plan is a working execution layer derived from the architecture brainstorm and should stay aligned with it as implementation decisions solidify.

## How to use this plan

- Read [architecture.md](C:/src/portfolio-engineering/portfolio-engineering.worktrees/user-auth-page-setup-and-structure/docs/brainstorming/architecture.md) before changing scope, package boundaries, or auth behavior.
- Use this document as the execution tracker: update phase and checklist item statuses as work progresses.
- When starting work, mark the relevant phase or items as `In progress`; when finished, mark them `Done`; if blocked, record `Blocked` and the reason.
- Keep implementation details brief here; capture only decisions, sequencing, and status that help the next agent continue quickly.
- If implementation diverges from the architecture brainstorm, update this plan to note the divergence and why, then reconcile the architecture document separately if the change is intentional.

## Current starting point

- The repository currently has architecture and infrastructure docs, but no application scaffold yet.
- The architecture in [architecture.md](C:/src/portfolio-engineering/portfolio-engineering.worktrees/user-auth-page-setup-and-structure/docs/brainstorming/architecture.md) calls for a pnpm monorepo with React/Vite frontend, Fastify API, shared packages, and JWT-based auth.

## Planning assumptions

- We should follow the documented monorepo shape from day one so later growth does not require a repo reshuffle.
- Real OAuth provider setup should remain compatible with the architecture, but the first increment should avoid blocking on external app registrations.
- The first implementation should prioritize a clean auth boundary over full production auth completeness.

## Proposed phases

### 1. Bootstrap the workspace

Status: Not started

- [Not started] Add root `package.json`
- [Not started] Add `pnpm-workspace.yaml`
- [Not started] Add shared base `tsconfig`
- [Not started] Create top-level folders:
  - [Not started] `apps/frontend`
  - [Not started] `apps/api`
  - [Not started] `packages/shared-types`
  - [Not started] `packages/auth`
  - [Not started] `packages/validation`
  - [Not started] `packages/ui`
  - [Not started] `packages/database`

### 2. Scaffold the frontend

Status: Not started

- [Not started] Create a Vite + React + TypeScript app in `apps/frontend`
- [Not started] Add a minimal app shell and routing only if needed for auth flow
- [Not started] Add a home page that:
  - [Not started] calls an auth/session endpoint
  - [Not started] renders the user's display name when authenticated
  - [Not started] renders a login-required message when not authenticated
- [Not started] Keep styling light; Tailwind can be added immediately if it does not slow bootstrap

### 3. Scaffold the API

Status: Not started

- [Not started] Create a Fastify + TypeScript app in `apps/api`
- [Not started] Establish the public/protected plugin split described in the architecture
- [Not started] Add baseline routes:
  - [Not started] `GET /health`
  - [Not started] `GET /auth/session` or equivalent current-user route
  - [Not started] `POST /auth/refresh` placeholder if needed for wiring
- [Not started] Keep route structure aligned with future JWT enforcement

### 4. Introduce an initial auth slice

Status: Not started

- [Not started] Create shared auth types for user/session payloads
- [Not started] Add JWT plumbing in the API
- [Not started] For the first increment, use a development-safe auth bootstrap that mimics the future OAuth outcome instead of implementing full provider registration immediately
- [Not started] Recommended first-step behavior:
  - [Not started] an API-issued session representing a sample user in development
  - [Not started] a current-user endpoint the frontend can query
  - [Not started] clear seams for later Google/Microsoft/Facebook callback handlers

### 5. Wire shared packages

Status: Not started

- [Not started] `packages/shared-types`: auth/user contracts
- [Not started] `packages/auth`: shared token and auth utility logic where reuse makes sense
- [Not started] `packages/validation`: request/response schemas
- [Not started] `packages/ui`: optional shared presentational primitives if needed
- [Not started] `packages/database`: placeholder package for future Prisma schema and migrations

### 6. Verify the bootstrap

Status: Not started

- [Not started] Install dependencies
- [Not started] Run scaffolded build/typecheck/lint/test commands that already exist
- [Not started] Verify the home page behavior for:
  - [Not started] authenticated state -> user name visible
  - [Not started] unauthenticated state -> login-required message visible

## Deliverable for this first milestone

Status: Not started

A runnable monorepo scaffold that proves the end-to-end auth-aware page behavior without yet requiring full external OAuth provider setup.

## Suggested implementation order

1. Root workspace bootstrap
2. Frontend scaffold
3. API scaffold
4. Shared auth/session contracts
5. Auth-aware page + current-user endpoint
6. Verification

## Risks / decisions to confirm during implementation

- [Open] Whether to include Tailwind in the very first scaffold or add it immediately after the page works
- [Open] Whether the first auth slice should use:
  - [Open] a dev-only mocked authenticated user, or
  - [Open] a lightweight real JWT login bootstrap endpoint
- [Open] Whether to create `apps/admin` now as an empty placeholder or defer until needed

## Recommended next step

Start with phase 1 and 2 together: create the root workspace plus `apps/frontend`, then add the minimal home page contract before filling in the API and auth details.
