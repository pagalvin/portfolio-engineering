# Deployment Mode Identity and Session Durability

## Status

- Readiness: Ready for planning
- Owner: pending
- Date: 2026-09-06
- Source: [deployment-mode-identity-and-session-durability-feature-brief](../brainstorming/deployment-mode-identity-and-session-durability-feature-brief.md)

## Summary

Introduce an explicit server deployment mode (`APP_MODE=local|hosted`) with passwordless household profiles for local clones and strict OAuth-backed multi-tenant authentication for hosted deployments, while repairing session and token handling so user sessions reliably survive page reloads, tab restarts, and idle periods in both modes.

## Business objective

Establish P/OS as a credible application across both of its primary distribution channels—local self-hosted/desktop setups and cloud-hosted multi-tenant SaaS—without maintaining divergent identity or authorization core logic.

This feature ensures P/OS can:

- run out-of-the-box immediately after a `git clone` without requiring OAuth client registration or passwords;
- isolate private Journal data among household members sharing a local computer;
- enforce OAuth-backed multi-tenant security in cloud-hosted mode;
- prevent accidental exposure of local profile or demo endpoints in hosted deployments via fail-fast server startup validation;
- maintain durable, predictable user sessions across page reloads and browser restarts;
- keep all downstream API endpoints and authorization checks identical across both deployment modes.

## Problem / opportunity

1. **Session destruction on page reload:** `GET /auth/session` does not inspect refresh token cookies on unauthenticated calls; it returns `401` and actively clears the refresh token cookie, destroying valid sessions on reload.
2. **Unreachable frontend recovery:** `App.tsx` returns early on `401` responses from `/auth/session`, preventing the frontend token refresh recovery logic from running.
3. **Missing API client retry:** `AuthenticatedApiClient` calls `onSessionExpired()` immediately upon receiving a `401` rather than attempting a single-flight token refresh and retrying the request.
4. **Token rotation race condition:** Refresh token rotation revokes old tokens immediately without a grace window, causing multi-tab users to get logged out if parallel requests attempt refresh.
5. **Hardcoded token lifetimes:** Token expiration and cookie `maxAge` values are hardcoded in separate places and prone to drift.
6. **Local installation friction:** Self-hosted users are forced to create external OAuth clients and enter credentials to use an app running on their own machine.
7. **Ungarded development auth path:** The existing `demoAuth` parameter on `GET /auth/session` provides an unguarded bypass to mint authenticated sessions without mode checks.

## Desired outcomes

- A user cloning the repository and running in `APP_MODE=local` reaches a working workspace instantly with zero OAuth configuration.
- Multiple household members can create and switch between distinct profiles on a local instance, maintaining isolated Journals and settings.
- In `APP_MODE=hosted`, local profile endpoints and `demoAuth` parameters are not registered and return `404`.
- The application fails to boot if `APP_MODE` is unset or invalid.
- User sessions in both modes survive page reloads, browser restarts, and tab switching.
- Concurrent API requests in multiple tabs perform single-flight token refreshes without logging the user out.
- Access token and refresh token lifetimes are driven by a single configurable source of truth.

## Scope

### Included

- **Server Boot & Mode Validation:** Fail-fast validation of `APP_MODE` (`local` or `hosted`). Conditional route registration ensuring inactive mode endpoints return `404`.
- **Local Household Profiles:** Profile listing (`GET /auth/profiles`), creation (`POST /auth/profiles`), and selection (`POST /auth/profiles/select`).
- **Default Profile Bootstrap:** Auto-creating a "Primary User" and default organization ("Local Portfolio") on clean database boot in local mode.
- **Auto-Resume & Adoption:** Auto-resuming the last active profile in local mode, and auto-adopting existing pre-`APP_MODE` database users.
- **In-App Profile Switcher:** UI for switching profiles directly from the workspace header or settings shell.
- **Session Core Repair:**
  - Updating `GET /auth/session` to inspect and validate refresh cookies before declaring unauthenticated state.
  - Updating frontend session initialization in `App.tsx` to handle token refresh properly.
  - Adding single-flight refresh and request retry to `AuthenticatedApiClient` on `401` responses.
  - Adding a rotation grace window for refresh tokens to support multi-tab usage.
- **Configurable Session Lifetimes:** Environment-driven session duration configuration defaulting to 365 days for local mode and 7 days for hosted mode.
- **UI Header Cleanup:** Removal of the permanent scaffold hero banner and `demoAuth` text from the main layout shell.

### Non-goals

