# Debugging Log: 0004 Deployment Mode Identity and Session Durability

- Spec: [spec](../specs/0004-deployment-mode-identity-and-session-durability.md)
- Plan: [plan](../plans/0004-deployment-mode-identity-and-session-durability.md)
- Status: active

## Reusable lessons

- Server-owned deployment settings must be documented as server-side environment variables. Do not suggest `VITE_` prefixes for values read by Fastify, because Vite-prefixed variables are client build-time values and will not configure the API process.
- Frontend session bootstrap should tolerate a brief dev-server/API startup race. Vite may serve the React app before Fastify is listening, producing transient `502` proxy responses that should be retried before showing a terminal session error.
- Frontend hosted-auth effects must be gated on `session.appMode === 'hosted'`. Checking only `authenticated === false` causes local unauthenticated profile-selection states to initialize OAuth UI incorrectly.
- Frontend hosted sign-in UI should be rendered only from an explicit hosted-mode branch. A broad unauthenticated fallback can mask missing/undetermined session mode as a hosted login requirement.
- Frontend profile creation handlers must consume the actual API response contract. If `POST /auth/profiles` returns `{ profiles }`, do not assume `{ profile }`; otherwise `undefined` can be added to component state and crash later renders.
- Authenticated frontend app state should always provide an `AuthenticatedApiClient` to protected pages. The client owns lazy refresh when the in-memory access token is missing, so pages should not be stranded behind a null context after session recovery.
- Do not send `Content-Type: application/json` on bodyless refresh requests. Fastify can reject an empty JSON request before route logic runs, preventing token refresh and cascading into false session-expiry UI.
- Organization-owned settings can be shared intentionally within an organization, but hosted onboarding must ensure unrelated users are not placed into the same default organization implicitly.
- Combined dev startup should be readiness-aware. Starting Vite and Fastify in parallel lets the browser hit proxied API routes before the API is listening; start the API first, wait for `/health`, then start the frontend.
- Hosted mode must reject passwordless local-profile sessions at every auth boundary. Refresh-token session recovery, refresh rotation, and protected API access all need the same mode eligibility check, otherwise switching from local to hosted can silently carry a local session forward.

## Issue history

### 001: Frontend reports 502 while API is still unavailable during startup

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: minor
- Reported behavior: Frontend session loader rendered "Unable to load the current session (502 Bad Gateway)" on app startup.
- Evidence and reproduction: Vite logged `http proxy error: /auth/session` with `connect ECONNREFUSED 127.0.0.1:3001`, indicating the frontend proxy could not connect to the Fastify API target. Direct probes initially could not connect to `http://127.0.0.1:3001/health` or `/auth/session`. A later isolated API startup attempt failed with `EADDRINUSE`, proving the original dev API process had subsequently bound the port. Direct probes then returned `200 OK` for `/health` and an `UnconfiguredSessionResponse` for `/auth/session`.
- Affected areas: `apps/frontend/vite.config.ts`, `apps/api/src/server.ts`, `apps/api/src/app.ts`, frontend session initialization.
- Contract and ADR review: ADR 0013 requires a structured unconfigured response when `APP_MODE` is missing or initialization fails. The API satisfies that once reachable. The 502 is a frontend dev-proxy symptom that occurs before the API is listening, not the intended application-level unconfigured state.
- Root cause: The frontend dev server was ready and requested `/auth/session` before the API was listening on `127.0.0.1:3001`. Once the API was running, the real application state was `APP_MODE` unset, which correctly returned `authenticated: false`, `configured: false`.
- Resolution: No code change was made for this diagnostic issue. User should refresh once the API is listening and set `APP_MODE=local` or `APP_MODE=hosted` in `.env`, then restart the dev process to exit the unconfigured state.
- Verification: `curl -i http://127.0.0.1:3001/health` returned `200 OK` with `{"status":"ok"}`. `curl -i http://127.0.0.1:3001/auth/session` returned `200 OK` with `{"authenticated":false,"configured":false,"appMode":null,...}`.
- Follow-up: Consider adding frontend retry/backoff for session bootstrap if repeated startup-race 502s remain disruptive.

