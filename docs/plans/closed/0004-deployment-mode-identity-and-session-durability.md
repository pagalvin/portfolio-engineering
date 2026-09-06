# Plan 0004: Deployment Mode Identity and Session Durability

- Status: `done`
- Date: 2026-09-06
- Spec: [0004-deployment-mode-identity-and-session-durability](../../specs/0004-deployment-mode-identity-and-session-durability.md)
- Audience: [coding-agents, database-agents, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: complete
- Completed efforts: E-01, E-02, E-03, E-04, E-05, E-06, E-07
- Blocked tasks: none
- Next recommended task: none
- Last updated: 2026-09-06

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Shared Auth Configuration & Mode Validation | 2 | 2 | done |
| E-02 | Shared Auth Types, Schemas & Database Operations | 2 | 2 | done |
| E-03 | Server Boot, Route Safety & Mode-Conditional Endpoint Registration | 3 | 3 | done |
| E-04 | Session Repair, Graceful Rotation & Single-Flight Client Refresh | 2 | 2 | done |
| E-05 | Household Profile Picker, In-App Switcher & Unconfigured Error UI | 2 | 2 | done |
| E-06 | End-to-End Verification & Validation Suite | 1 | 1 | done |
| E-07 | Feature Closeout & Tech Debt Reconciliation | 1 | 1 | done |

## Summary

This plan implements explicit application deployment modes (`APP_MODE=local|hosted`) and repairs session durability bugs across the full stack. In `local` mode, it provides passwordless household profile management and auto-bootstrapping with 365-day session durability; in `hosted` mode, it enforces multi-tenant OAuth with 7-day sliding session durability and strictly hides local profile routes. It fixes the `/auth/session` cookie-erasure defect, adds single-flight 401 retry to the frontend API client, introduces a 30-second token rotation grace window for multi-tab durability, and renders informative UI instructions if `APP_MODE` is unconfigured or initialization fails.

## Inputs

- Spec readiness at planning time: `Ready for planning` ([0004-deployment-mode-identity-and-session-durability](../../specs/0004-deployment-mode-identity-and-session-durability.md))
- ADRs reviewed: [ADR 0001](../../ADRs/0001-organization-aware-data-access.md), [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md)
- UX artifacts used: `docs/uxd/flows/ui-scaffold-contract.json`
- Schema reference: [current.md](../../schema/current.md) (uses existing `Organization`, `User`, `RefreshToken` models; no database migrations required)
- Intersecting tech debt: `TD-001` (phase out development-only `demoAuth` path)

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) | All household profiles and sessions remain organization-scoped | E-02, E-03 |
| [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | Profile switching and session recovery preserve URL continuity | E-05 |
| [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) | Frontend route navigation uses React Router | E-05 |
| [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | Profile picker and error panel UI follow Tailwind / shadcn patterns | E-05 |
| [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) | Governs the deployment mode boundary, passwordless local profiles, and session core repair | E-01, E-02, E-03, E-04, E-05 |

## Approach

- **Config & Core:** Centralize mode parsing (`getAppMode()`) and token lifetime derivation in `@portfolio-engineering/auth`. Default `SESSION_TTL_DAYS` to 365 in local mode and 7 in hosted mode; `ACCESS_TOKEN_TTL_MINUTES` defaults to 15. Derive JWT `expiresIn` and cookie `maxAge` from matching numbers to prevent drift.
- **Data & Contracts:** `User` records without `OAuthProvider` rows natively represent passwordless local profiles. Add profile listing/creation methods to `AuthStore`. If email is omitted on creation, generate `<slug>@local.invalid`. Extend `sessionResponseSchema` with `appMode` and `UnconfiguredSessionResponse`.
- **Server Mechanics:** In `apps/api`, check `APP_MODE` during Fastify plugin registration. If unconfigured or DB fails, set an unconfigured state handler so `/auth/session` returns structured setup instructions. Register `/auth/profiles*` only in local mode; register OAuth callbacks only in hosted mode. On local clean boot (0 users), auto-create "Local Portfolio" + "Primary User".
- **Session Core & Resiliency:** Update `GET /auth/session` to inspect refresh token cookies on load before declaring unauthenticated state. Implement a 30-second token rotation grace window in `POST /auth/refresh` using `revokedAt` timestamps. Implement single-flight refresh queue in frontend `AuthenticatedApiClient` with 1 automatic retry on `401`.
- **Frontend Experience:** When `configured: false`, render `ConfigurationErrorPanel` with `.env` setup steps. In local mode, render `ProfilePicker` for unauthenticated state or initial profile selection, and add a `ProfileSwitcher` in workspace settings / header. Auto-resume last selected profile via `portfolio_engineering_profile_id` cookie.

## Non-goals

- Adding passwords, PINs, or local profile authentication secrets.
- Database schema changes or Prisma migrations (existing schema is sufficient).
- Hosted session revocation UI ("sign out all devices") (tracked in GitHub Issue #20).
- Account migration or profile linking between local and hosted deployments.

---

## E-01: Shared Auth Configuration & Mode Validation

**Goal:** Establish a single source of truth in `@portfolio-engineering/auth` for parsing `APP_MODE` (`local` | `hosted`), computing token lifetimes without drift, and generating consistent cookie options.

**Exit gate:** Unit tests pass for `getAppMode()`, `getAuthConfiguration()`, and `getRefreshTokenCookieOptions()`, correctly handling missing `APP_MODE`, custom `SESSION_TTL_DAYS`, and mode-specific defaults.

**Depends on:** none

### T-01.1: Implement deployment mode resolution and configuration helpers

- **Status:** done
- **Owner:** backend
- **Depends on:** none
- **Files:**
  - `packages/auth/src/index.ts` (modified)
- **Intent:** Define `AppMode` type (`'local' | 'hosted'`), `getAppMode()` parser, and `getAuthConfiguration()` function that reads `APP_MODE`, `SESSION_TTL_DAYS` (default 365 local / 7 hosted), and `ACCESS_TOKEN_TTL_MINUTES` (default 15). Align `REFRESH_TOKEN_MAX_AGE_SECONDS` and JWT `expiresIn` strings cleanly.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Require APP_MODE to be explicitly set to local or hosted on application boot. Use a single source of truth for session lifetimes."
- **Verify:** `pnpm --filter @portfolio-engineering/auth test` or unit test verifies `getAppMode()` throws or returns `null` on missing/invalid input, and returns `'local'` or `'hosted'` when set.
- **Notes:** Implemented `AppMode`, `getAppMode()`, `getAuthConfiguration()`, and `getRefreshTokenCookieOptions()`. Verified with 12 unit tests.

### T-01.2: Add unit tests for auth configuration and token lifetime derivation

- **Status:** done
- **Owner:** backend
- **Depends on:** T-01.1
- **Files:**
  - `packages/auth/src/index.test.ts` (new)
- **Intent:** Create comprehensive unit tests for `getAppMode()`, `getAuthConfiguration()`, and `getRefreshTokenCookieOptions()`, ensuring cookie `maxAge` and JWT expiration match across local and hosted settings.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Use a single source of truth for session lifetimes, defaulting to 365 days for local mode and 7 days for hosted mode."
- **Verify:** `pnpm --filter @portfolio-engineering/auth test` passes all test cases.
- **Notes:** Created unit tests in `packages/auth/src/index.test.ts`. Verified all tests pass.

---

## E-02: Shared Auth Types, Schemas & Database Operations

**Goal:** Update shared auth types, Zod schemas, and `AuthStore` database methods to support local profiles, `appMode` session metadata, unconfigured error responses, and rotation grace windows.

**Exit gate:** `AuthStore` methods (`listProfiles`, `createProfile`, `findActiveOrRecentlyRotatedRefreshToken`) pass database unit tests, and Zod schemas validate new session and profile contracts.

**Depends on:** E-01

### T-02.1: Update shared types and Zod schemas for appMode, profiles, and unconfigured states

- **Status:** done
- **Owner:** backend
- **Depends on:** E-01
- **Files:**
  - `packages/shared-types/src/auth.ts` (modified)
  - `packages/validation/src/auth.ts` (modified)
- **Intent:** Add `appMode` to `AuthenticatedSessionResponse`. Define `UnconfiguredSessionResponse` (`authenticated: false, configured: false, message: string, instructions: string[]`). Define `HouseholdProfile` type, `createProfileSchema` (`{ displayName: string, email?: string }`), `selectProfileSchema` (`{ profileId: string }`), and `profilesResponseSchema`.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — "All user accounts belong to an organization." [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Generate a synthetic email (<slug>@local.invalid) when a local profile is created without an explicit email address."
- **Verify:** Frontend and backend packages compile cleanly against the updated shared types and validation schemas.
- **Notes:** Updated `packages/shared-types` and `packages/validation` with `AppMode`, `UnconfiguredSessionResponse`, `HouseholdProfile`, and profile request/response contracts and Zod schemas. Verified `pnpm typecheck` across monorepo.

### T-02.2: Extend AuthStore with household profile management and rotation grace window support

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/src/authStore.ts` (modified)
  - `packages/database/src/authStore.test.ts` (new)
- **Intent:** Add `listProfilesInOrganization()`, `createLocalProfile()` (generating `<slug>@local.invalid` if email is omitted), and update `findActiveRefreshTokenByHash()` to accept tokens revoked within a grace window (e.g. `revokedAt >= now - graceWindowMs`).
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — "Data access queries MUST filter by organizationId." [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Generate a synthetic email when a local profile is created without an explicit email address."
- **Verify:** `pnpm --filter @portfolio-engineering/database test` verifies profile creation, list ordering, and grace-window token lookup.
- **Notes:** Added `listProfilesInOrganization`, `createLocalProfile` with synthetic email generation/collision handling, `mapUserRecordToHouseholdProfile`, `generateSyntheticEmail`, and `findActiveRefreshTokenByHash` with `graceWindowMs` support. Added 10 unit tests in `authStore.test.ts`. Verified unit tests pass and monorepo typechecks cleanly.

---

## E-03: Server Boot, Route Safety & Mode-Conditional Endpoint Registration

**Goal:** Wire `APP_MODE` validation into Fastify server boot, handle unconfigured/initialization error states gracefully, register local profile vs OAuth callback routes conditionally, and repair `GET /auth/session` to verify cookies on load.

**Exit gate:** In `hosted` mode, `/auth/profiles*` returns 404; in `local` mode, OAuth callback returns 404. On unconfigured boot, `/auth/session` returns `UnconfiguredSessionResponse`. On fresh local boot, "Local Portfolio" + "Primary User" are auto-created.

**Depends on:** E-02

### T-03.1: Implement server mode initialization and local auth bootstrap

- **Status:** done
- **Owner:** backend
- **Depends on:** E-02
- **Files:**
  - `apps/api/src/lib/localAuthBootstrap.ts` (new)
  - `apps/api/src/lib/devAuthBootstrap.ts` (modified/re-exported)
- **Intent:** Implement `ensureLocalDefaultProfile()` to auto-create "Local Portfolio" organization and "Primary User" profile on clean local boot (0 users), or adopt existing pre-`APP_MODE` users if present.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Auto-create a Primary User profile on clean database boot when running in APP_MODE=local with 0 existing users."
- **Verify:** Calling `ensureLocalDefaultProfile()` against an empty test database creates the organization and default user profile.
- **Notes:** Implemented `ensureLocalDefaultProfile()` and `localAuthBootstrap.ts` supporting clean local boot and adoption of pre-`APP_MODE` dev organizations.

### T-03.2: Wire APP_MODE conditional route registration and GET /auth/session repair in public plugin

- **Status:** done
- **Owner:** backend
- **Depends on:** T-03.1
- **Files:**
  - `apps/api/src/plugins/public.ts` (modified)
- **Intent:** Read `APP_MODE`. If unconfigured, respond to `/auth/session` with `UnconfiguredSessionResponse`. In `local` mode, register `/auth/profiles` (GET), `/auth/profiles` (POST), and `/auth/profiles/select` (POST); do NOT register OAuth callbacks. In `hosted` mode, register OAuth callbacks; do NOT register profile endpoints. Update `GET /auth/session` to verify the refresh cookie first before declaring unauthenticated state.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Omit inactive mode routes from registration so they return 404 rather than 403. Repair GET /auth/session to verify refresh cookies on reload rather than clearing them."
- **Verify:** Integration test verifies `/auth/profiles` returns 404 in `hosted` mode, OAuth callback returns 404 in `local` mode, and reloading with a valid refresh cookie returns `authenticated: true`.
- **Notes:** Implemented conditional route registration and repaired `GET /auth/session` cookie-erasure defect. Verified with integration tests in `public.test.ts`.

### T-03.3: Enforce startup validation and error handling in buildApp

- **Status:** done
- **Owner:** backend
- **Depends on:** T-03.2
- **Files:**
  - `apps/api/src/app.ts` (modified)
  - `apps/api/src/server.ts` (modified)
- **Intent:** Update `buildApp()` to log warnings when `APP_MODE` is missing/invalid, pass mode state to plugins, and prevent silent defaulting. Ensure server health check and session endpoints report unconfigured state when initialization fails.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Require APP_MODE to be explicitly set to local or hosted on application boot."
- **Verify:** Server logs clear error when `APP_MODE` is missing, and `/auth/session` returns `configured: false`.
- **Notes:** Updated `buildApp()` to validate and log `APP_MODE` status during server startup. Verified with tests.

---

## E-04: Session Repair, Graceful Rotation & Single-Flight Client Refresh

**Goal:** Eliminate multi-tab logout races on the server via 30-second token rotation grace window, and update the frontend `AuthenticatedApiClient` with single-flight token refresh queue and transparent request retry on 401.

**Exit gate:** Multiple parallel 401 requests in the frontend execute exactly 1 `POST /auth/refresh` network call, update the in-memory access token, and retry all original requests successfully.

**Depends on:** E-03

### T-04.1: Implement 30-second token rotation grace window in POST /auth/refresh

- **Status:** done
- **Owner:** backend
- **Depends on:** E-03
- **Files:**
  - `apps/api/src/plugins/public.ts` (modified)
- **Intent:** Update `POST /auth/refresh` handler. When looking up the refresh token hash, check for active tokens or tokens revoked within the 30-second grace window (`revokedAt >= now - 30s`). If revoked within grace window, issue new access token without failing or clearing cookies.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Add a grace window to refresh-token rotation so that a briefly superseded token is still accepted, preventing multi-tab logout."
- **Verify:** Calling `POST /auth/refresh` twice within 5 seconds using the same original refresh token succeeds both times without returning 401.
- **Notes:** Implemented 30-second token rotation grace window in `POST /auth/refresh`. Verified with integration tests in `public.test.ts`.

### T-04.2: Add single-flight token refresh queue and retry to AuthenticatedApiClient

- **Status:** done
- **Owner:** frontend
- **Depends on:** T-04.1
- **Files:**
  - `apps/frontend/src/apiClient.ts` (modified)
  - `apps/frontend/src/authSession.ts` (modified)
- **Intent:** Update `AuthenticatedApiClient.request()` and SSE streaming calls. When receiving a 401 error, queue the request behind a shared `refreshPromise`. If a refresh is already in-flight, await it; otherwise call `refreshAccessToken()`. If refresh succeeds, retry the original request once. If refresh fails, call `onSessionExpired()`.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Give the API client real 401 handling: a single-flight refresh shared across concurrent callers, one retry of the original request, and session expiry only when the refresh itself fails."
- **Verify:** Unit/integration test simulating 5 concurrent 401 API requests verifies only 1 network call to `/auth/refresh` occurs and all 5 API calls resolve with valid data.
- **Notes:** Implemented single-flight token refresh queue in `refreshAccessToken()` and transparent 401 retry with 1 retry attempt in `AuthenticatedApiClient.request()` and `streamJournalAnalysis()`.

---

## E-05: Household Profile Picker, In-App Switcher & Unconfigured Error UI

**Goal:** Create frontend UI components for local household profile selection/creation, in-app profile switching in the workspace header/settings, and the Configuration/Initialization Error panel when `APP_MODE` is unset or server initialization fails.

**Exit gate:** Frontend renders clear configuration fix instructions when `configured: false`, displays the profile picker in `local` mode when unauthenticated, auto-resumes the selected profile, and permits switching profiles from the header.

**Depends on:** E-04

### T-05.1: Build ConfigurationErrorPanel and ProfilePicker components

- **Status:** done
- **Owner:** frontend
- **Depends on:** E-04
- **Files:**
  - `apps/frontend/src/components/ConfigurationErrorPanel.tsx` (new)
  - `apps/frontend/src/components/ProfilePicker.tsx` (new)
- **Intent:** Build `ConfigurationErrorPanel` displaying step-by-step setup instructions (`APP_MODE=local` or `APP_MODE=hosted` in `.env`). Build `ProfilePicker` listing household profiles with an "Add Profile" modal/form (display name input, optional email).
- **ADRs:** [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — "Adopt Tailwind CSS and shadcn/ui patterns for frontend UI." [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Render a clear Configuration / Initialization Error UI with actionable resolution instructions."
- **Verify:** Component renders cleanly and handles form submission, error states, and keyboard navigation accessible.
- **Notes:** Built `ConfigurationErrorPanel` and `ProfilePicker` using Tailwind CSS and shadcn UI primitives with modal profile creation.

### T-05.2: Integrate profile switching and session initialization into App.tsx and WorkspaceShell

- **Status:** done
- **Owner:** frontend
- **Depends on:** T-05.1
- **Files:**
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/components/ProfileSwitcher.tsx` (new)
  - `apps/frontend/src/authSession.ts` (modified)
- **Intent:** Update `AppContent` session loader in `App.tsx` to inspect `session.configured` and `session.appMode`. If unconfigured, render `ConfigurationErrorPanel`. In `local` mode, if unauthenticated, render `ProfilePicker`. Add `ProfileSwitcher` dropdown to `WorkspaceShell` header allowing instant profile switching.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — "Preserve navigation context on route updates." [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Allow switching profiles directly from the workspace UI in local mode. Remember and auto-resume the last selected profile."
- **Verify:** User can switch profiles from the workspace header, reloading the page auto-resumes the chosen profile, and missing `APP_MODE` renders the setup instructions.
- **Notes:** Integrated `ConfigurationErrorPanel`, `ProfilePicker`, `ProfileSwitcher`, auto-resuming local profile sessions, and workspace header switcher in `App.tsx`.

---

## E-06: End-to-End Verification & Validation Suite

**Goal:** Execute full verification across both local and hosted deployment modes, ensuring all 13 spec acceptance criteria pass, typechecking succeeds, and test suites run cleanly.

**Exit gate:** All 13 acceptance criteria verified; `pnpm --filter api test` passes; `npx pnpm --filter frontend exec tsc --noEmit` passes with 0 errors.

**Depends on:** E-05

### T-06.1: Run comprehensive verification suite against local and hosted modes

- **Status:** done
- **Owner:** governance
- **Depends on:** E-05
- **Files:**
  - `apps/api/src/plugins/public.test.ts` (modified or new)
  - `apps/frontend/src/App.test.tsx` (modified or new)
- **Intent:** Verify all 13 acceptance criteria from Spec 0004: unset `APP_MODE` error UI, hosted mode 404 on `/auth/profiles`, local mode 404 on OAuth callbacks, auto-creation of "Primary User" on clean DB boot, synthetic email generation, cookie persistence across reloads, single-flight 401 refresh, and 30s token rotation grace window.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Validate full compliance with deployment mode security boundary and session durability."
- **Verify:** `pnpm test` and frontend typechecking pass 100% across the workspace.
- **Notes:** User completed comprehensive local and hosted verification successfully and confirmed the readiness-aware dev startup script works.

---

## E-07: Feature Closeout & Tech Debt Reconciliation

**Goal:** Reconcile finished implementation against GitHub issues, update tech debt documentation, and archive or close out plan artifacts.

**Exit gate:** `TD-001` resolved in the tech debt checklist, GitHub Issue #4 closed, TD-012 linked to GitHub Issue #21, and closeout recommendations logged.

**Depends on:** E-06

### T-07.1: Reconcile diff, resolve GitHub Issue #4 (TD-001), and perform closeout review

- **Status:** done
- **Owner:** closeout
- **Depends on:** T-06.1
- **Files:**
  - `docs/tech-debt/checklist.md` (modified)
  - `docs/plans/closed/0004-deployment-mode-identity-and-session-durability.md` (modified)
- **Intent:** Perform final closeout review of the session durability and deployment mode implementation. Close GitHub Issue #4 (`TD-001: phase out development-only demoAuth path`), mark TD-001 resolved in the tech debt checklist, and record any post-implementation ADR recommendations.
- **ADRs:** [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — "Governs closeout and tech debt reconciliation."
- **Verify:** Tech debt checklist updated, plan marked complete, GitHub Issue #4 closed, and TD-012 linked to GitHub Issue #21.
- **Notes:** Updated README changelog/setup guidance, refreshed schema documentation without creating a schema snapshot because no migration was introduced, marked TD-001 done in the tech debt checklist, added TD-012 for hosted organization onboarding, linked TD-012 to GitHub Issue #21, recorded ADR recommendations, and archived this completed plan under `docs/plans/closed/`. GitHub Issue #4 was closed after closeout.

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | `APP_MODE` unset in existing CI/CD or docker environment | Build or startup failure in unconfigured pipelines | coding | E-03 |
| R-2 | Developer local DB contains pre-`APP_MODE` user records | Pre-existing dev user must be seamlessly adopted as profile | database-design | E-02, E-03 |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-06 | Initial plan | Created from Spec 0004 |
