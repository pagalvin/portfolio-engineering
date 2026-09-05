# ADR 0009: Use GitHub repo-sourced runtime content

- Status: draft
- Date: 2026-09-05
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Adding or changing non-secret product content that should update independently of a local app redeployment.
- Building runtime content channels for AI provider metadata, help copy, product news, announcements, or similar curated product data.
- Designing cache, validation, refresh, or fallback behavior for content sourced from the Portfolio Engineering GitHub repository.
- Not applicable to executable code, remote UI components, database migrations, user-specific data, organization-owned business data, credentials, or secrets.

## Context

- Local and self-hosted users should benefit from curated product content updates without rebuilding or redeploying the application.
- AI provider metadata, help text, news, and future analyst/persona catalogs can change more frequently than application code.
- GitHub repository content is public and appropriate for non-secret product data, but it still must be treated as untrusted input until validated by the running application.
- Runtime content must not make GitHub availability a startup requirement.
- This decision is based on the runtime content direction captured in [repo-sourced-runtime-content-feature-brief.md](../brainstorming/InitialAIWork/repo-sourced-runtime-content-feature-brief.md).

## Decision Statement

Use public raw GitHub URLs from the `main` branch of the Portfolio Engineering repository as a runtime source for selected non-secret product content. Fetch content server-side, validate it against known schemas, cache successful payloads in the database, and expose only validated content through backend APIs. Ship bundled defaults and support both automatic and manual refresh so the app remains usable when GitHub is unavailable.

## Decision Drivers

- Local/self-hosted installs need content updates without full redeployment.
- Runtime content must be simple to publish and easy to inspect in the repo.
- The first implementation should avoid private credentials and GitHub token management.
- The app needs reliable offline and degraded-network behavior.
- The backend must remain the authority for compatibility, validation, and safety.

## Options Considered

### Raw GitHub URLs from `main`

- Pros:
  - Simple public fetch model.
  - Easy to test with browser or CLI tools.
  - Works well with manifest-driven, allowlisted paths.
  - Avoids GitHub API response parsing and authentication concerns.
- Cons:
  - Less built-in metadata than the GitHub API.
  - Freshness may be affected by raw content/CDN caching.
  - Not ideal for dynamic directory discovery.

### GitHub API

- Pros:
  - Provides structured metadata such as SHA, size, and file information.
  - Better suited to directory listing and richer repo-content governance.
  - Supports more explicit conditional request patterns.
- Cons:
  - More implementation complexity.
  - Public unauthenticated API rate limits are more visible.
  - Often requires API-specific response parsing, including base64 content handling.

### Database cache

- Pros:
  - Works consistently across backend restarts.
  - Avoids filesystem path and permission differences across local, container, and hosted deployments.
  - Centralizes validation status, fetched timestamps, schema versions, and payload metadata.
  - Supports backend consumers as well as frontend APIs.
- Cons:
  - Requires schema and migration work.
  - Stores externally sourced product content in the app database.
  - Needs clear distinction from organization-owned data.

### Filesystem or browser-local cache

- Pros:
  - Can be simple for narrow local experiments.
  - Avoids an initial database migration.
- Cons:
  - Deployment-specific and harder to operate consistently.
  - Browser-local cache is not suitable for backend validation or backend consumers.
  - Harder to query, audit, or share across sessions and devices.

## Chosen Approach and Rationale

- Use raw GitHub URLs from `main` because runtime content is public, manifest-driven, and does not require dynamic repo browsing in the first slice.
- Use a database cache because validated runtime content should be available to backend services and frontend APIs consistently across deployment modes.
- Use public unauthenticated fetches only; this content must not rely on hidden repository data or GitHub tokens.
- Use schema validation initially; signatures and checksums can be added later if governance or threat-modeling needs justify them.
- Support both automatic refresh and manual refresh so local users receive updates over time but can also force an update when troubleshooting or onboarding.

## Consequences and Tradeoffs

- Content authors can update selected product data through normal repository changes on `main`.
- The app must define stable channel paths, schemas, and bundled defaults.
- The backend needs cache persistence, refresh logic, validation, and safe error reporting.
- Raw URL fetching keeps the first implementation simple but may need to evolve if richer metadata, commit pinning, or directory discovery becomes important.
- Database caching introduces a migration but avoids local filesystem differences and supports backend-owned validation.
- Runtime content is global/system-scoped by default, not organization-owned data. If tenant-specific overrides are introduced later, apply [ADR 0001](./0001-organization-aware-data-access.md).

## Guidance for Architect Agents

- Treat this as a bounded content/config distribution pattern, not as remote application extensibility.
- Keep runtime channels explicit, schema-versioned, and allowlisted.
- Split future ADRs only when a channel needs distinct governance, trust, moderation, or compatibility rules.
- Revisit raw URLs versus GitHub API only if the implementation needs richer metadata, stronger auditability, or dynamic discovery.

## Guidance for Coding Agents

- Fetch runtime content through backend code, not directly from frontend components.
- Use raw GitHub URLs targeting the `main` branch and allowlisted repo paths.
- Store the latest successfully validated payload and metadata in the database.
- Include bundled defaults for each runtime content channel.
- Expose validated content through application APIs.
- Implement automatic refresh and a controlled manual refresh path.
- Treat runtime content as global/system-scoped unless a later spec explicitly introduces organization-specific overrides.
- Validate channel payloads before caching or serving them.

## Guidance for Testing Agents

- Verify that valid repo content is fetched, validated, cached, and served through backend APIs.
- Verify fallback to cached content when GitHub is unavailable.
- Verify fallback to bundled defaults when no cached content exists.
- Verify invalid content is rejected and does not replace the last good cached payload.
- Verify manual refresh and automatic refresh behavior.
- Verify frontend behavior for stale content, failed refresh, and successful refresh.

## Do

- Use public raw GitHub URLs from the repository `main` branch for approved runtime content channels.
- Keep runtime content non-secret and non-executable.
- Fetch and validate runtime content server-side.
- Cache successful validated payloads in the database.
- Ship bundled defaults for every runtime content channel.
- Support both automatic and manual refresh.
- Require schema validation before content is cached or served.
- Keep channel ids, source paths, schemas, and compatibility rules explicit.
- Surface safe errors or stale-content status when refresh fails.

## Do Not

- Do not load executable code, scripts, plugins, or remote UI components from GitHub at runtime.
- Do not put credentials, user data, organization-owned business data, or secrets in repo-sourced runtime content.
- Do not fetch arbitrary GitHub paths supplied by users or repo content.
- Do not let runtime content enable provider adapters, backend capabilities, or privileged behavior unsupported by the running app version.
- Do not require GitHub availability for application startup.
- Do not expose raw unvalidated GitHub content directly to the frontend.
- Do not use GitHub tokens for the initial public runtime content fetch path.

## Open Questions and Follow-up Items

- Define the first runtime content channel path and schema.
- Decide whether AI provider metadata, help copy, or news should be the first implemented channel.
- Define database table shape for runtime content cache entries.
- Define automatic refresh interval and manual refresh authorization.
- Decide how the UI should communicate stale cached content or refresh failures.
- Revisit checksums, signatures, or GitHub API metadata if future threat modeling or governance requires stronger provenance controls.