### 002: APP_MODE setup copy confused with Vite client environment naming

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: cosmetic
- Reported behavior: Configuration panel instructed the user to set `APP_MODE`, and the user questioned whether it should instead say `VITE_APP_MODE`.
- Evidence and reproduction: The API reads `process.env.APP_MODE` via `getAppMode()` and loads the root `.env` before Fastify boot. The frontend only renders the server-provided `UnconfiguredSessionResponse`; it does not own deployment mode selection.
- Affected areas: `apps/api/src/lib/localAuthBootstrap.ts`, `apps/frontend/src/components/ConfigurationErrorPanel.tsx`.
- Contract and ADR review: ADR 0013 requires the server to own explicit deployment mode validation and the frontend to dynamically discover the active mode from server session responses. `VITE_APP_MODE` would violate that separation because it is a frontend build-time variable.
- Root cause: The text was technically correct but did not explicitly say `APP_MODE` is server-side and must not be prefixed with `VITE_`.
- Resolution: Updated server-provided and frontend fallback copy to say server-side `APP_MODE`, explicitly warn not to use `VITE_`, and corrected the fallback database variable reference to `DATABASE_URL`.
- Verification: `npx pnpm --filter @portfolio-engineering/api typecheck` passed. `npx pnpm --filter @portfolio-engineering/frontend typecheck` passed.
- Follow-up: None.

### 003: Root .env updated but running API still reports APP_MODE unset

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: minor
- Reported behavior: User added `APP_MODE` to `.env`, but the frontend still rendered the unconfigured session message.
- Evidence and reproduction: Safe diagnostic confirmed the repository root `.env` exists and contains `APP_MODE=hosted`. A direct request to `http://127.0.0.1:3001/auth/session` still returned `{"authenticated":false,"configured":false,"appMode":null,...}`.
- Affected areas: Local developer environment and API process lifecycle.
- Contract and ADR review: ADR 0013 behavior is correct once the API process loads `APP_MODE`; the issue is process lifecycle/configuration, not a contract change.
- Root cause: The currently running API process was started before `.env` contained `APP_MODE`, and `tsx watch` does not automatically restart when the root `.env` file changes.
- Resolution: Stop the running `npm run dev` process completely and start it again so the API process reloads root `.env`. If the user wants local passwordless household profiles, use `APP_MODE=local`; `APP_MODE=hosted` enables hosted OAuth mode.
- Verification: Diagnostic confirmed root `.env` contains `APP_MODE=hosted` while live `/auth/session` still reports `appMode:null`, demonstrating the running API has not reloaded the changed environment.
- Follow-up: None.

### 004: Stale API process continued serving old unconfigured state after restart

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: minor
- Reported behavior: User fully stopped and restarted the dev command, but the frontend still rendered the unconfigured session error.
- Evidence and reproduction: Root `.env` contained `APP_MODE=hosted`. A fresh `tsx` diagnostic importing `loadWorkspaceEnv()` and `getAppMode()` returned `LOADED_APP_MODE=hosted`, proving the source env loader works. The live API at `http://127.0.0.1:3001/auth/session` still returned `{"authenticated":false,"configured":false,"appMode":null,...}` with the previous message text. TCP port `3001` was held by PID `29168`, a `node.exe`/`tsx` process from this worktree.
- Affected areas: Local developer process lifecycle.
- Contract and ADR review: ADR 0013 remains satisfied by the source code path. The live response came from an older/stale process and did not reflect the current `.env` or latest source copy.
- Root cause: An older API process remained bound to port `3001`, so restarted frontend traffic continued to reach the stale server instance instead of a newly loaded API process.
- Resolution: Terminate the stale process bound to port `3001`, then restart `npm run dev`. If local passwordless profile mode is desired, change root `.env` from `APP_MODE=hosted` to `APP_MODE=local` before restarting.
- Verification: Safe diagnostics confirmed `.env` and the source loader resolve `APP_MODE=hosted`, while the live process on port `3001` still reports `appMode:null`; this isolates the problem to the stale process.
- Follow-up: None.

### 005: Frontend session loader stuck on transient startup 502

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: minor
- Reported behavior: After a clean restart, the frontend still showed "Unable to load the current session (502 Bad Gateway)" while the API was still compiling/starting. Hosted and local modes appeared broken.
- Evidence and reproduction: Dev logs showed Vite became ready before the API emitted a listening message. Direct startup using `corepack pnpm --filter @portfolio-engineering/api exec tsx src/server.ts` successfully listened on `127.0.0.1:3001` with `APP_MODE=local`, proving the API can boot once started. The frontend made a single `/auth/session` request during this window and rendered the 502 as a terminal error.
- Affected areas: `apps/frontend/src/App.tsx`.
- Contract and ADR review: ADR 0013 requires the frontend to render the server-provided configuration state when the server is reachable. Retrying transient proxy failures preserves that contract and avoids confusing dev startup races with real configuration failures.
- Root cause: The session loader had no retry/backoff for transient `502`, `503`, or `504` startup responses from the Vite proxy.
- Resolution: Added bounded session-bootstrap retry delays before treating retriable proxy/server-unavailable statuses or transient fetch failures as terminal errors.
- Verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed.
- Follow-up: None.