- Passwords, PINs, or local-mode secret verification.
- Account migration between local mode and hosted mode.
- Per-profile database encryption or hiding database files on disk from local system administrators.
- Session revocation UI ("sign out all devices") in hosted mode (deferred to Issue [#20](https://github.com/pagalvin/portfolio-engineering/issues/20)).
- Additional OAuth providers beyond Google, Microsoft, and Facebook.

## Functional requirements

### 1. Application Mode Enforcement (`APP_MODE`) & Initialization Error UI

1.1. On application startup, the server MUST validate the `APP_MODE` environment variable and perform core subsystem initialization.
1.2. Valid `APP_MODE` values MUST be exactly `local` or `hosted` (case-sensitive, trimmed).
1.3. If `APP_MODE` is unset, empty, or invalid, or if any server initialization failure occurs (such as database connection or secret configuration errors):
  - The server MUST enter an unconfigured/initialization-failed state and respond to session checks (`GET /auth/session`) with an `UnconfiguredSessionResponse` payload (`authenticated: false, configured: false`) containing an error message and actionable resolution steps.
  - The frontend MUST render a dedicated Configuration / Initialization Error status panel displaying the exact error message and step-by-step instructions on how to resolve the issue (e.g., setting `APP_MODE=local` or `APP_MODE=hosted` in `.env` and restarting the app).
1.4. The server MUST include `appMode` (`'local'` | `'hosted'`) in successful session responses (`SessionResponse`), enabling the frontend to dynamically discover the active deployment mode from the server rather than rely on client build-time environment variables.
1.5. In `APP_MODE=local`, the server MUST register local profile routes (`/auth/profiles*`) and MUST NOT register OAuth callback routes.
1.6. In `APP_MODE=hosted`, the server MUST register OAuth callback routes and MUST NOT register local profile routes or accept `demoAuth` parameters (returning `404`).

### 2. Local Household Profiles & API Contract

2.1. In `APP_MODE=local`, the server MUST expose profile management endpoints:
  - `GET /auth/profiles`: List all available household profiles in the instance (`id`, `displayName`, `email`, `lastLoginAt`).
  - `POST /auth/profiles`: Create a new household profile requiring `{ displayName: string, email?: string }`.
  - `POST /auth/profiles/select`: Select profile by `{ profileId: string }`, setting a persistent profile cookie, issuing access/refresh tokens, and returning an `AuthenticatedSessionResponse`.
2.2. Creating a profile MUST require a display name. Email is optional; if omitted, a synthetic email formatted as `<slug>@local.invalid` MUST be generated to satisfy data model unique constraints.
2.3. When selecting a profile, the server MUST issue standard JWT access and refresh tokens matching the structure used by OAuth callback responses.
2.4. When booting a local database with 0 users, the server MUST auto-create a default organization ("Local Portfolio") and primary profile ("Primary User"), establish a session, and allow immediate workspace access.
2.5. When booting an existing database in local mode with pre-existing users, the server MUST adopt all existing records and default to the first user if no profile selection cookie exists.
2.6. Local mode MUST store the last selected profile identifier in a persistent cookie (`portfolio_engineering_profile_id`) and auto-resume that session on subsequent visits.
2.7. The frontend MUST provide a profile-switching control in the workspace header/settings to switch between household profiles.

### 3. Session Core, Token Refresh Repair & Rotation Grace Window

3.1. `GET /auth/session` MUST inspect the refresh-token cookie. If a valid refresh token exists, it MUST return an authenticated session response rather than returning `401` or clearing the cookie.
3.2. `GET /auth/session` MUST clear the refresh cookie ONLY when no refresh token is provided, or when the refresh token is invalid or expired.
3.3. `AuthenticatedApiClient` MUST catch `401 Unauthorized` responses, perform a single-flight token refresh call to `POST /auth/refresh`, update the in-memory access token, and retry the failed request once before throwing an error or triggering `onSessionExpired()`.
3.4. Refresh token rotation (`POST /auth/refresh`) MUST incorporate a grace window (default 30 seconds) using a `revokedAt` timestamp on the `RefreshToken` record. If a refresh request is received for a token revoked within the grace window, the server MUST return active valid session tokens rather than rejecting the request with `401`, preventing multi-tab race conditions.

### 4. Configurable Lifetimes & Single Source of Truth

4.1. Token expiration values MUST be derived from a single configurable source in `@portfolio-engineering/auth`.
4.2. Refresh token JWT expiration (`expiresIn`) and HTTP cookie `maxAge` MUST be calculated from the same duration value (`SESSION_TTL_DAYS`).
4.3. Access token JWT expiration MUST be calculated from `ACCESS_TOKEN_TTL_MINUTES` (defaulting to 15 minutes).
4.4. Default session duration (`SESSION_TTL_DAYS`) MUST be 365 days in `APP_MODE=local` and 7 days in `APP_MODE=hosted`, configurable via environment variables.

## Constraints / applicable ADRs

- **ADR-0001 Organization-Aware Data Access:** All household profiles MUST remain scoped within an organization (`Organization` and `User` models).
- **ADR-0002 URL-Addressable Routing:** Profile selection and navigation MUST preserve URL continuity and browser history.
- **ADR-0004 React Router:** Frontend routing and navigation MUST use React Router.
- **ADR-0005 Tailwind CSS and shadcn/ui:** Profile management UI MUST conform to established Tailwind CSS styling patterns.
- **ADR-0013 Deployment Modes and Passwordless Local Profiles:** Governs the security boundary, startup validation, passwordless design, and single session pipeline core.

## UX handoff context

- **Target users:** Local self-hosters/household members sharing a desktop, and SaaS cloud users.
- **User goals:** Access their personal Journal and portfolio without unnecessary logins or unexpected logouts.
- **Key workflows:**
  - *Local initial run:* Clone repo -> start app -> lands on workspace as "Primary User".
  - *Local household member addition:* Settings/Header -> Switch/Add Profile -> Enter Display Name -> Switch context.
  - *Hosted sign-in:* Unauthenticated screen -> Google/Microsoft/FB OAuth -> Authenticated workspace.
- **Design constraints:** Clean header layout (scaffold hero banner removed).

## Assumptions

- Operating system login security protects local machine database and filesystem access.
- Local profiles do not require passwords, PINs, or secondary security verification.
- `APP_MODE` environment variable will be supplied in `.env`, Docker environments, and CI/CD pipelines.

## Open questions

*None. All design decisions and open questions were resolved in ADR-0013 and the feature brief.*

## Definition of done

- If `APP_MODE` is missing/invalid or server initialization fails, the server responds with structured setup details and the UI renders a clear error panel with resolution instructions.
- Clean `git clone` with `APP_MODE=local` boots directly into a working workspace as "Primary User".
- In `APP_MODE=hosted`, local profile endpoints and `demoAuth` parameters return `404`.
- Reloading the page or restarting the browser in either mode maintains the authenticated session.
- Concurrent API calls across multiple browser tabs do not trigger unwanted logouts.
- `AuthenticatedApiClient` automatically refreshes tokens on `401` and retries requests transparently.
- All code typechecks, builds, and unit/integration tests pass.

## Acceptance criteria

### Server Mode Boot, Initialization & Error UI
1. Given `APP_MODE` is unset or invalid, when a user opens the app, then the UI renders a Configuration Error panel explaining that `APP_MODE` is required and detailing how to set `APP_MODE=local` or `APP_MODE=hosted` in `.env`.
2. Given any server initialization failure (such as database or missing secret errors), when a user opens the app, then the UI renders an Initialization Error panel with the specific failure reason and actionable resolution steps.
3. Given `APP_MODE=hosted`, when a client sends a request to `/auth/profiles`, then the server returns `404 Not Found`.
4. Given `APP_MODE=hosted`, when a client passes `?demoAuth=authenticated` to `/auth/session`, then the parameter is ignored and treated as standard hosted session lookup.
5. Given `APP_MODE=local`, when a client attempts an OAuth callback route, then the server returns `404 Not Found`.

### Local Profile Lifecycle
6. Given a fresh database in `APP_MODE=local`, when the server boots, then it automatically creates "Local Portfolio" organization and "Primary User".
7. Given `APP_MODE=local`, when a user creates a profile with name "Alice" and no email, then a profile is created with email `alice@local.invalid`.
8. Given `APP_MODE=local`, when a user selects a profile, then standard JWT access and refresh tokens are issued and saved in session cookies/memory.
9. Given an existing database in `APP_MODE=local` with existing users and no active profile cookie, when the app loads, then it adopts all existing users and auto-selects the first profile.

### Session Durability & Repair
10. Given a user with a valid refresh cookie, when they refresh the browser page, then `GET /auth/session` verifies the cookie, returns `authenticated: true`, and DOES NOT clear the cookie.
11. Given an expired access token and a valid refresh cookie, when the frontend makes an API call, then `AuthenticatedApiClient` calls `POST /auth/refresh`, receives a new access token, and completes the original API call seamlessly.
12. Given two browser tabs making parallel API requests with an expired access token, when both encounter `401`, then a single refresh request is executed and both API calls succeed without logging out the user.
13. Given a refresh token that was rotated within the 30-second grace window, when a secondary concurrent request calls `POST /auth/refresh` using that token, then the server accepts the request and returns active session tokens rather than returning `401`.
