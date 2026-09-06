# Deployment Mode Identity and Session Durability Feature Brief

- Status: draft
- Date: 2026-09-06
- Source: user brainstorming session prompted by repeated forced re-authentication during local development

## Summary

Make P/OS aware of how it is deployed, and make sessions survive normal use.

P/OS is meant to run in two very different ways. In **local mode**, a user clones the repository from GitHub and runs the app on their own machine; there is no meaningful attacker to defend against, but a household may contain several people who each want their own Journal. In **hosted mode**, P/OS is a multi-tenant SaaS with strict security requirements and OAuth-backed identity.

Today the app only supports the hosted shape. It forces OAuth sign-in for every user, and it does not currently keep anyone signed in reliably even when they do sign in. This brief covers both halves: introducing an explicit deployment mode with password-free local household profiles, and repairing the session and token handling that currently ejects users back to the sign-in screen.

## Business objective

Make P/OS credible in both of its intended distribution channels without maintaining two divergent identity systems.

This feature should prove that P/OS can:

- run immediately after a `git clone` without requiring a user to register an OAuth application;
- separate several household members' private data on a shared machine;
- enforce genuine authentication when deployed as a hosted service;
- keep a signed-in user signed in for a configurable, predictable period;
- express the difference between these deployments as one explicit, auditable configuration decision rather than scattered conditionals.

## Problem / opportunity

### Sessions do not currently survive a page reload

The single largest defect is in the `GET /auth/session` endpoint. It never inspects the refresh-token cookie. When the frontend calls it on load with no query parameters, the endpoint treats the request as unauthenticated, returns `401`, and actively clears the refresh-token cookie.

Reloading the browser therefore does not merely fail to restore the session; it destroys the session that was on disk. This alone explains the reported experience of being continuously forced to log back in.

Three further defects compound it:

- The frontend's recovery path is unreachable. The session loader returns early on `401`, so the `refreshAccessToken()` fallback that follows it can only ever run in the success branch.
- The API client does not refresh on `401` despite documenting that it does. It calls `onSessionExpired()` immediately and never retries, so an expired access token logs the user out even when the refresh cookie is valid for another six days.
- Refresh-token rotation revokes the old token before issuing the new one, with no grace window and no reuse detection. Two browser tabs, or two concurrent requests that both receive `401`, will both attempt refresh; the loser is logged out.

### Access token lifetime is not configurable

Token lifetimes are hardcoded, and the refresh cookie's maximum age is written as a separate literal from the refresh token's expiry. The two can silently drift apart. There is no way to express a preference such as "keep me signed in for thirty days" without editing source.

### Local users are forced through an authentication flow that serves them nothing

A user who downloads P/OS to run on their own laptop must currently register a Google OAuth client and configure environment variables before they can open their own Journal. The security this buys is illusory: the same user already has the database credentials and filesystem access. The sign-in requirement is pure friction.

At the same time, simply removing identity is wrong. A household may have several members, and their Journals should not be commingled. Local mode needs identity for *separation*, not for *protection*.

### A no-password sign-in path already exists and is currently unsafe

The `demoAuth` query parameter on `GET /auth/session` already mints a real, fully privileged session for a hardcoded development user. It is an unguarded public route with no deployment-mode check. In a hosted deployment this is an authentication bypass.

This brief treats that mechanism as the legitimate seed of local mode. Formalizing and gating it removes an existing vulnerability rather than introducing a new one.

## Desired user outcomes

- As a local user, I can clone the repository, start the app, and reach my Journal without registering an OAuth application or entering a password.
- As a member of a household, I can choose which person I am and see only my own Journal entries.
- As a household, we can add a new person without any administrative ceremony.
- As a hosted user, I must authenticate with a real identity provider, and no password-free path exists for my deployment.
- As any signed-in user, I stay signed in across page reloads, browser restarts, and normal idle periods.
- As any signed-in user, I am not logged out because I had two tabs open.
- As an operator, I can configure how long a session stays open.
- As an operator, I cannot accidentally deploy a hosted instance that behaves like a local one.

## Initial scope

### Explicit deployment mode

Introduce an `APP_MODE` server environment variable with exactly two valid values, `local` and `hosted`.

The value shall be resolved once at application boot. If it is unset, empty, or unrecognized, or if any core initialization failure occurs, the server shall return a structured initialization error and the UI shall render a clear error panel displaying the issue and step-by-step instructions on how to resolve it.

There shall be no default. A silently defaulted authentication mode is a deployment accident waiting to happen, and the cost of requiring the variable is a few seconds during first setup.

The mode shall be enforced on the server by conditional route registration, so that routes belonging to the inactive mode are never registered and respond `404`. Hiding routes in the frontend is not sufficient, because the endpoints would remain reachable directly.

### Local mode household profiles

In local mode, identity is *selection*, not authentication. The interaction is comparable to choosing a profile on a shared media device.

Support listing the household profiles on the instance, selecting one to establish a session, and creating a new one. Selecting a profile shall mint the same session tokens that the OAuth callback mints, so that every downstream route behaves identically regardless of how the session began.

Profile selection shall be genuinely unprotected. There shall be no password and no PIN, not even an optional one. Anyone with access to the browser already has access to the database and the filesystem, so a secret at this layer would provide the appearance of protection without the substance. This is a deliberate decision and shall be documented as such, so that it is not later mistaken for a security boundary.

OAuth routes shall not be registered in local mode.

### Hosted mode authentication

In hosted mode, OAuth remains the only way to establish a session.

The local profile routes and the `demoAuth` mechanism shall not be registered, and shall respond `404` rather than `403`, because in a hosted deployment they do not conceptually exist.