### 010: Journal access cascaded into configuration error after bodyless refresh failed

- Date: 2026-09-06
- Status: resolved
- Environment: runtime
- Severity: major
- Reported behavior: After local profile selection, opening Journal eventually displayed the Configuration Error panel stating the frontend could not determine API mode.
- Evidence and reproduction: Direct API flow proved selected profile access tokens can read `/api/journal/entries` successfully. A bodyless `POST /auth/refresh` probe without the frontend request shape initially failed when the request sent an inappropriate content type, while a corrected bodyless refresh without `Content-Type` returned `200 OK` with an access token. Code review showed `refreshAccessToken()` sent `Content-Type: application/json` without a request body, and `handleSessionExpired()` set `session` to `null`, which fell through to the unknown-mode configuration panel.
- Affected areas: `apps/frontend/src/authSession.ts`, `apps/frontend/src/App.tsx`.
- Contract and ADR review: ADR 0013 requires durable refresh-token session recovery in local and hosted modes. A rejected refresh request broke that durability and produced misleading configuration UI.
- Root cause: The frontend refresh call advertised JSON but sent no body, allowing Fastify/content parsing to reject the request before refresh logic. The subsequent API-client session-expiry callback erased known app mode by setting `session` to `null`.
- Resolution: Removed the JSON content type from bodyless `/auth/refresh` calls. Updated session-expiry handling to preserve the previous known app mode and render the correct local profile picker or hosted sign-in path rather than an initialization/configuration error.
- Verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed. Bodyless `/auth/refresh` with a selected-profile cookie returned `200 OK` and an access token.
- Follow-up: None.

### 011: Hosted user appeared in same organization as local household profiles

- Date: 2026-09-06
- Status: deferred
- Environment: runtime
- Severity: major
- Reported behavior: Local profiles such as Paul Local and Alice could see AI/system settings originally created while signed in as `galvin.paul@gmail.com`.
- Evidence and reproduction: Static review showed Journal data is scoped by `organizationId` and `userId`, while `AiConnection` records are organization-owned and route/store access filters by `organizationId`. Local bootstrap can adopt the legacy development organization when populated, and hosted OAuth currently supports default organization slug/name configuration rather than a user-facing organization onboarding flow.
- Affected areas: `apps/api/src/lib/localAuthBootstrap.ts`, `apps/api/src/plugins/ai.ts`, `packages/database/src/aiConnectionStore.ts`, hosted onboarding requirements.
- Contract and ADR review: Sharing AI settings within the same organization is acceptable for current behavior. The unresolved issue is that unrelated hosted users should not be implicitly placed into a shared/default organization without picking or creating one.
- Root cause: Hosted onboarding and organization membership selection are under-specified for multi-tenant production use. The current default organization path is convenient for development but can conflate unrelated hosted identities with organization-owned settings.
- Resolution: No code change for this issue. Added tech debt item `TD-012` to track hosted onboarding organization selection and isolation checks.
- Verification: Documentation-only tech debt entry added; no runtime validation required.
- Follow-up: Route TD-012 to business requirements/ADR/design before implementation.

### 012: Repeated Vite proxy ECONNREFUSED after APP_MODE changes

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: minor
- Reported behavior: Switching root `.env` between `APP_MODE=hosted` and `APP_MODE=local` led to repeated Vite proxy `ECONNREFUSED 127.0.0.1:3001` messages for `/auth/session`.
- Evidence and reproduction: Safe diagnostics showed root `.env` currently contains `APP_MODE=local` and no process was listening on `127.0.0.1:3001` before direct startup. Running `corepack pnpm --filter @portfolio-engineering/api exec tsx src/server.ts` started Fastify and logged `Initializing application in APP_MODE=local` plus `Server listening at http://127.0.0.1:3001`. Running `corepack pnpm --filter @portfolio-engineering/api dev` also started and listened successfully.
- Affected areas: Local developer process lifecycle, Vite dev proxy.
- Contract and ADR review: ADR 0013 mode handling is not implicated by this diagnostic result; API startup succeeds with the current mode when launched directly.
- Root cause: The observed frontend errors mean no API listener was available when Vite proxied `/auth/session`. Direct API startup succeeds, so this is currently isolated to dev-process timing/lifecycle rather than hosted/local mode parsing or Fastify boot failure.
- Resolution: No code change. Use direct API startup or wait for the `Server listening at http://127.0.0.1:3001` log before refreshing the frontend when switching modes.
- Verification: Both direct API commands started and listened successfully with the current root `.env`.
- Follow-up: Consider improving the root dev script or frontend startup state if the combined `npm run dev` workflow continues to open the frontend before the API is ready.

