# ADR 0013: Deployment modes and passwordless local profiles

- Status: draft
- Date: 2026-09-06
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Configuring server environment or startup behavior.
- Designing or implementing authentication, session management, or user identification routes.
- Creating or selecting user profiles in local development or self-hosted desktop setups.
- Defining route registration or conditional auth features.
- Not applicable to internal JWT verification or resource-level authorization checks after a session has already been established.

## Context

- P/OS is designed for two primary deployment topologies:
  1. **Local mode (`local`):** Downloaded from GitHub and run locally on a personal or household machine.
  2. **Hosted mode (`hosted`):** Deployed as a cloud-hosted multi-tenant SaaS.
- In hosted mode, strict security is mandatory: multi-tenant isolation, real identity provider (OAuth) authentication, and 7-day sliding session durability.
- In local mode, the application relies on the operating system's login security. Forcing users to register Google OAuth applications or enter passwords to use a local app creates high friction with zero added security.
- However, local mode still requires multi-user identity separation so household members sharing a computer do not commingle their Journal entries or settings.
- Previously, the app attempted to serve local development via an unguarded `demoAuth` parameter on `GET /auth/session`. Simultaneously, session handling contained defects where `GET /auth/session` cleared the refresh token cookie on reload, causing repeated forced logouts.
- A clear security boundary is needed to separate hosted security requirements from local usability while ensuring sessions remain durable across page reloads in both modes.

## Decision Statement

Require an explicit `APP_MODE` environment variable (`local` or `hosted`) with validation at application startup. When `APP_MODE` is unspecified/invalid or any initialization failure occurs, the server responds with structured setup/error metadata and the UI renders an informative Configuration/Initialization Error panel with actionable resolution steps. In local mode, provide passwordless household profile selection and creation with long-lived session durability (365-day default), auto-resuming the last active profile. In hosted mode, enforce OAuth authentication with 7-day sliding session durability, and completely omit local profile and demo routes from application route registration.

## Decision Drivers

- **Fail-safe configuration:** An unset environment variable must fail to boot rather than risking an accidental open hosted deployment.
- **Zero-friction local setup:** Local clones must run without requiring external OAuth application credentials.
- **Household profile separation:** Multiple users on a single local instance must have isolated data scoped by user ID.
- **No fake security:** Local profiles shall not require passwords or PINs, as anyone with local machine access already has access to the database and filesystem.
- **Unified auth core:** Once established, both local profile sessions and OAuth sessions shall use identical JWTs, refresh tokens, and authorization checks.
- **Session durability:** Session state must reliably survive browser reloads and tab restarts in both modes.

## Options Considered

### Explicit APP_MODE with passwordless local profiles (Selected)

- Define `APP_MODE=local|hosted` with fail-fast startup.
- In `local` mode, register profile management endpoints (`GET /auth/profiles`, `POST /auth/profiles`, `POST /auth/profiles/select`). Omit OAuth endpoints.
- In `hosted` mode, register OAuth callback endpoints. Omit local profile endpoints (which return 404).
- Share a unified token issuance, refresh, and verification pipeline.

### Single hosted-only model with mock OAuth for dev

- Requires every local user to run a mock OAuth server or maintain `demoAuth` query flags.
- Confuses local single-user/household usability with SaaS deployment requirements.

### Optional PINs or passwords for local profiles

- Adds the illusion of security without actual protection on a local machine.
- Introduces credential recovery and password reset complexity for zero security gain.

## Do

- Require `APP_MODE` to be explicitly set to `local` or `hosted` on application boot.
- Return structured setup/error details from server session/status checks and render a clear Configuration / Initialization Error UI with actionable resolution instructions if `APP_MODE` is missing/invalid or any startup initialization step fails.
- Omit inactive mode routes from registration so they return 404 rather than 403 or disabled status.
- Generate a synthetic email (`<slug>@local.invalid`) when a local profile is created without an explicit email address.
- Auto-create a "Primary User" profile on clean database boot when running in `APP_MODE=local` with 0 existing users.
- Remember and auto-resume the last selected profile in local mode via persistent cookie/session state.
- Allow switching profiles directly from the workspace UI in local mode.
- Use a single source of truth for session lifetimes, defaulting to 365 days for local mode and 7 days for hosted mode.
- Repair `GET /auth/session` to verify refresh cookies on reload rather than clearing them.

## Do Not

- Provide a default for `APP_MODE` if omitted.
- Add passwords, PINs, or secret verification to local household profiles.
- Register or expose local profile endpoints or `demoAuth` paths in `hosted` mode.
- Create separate JWT payload formats or permission systems for local vs hosted users.
- Allow unauthenticated access to protected `/api/*` endpoints in either mode once booted.