Refresh cookies shall be issued with `secure` set, consistent with current production behavior.

### Shared session core

Both modes shall converge on one JWT payload shape, one refresh-token store, one rotation path, and one set of protected routes. Organization scoping and Journal ownership rules shall be untouched by this feature.

The only difference between the modes shall be how a user is identified before the first token is issued.

### Session repair

Rewrite `GET /auth/session` so that, absent a mode-specific override, it reads the refresh-token cookie, verifies it, confirms the stored token is active and the user still exists, and returns the authenticated session. It shall return `401` and clear the cookie only when no valid refresh token is present.

Make the frontend's session loader use its recovery path rather than returning early on `401`.

Give the API client real `401` handling: a single-flight refresh shared across concurrent callers, one retry of the original request, and session expiry only when the refresh itself fails. This shall cover the streaming endpoints as well as the JSON ones.

Add a grace window to refresh-token rotation so that a briefly superseded token is still accepted, preventing multi-tab logout.

### Configurable session duration

Establish a single source of truth for token lifetimes, deriving the refresh cookie's maximum age from the same value as the refresh token's expiry so the two cannot drift.

Expose access-token and session lifetimes as configuration, retaining the current values as defaults.

### UI cleanup and scaffold header removal

Remove the permanent "Portfolio OS scaffold workspace" hero banner and `?demoAuth` helper text from the top of the application shell layout, returning vertical space to the actual workspace content.

## Out of scope

- Passwords, PINs, or any local-mode secret.
- Migrating an existing local profile into a hosted account, or vice versa.
- Switching an instance between modes after data exists.
- Household member roles, permissions, or parental controls beyond the existing `admin` and `member` roles.
- Per-profile encryption or hiding one household member's data from another at the database level.
- Guest or read-only browsing for unauthenticated visitors in hosted mode.
- Additional OAuth providers beyond those already present.
- Account deletion, profile renaming, and profile avatars, beyond what is required to create and select a profile.

## Design considerations

### The data model already supports this

No schema change is required for household profiles. `OAuthProvider` is a separate table from `User` rather than a set of columns on it, so a user with no OAuth row is already valid and fully functional. `JournalEntry` is scoped by organization, user, and date, so separation between household members works without modification.

A local profile will need a value in the required, organization-unique `email` field. Whether that is a synthetic local value or a user-supplied optional address is an open question below.

### One session path, two front doors

The strong preference is that local mode and hosted mode differ only at the moment of identification. Once a session exists, no route, query, or scoping rule should need to know which mode issued it. This keeps the security-sensitive surface small and avoids a second, weaker session implementation drifting alongside the first.

### Fixing the session bugs matters in both modes

The session defects are not specific to OAuth. A local profile session uses the same cookie and the same refresh path, so an unrepaired `GET /auth/session` would eject household users exactly as it currently ejects OAuth users. The repair is a prerequisite for local mode, not a parallel workstream.

### Frontend mode awareness

The frontend should learn the deployment mode from the session response rather than from its own build-time environment, so that the server remains the single authority. It then renders either an OAuth button or a profile picker.

## Applicable ADRs

- **ADR-0001 organization-aware data access.** Local profiles must remain organization-scoped. A local instance will have a single organization containing several users.
- **ADR-0002 URL-addressable routing and history-safe navigation.** Profile selection should not break refresh or history behavior.
- **ADR-0004 use React Router for frontend navigation.** Any new profile-selection surface follows the existing routing approach.
- **ADR-0005 Tailwind CSS and shadcn/ui.** The profile picker is new UI and follows the established system.

A new ADR is warranted for the deployment-mode security boundary itself, covering the two-mode split, the fail-fast configuration decision, and the explicit choice to leave local profile selection unprotected.

## Resolved Decisions

- **Local profile email identifier:** Display name is required; email is optional at creation time. If omitted, a synthetic email (`<slug>@local.invalid`) is generated automatically to fulfill the unique constraint. Users can supply a custom email if desired.
- **Fresh instance boot:** On a fresh database in local mode with 0 users, auto-create a primary organization ("Local Portfolio") and initial profile ("Primary User"), establish its session, and take the user straight to the workspace.
- **Auto-resume profile:** Local mode remembers the last selected profile (via persistent cookie/session state) and auto-resumes it on subsequent visits.
- **Profile switching:** Profile switching is reachable directly from within the active app workspace header / settings menu as well as from the sign-in/profile selection screen.
- **Session lifetimes:**
  - **Local mode:** Long-lived session lifetime (defaults to 1 year / 365 days with rolling refresh on use).
  - **Hosted mode:** Defaults to a 7-day sliding window refreshed on active use.
- **Existing local database migration:** When booting an existing database in `APP_MODE=local`:
  - Automatically adopt all existing users/organizations.
  - Auto-select the first existing user (e.g. `taylor.trader@example.com` or first recorded user) if no last-selected profile cookie is set, ensuring zero data loss and immediate access.
- **Hosted session revocation:** Deferred to a follow-up feature. Tracked in GitHub Issue [#20](https://github.com/pagalvin/portfolio-engineering/issues/20).

## Definition of done

- The application refuses to boot without a valid `APP_MODE`.
- A clean clone configured for local mode reaches a working Journal with no OAuth configuration and no password.
- Several household profiles can coexist on one local instance with separate Journals.
- Local profile routes and `demoAuth` return `404` in hosted mode.
- OAuth routes are absent in local mode.
- A signed-in user in either mode remains signed in across page reload and browser restart.
- Two open tabs do not log each other out.
- An expired access token is refreshed transparently without user-visible interruption, including on streaming endpoints.
- Token lifetimes derive from a single configurable source.
- The deployment-mode ADR is written and accepted.