### 013: Root dev script started frontend before API readiness

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: minor
- Reported behavior: User wanted a single startup command, but root `npm run dev` consistently produced Vite proxy `ECONNREFUSED` errors because Vite became ready before Fastify listened on port `3001`.
- Evidence and reproduction: Root `package.json` ran `dev:api` and `dev:frontend` in parallel via `concurrently`. Prior diagnostics repeatedly showed Vite serving on `5173` before the API listener existed on `3001`.
- Affected areas: `package.json`, `scripts/dev.mjs`.
- Contract and ADR review: ADR 0013 mode behavior is unaffected; this is local developer startup orchestration.
- Root cause: The root dev script had no readiness gate between API startup and frontend startup.
- Resolution: Replaced root `dev` with a native Node orchestrator that runs package builds, starts the API, waits for `http://127.0.0.1:3001/health`, and only then starts the frontend. Preserved the old parallel behavior as `dev:parallel`.
- Verification: `node --check scripts/dev.mjs` passed. Full smoke test was not run because ports `3001` and `5173` were already occupied by active dev processes.
- Follow-up: Run `npm run dev` from a clean process state to confirm API health is reached before Vite serves the frontend.

### 014: Hosted mode accepted local profile session instead of requiring OAuth

- Date: 2026-09-06
- Status: resolved
- Environment: runtime
- Severity: critical
- Reported behavior: In hosted mode, the app did not require Google sign-in or offer a different-account path after previously using local profile mode.
- Evidence and reproduction: Code review showed `/auth/session` and `/auth/refresh` accepted any valid refresh token regardless of whether the user had an OAuth provider identity. Protected routes also accepted any valid access token if the user existed. Local passwordless profiles have no `OAuthProvider` rows but share the same JWT/refresh-token format.
- Affected areas: `apps/api/src/plugins/public.ts`, `apps/api/src/plugins/protected.ts`, `apps/api/src/plugins/public.test.ts`, `apps/frontend/src/authSession.ts`, `apps/frontend/src/components/ProfileSwitcher.tsx`, `apps/frontend/src/App.tsx`.
- Contract and ADR review: ADR 0013 requires hosted mode to enforce OAuth authentication and omit local profile/demo paths. Accepting a local passwordless session after switching to hosted mode violated that boundary.
- Root cause: Session tokens did not encode or check the deployment mode that issued them, and hosted-mode session recovery did not verify that the resolved user had an OAuth provider identity.
- Resolution: Added hosted-mode eligibility checks so hosted `/auth/session`, `/auth/refresh`, and protected `/api/*` reject users without OAuth provider identities. Added `/auth/logout` to clear refresh/profile cookies and revoke the active refresh token when available. Added a hosted header "Use another account" action that calls logout and returns the user to hosted sign-in.
- Verification: `corepack pnpm --filter @portfolio-engineering/api test` passed. `corepack pnpm typecheck` passed.
- Follow-up: Hosted onboarding organization selection remains tracked by `TD-012`.

### 008: Profile creation appended undefined and crashed ProfilePicker

- Date: 2026-09-06
- Status: resolved
- Environment: runtime
- Severity: major
- Reported behavior: After creating a new local profile, the frontend crashed with `TypeError: Cannot read properties of undefined (reading 'displayName')` in `ProfilePicker.tsx`.
- Evidence and reproduction: Browser and Vite logs pointed to `ProfilePicker.tsx` while mapping `profiles` and reading `profile.displayName`. Code review showed `ProfilePicker` parsed `POST /auth/profiles` as `{ profile: HouseholdProfile }`, but the server route and validation schema return `ProfilesResponse` as `{ profiles: HouseholdProfile[] }`.
- Affected areas: `apps/frontend/src/components/ProfilePicker.tsx`, `apps/api/src/plugins/public.ts`, `packages/validation/src/auth.ts`, `packages/shared-types/src/auth.ts`.
- Contract and ADR review: ADR 0013 requires local profile creation and selection. The server-side profiles response contract was consistent with shared validation, but the frontend consumed the wrong shape.
- Root cause: Cross-layer response mismatch introduced in the frontend profile creation handler. The handler appended `data.profile`, which was `undefined`, into React state. The next render attempted to access `undefined.displayName`.
- Resolution: Updated `ProfilePicker` to consume `ProfilesResponse`, replace local state with the returned `profiles` list, identify the newly created profile by comparing IDs from the prior state, and fail explicitly if no profile is returned.
- Verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed.
- Follow-up: Consider adding a focused frontend test for local profile creation once a frontend test runner is available.

### 009: Journal page rendered not-authenticated state after local profile selection

- Date: 2026-09-06
- Status: resolved
- Environment: runtime
- Severity: major
- Reported behavior: After selecting/creating a local profile and entering the workspace, the Journal page rendered "Not authenticated. Please sign in to use the journal."
- Evidence and reproduction: `JournalPage` renders that message only when `ApiClientContext` is null. Direct API probes confirmed `/auth/profiles/select` returns an authenticated local session and includes an `x-dev-access-token` header plus cookies. Code review showed session recovery only set `apiClient` when an access token header or refresh response was observed, even though `AuthenticatedApiClient` can now perform lazy single-flight refresh if no in-memory token is present.
- Affected areas: `apps/frontend/src/App.tsx`, `apps/frontend/src/JournalPage.tsx`.
- Contract and ADR review: ADR 0013 requires local profile sessions to use the same protected API flow after selection. A null client context prevented authenticated local sessions from reaching protected Journal APIs.
- Root cause: Authenticated session state and API-client provisioning could diverge. The app could render the workspace for an authenticated session while leaving `ApiClientContext` null if immediate access-token restoration did not complete as expected.
- Resolution: Updated authenticated session loading to always create and provide an `AuthenticatedApiClient` once the server reports an authenticated session. The client handles missing in-memory access tokens by refreshing on demand.
- Verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed.
- Follow-up: None.

### 007: Broad unauthenticated fallback still rendered hosted login copy

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: major
- Reported behavior: User still saw the hosted "Please log in" Google sign-in panel while expecting local household profile selection.
- Evidence and reproduction: Live API response from `http://127.0.0.1:3001/auth/session` returned `200 OK` with `{"authenticated":false,"configured":true,"appMode":"local",...}`. Served Vite source included the local profile picker branch and the hosted OAuth effect guard. Code review showed the final render branch was still a broad `else` that rendered hosted Google sign-in for any non-loading, non-error, non-authenticated, non-local state, including null or undetermined session mode.
- Affected areas: `apps/frontend/src/App.tsx`.
- Contract and ADR review: ADR 0013 requires hosted OAuth UI only in hosted mode and local profile selection in local mode. Rendering hosted login from an undetermined fallback is misleading and violates the intended mode-specific UX.
- Root cause: The content render tree still used a catch-all unauthenticated branch for hosted Google sign-in rather than requiring `session.appMode === 'hosted'`.
- Resolution: Changed the hosted Google sign-in panel to render only when `session?.appMode === 'hosted'`. Added an explicit configuration/error panel fallback when the frontend cannot determine API mode.
- Verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed.
- Follow-up: None.

### 006: Local mode briefly rendered hosted Google sign-in and then startup 502

- Date: 2026-09-06
- Status: resolved
- Environment: dev
- Severity: major
- Reported behavior: With `APP_MODE=local`, the UI first rendered "Please log in" with Google sign-in copy, then flipped to "Unable to load the current session (502 Bad Gateway)".
- Evidence and reproduction: Direct API probes showed no listener on `127.0.0.1:3001` during the failing state. Running the API directly with `corepack pnpm --filter @portfolio-engineering/api exec tsx src/server.ts` successfully logged `Initializing application in APP_MODE=local` and listened on `127.0.0.1:3001`. Direct requests then returned `200 OK` for `/health`, `200 OK` for `/auth/session` with `{"authenticated":false,"configured":true,"appMode":"local",...}`, and `200 OK` for `/auth/profiles` with household profiles. Code review showed the Google sign-in effect in `App.tsx` only checked `session?.authenticated === false`, not `session.appMode === 'hosted'`.
- Affected areas: `apps/frontend/src/App.tsx`.
- Contract and ADR review: ADR 0013 requires local unauthenticated users to select a household profile and hosted users to use OAuth. Rendering Google sign-in in local mode violates that mode boundary. Retrying transient startup proxy failures remains consistent with rendering server-provided mode state once the API is reachable.
- Root cause: Two frontend defects combined: OAuth initialization was not gated to hosted mode, and the session bootstrap retry window was too short for the full `npm run dev` startup path where Vite can serve before the API finishes validation/typecheck/watch startup.
- Resolution: Gated Google sign-in initialization on `session.appMode === 'hosted'` and extended bounded session bootstrap retries for transient `502`, `503`, `504`, and fetch failures.
- Verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed.
- Follow-up: None.
