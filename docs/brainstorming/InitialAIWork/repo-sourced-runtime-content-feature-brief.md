# Repo-Sourced Runtime Content Feature Brief

- Status: draft
- Date: 2026-09-05

## Summary

Establish GitHub repository content as a runtime source for selected non-secret P/OS configuration and product content. A locally running or self-hosted user should be able to receive curated updates from the upstream repo without waiting for a full application redeploy.

Initial examples include AI provider configuration metadata, help text, and product news. This is a content/config distribution pattern, not a general remote-code execution mechanism.

## Business objective

Let P/OS evolve operational content quickly while preserving the self-hosted/local deployment model. Users who run locally should benefit from updated guidance, provider metadata, and announcements after the repository content changes, even if their application binary or local deployment has not changed.

## Problem / opportunity

Some product data changes more frequently than application code:

- AI provider metadata can change as vendors add models, endpoints, and configuration requirements.
- Help text can improve as users hit common issues.
- News and announcements should reach users without a release.
- Analyst/persona catalogs may eventually use the same distribution pattern.

Hardcoding this content in the deployed frontend or backend would force unnecessary redeploys and create stale local installations.

## Desired user outcomes

- As a local/self-hosted user, I can receive updated non-secret P/OS content from the GitHub repo without redeploying.
- As a user, I can still use the app when GitHub is unavailable, using the last cached content or bundled defaults.
- As a user, I can see product news or announcements sourced from the project.
- As a user configuring AI, I can benefit from updated provider/model metadata after the upstream repo changes.
- As an operator, I can control whether an instance fetches remote repo content.

## Initial scope

### Runtime content channels

Define a small set of content channels that can be fetched from the GitHub repo:

- AI provider metadata;
- help/help-adjacent copy;
- product news or announcements.

Each channel should have:

- a stable repo path;
- a versioned schema;
- validation rules;
- cache metadata;
- fallback behavior.

### AI provider metadata

AI provider metadata should be eligible for repo-sourced updates when it is safe, non-secret configuration.

Examples:

- provider display names;
- help copy for provider setup;
- documentation links;
- suggested model names;
- provider field descriptions;
- deprecation notices;
- news about provider availability.

Runtime repo content should not replace backend validation or adapter support. The app must not advertise a provider as usable unless the running backend can actually support it.

### Help content

Help text can be repo-sourced before a full help system exists.

Initial help content can be simple Markdown or JSON-backed copy associated with feature areas, such as Settings, Connections, Journal, or Portfolio.

### News content

News should support lightweight product updates, release notes, provider advisories, and operational announcements.

News items should include:

- id;
- title;
- body or summary;
- publish date;
- severity or category;
- optional link;
- optional expiry date.

## Non-goals

Do not include these in the first slice unless a later spec explicitly expands scope:

- executable code loaded from GitHub at runtime;
- remote UI component loading;
- remote database migrations;
- user-specific content from GitHub;
- secrets or credentials in repo-sourced content;
- a full help-center/search implementation;
- push notifications;
- mandatory online startup;
- trusting repo content without local validation.

## Suggested architecture

### Content manifest

Use a manifest file in the repo that describes available runtime content channels.

The manifest could include:

- channel id;
- schema version;
- file path or raw content URL;
- content version;
- updated timestamp;
- minimum app version, if needed;
- checksum, if useful;
- cache policy.

### Server-side fetch and cache

Fetch repo-sourced runtime content through the backend rather than directly from the frontend.

Suggested responsibilities:

- fetch from a configured GitHub repo/ref/path;
- validate the manifest and channel payloads;
- cache successful payloads locally;
- expose only validated content through app APIs;
- fall back to cached or bundled defaults if GitHub is unavailable.

### Bundled defaults

Ship bundled default content with the app so first-run and offline behavior work.

Runtime GitHub content should enhance or update the defaults, not be required for the app to start.

### Configuration

Use environment/config values for:

- enabling or disabling runtime repo content;
- repo owner/name;
- branch, tag, or release channel;
- fetch interval;
- request timeout.

Default behavior should be conservative and reliable for local users.

### Validation and safety

Treat GitHub content as untrusted until validated.

Recommended safeguards:

- JSON schema or equivalent validation for structured content;
- Markdown sanitization or constrained rendering for text content;
- allowlisted channels and paths;
- schema-version compatibility checks;
- no secrets;
- no executable content;
- safe error reporting when content cannot be fetched or validated.

## Suggested API surface

Initial endpoints could be:

- `GET /api/runtime-content/manifest`
- `GET /api/runtime-content/channels/:channelId`
- `POST /api/runtime-content/refresh`

The refresh endpoint could initially be development/admin-only or omitted in favor of periodic/on-demand backend refresh logic.

## Relationship to AI provider connections

The AI provider connections feature should use this pattern for repo-sourced provider metadata where appropriate.

Important boundary:

- Repo content may describe supported providers, field labels, help copy, docs links, and suggested models.
- Backend code still owns adapter support, provider validation, secret handling, and actual invocation behavior.
- The UI should distinguish "known by content" from "supported by this running app version" if repo content is newer than the local deployment.

## ADR

Promoted ADR:

- [ADR 0009: Use GitHub repo-sourced runtime content](../../ADRs/0009-use-github-repo-sourced-runtime-content.md)

Decision points to capture:

- GitHub repo content can be a runtime source for safe, versioned, validated non-secret content.
- Runtime content must be fetched server-side, validated, cached, and exposed through app APIs.
- Bundled defaults and cached content must preserve offline/local reliability.
- Repo content must not load executable code, bypass backend validation, or contain secrets.

## Open questions for decomposition

- Which repo/ref should be the default content source: `main`, a release branch, or a dedicated content branch?
- Should runtime content be fetched from raw GitHub URLs or via GitHub API?
- Should public unauthenticated fetches be sufficient, or should operators optionally configure a GitHub token to avoid rate limits?
- What local cache storage should be used for self-hosted deployments?
- Which content channel should be implemented first: AI provider metadata, help text, or news?
- Should content refresh be automatic, manual, or both?
- How should the UI communicate stale cached content or fetch failures?

## Definition of done for the first slice

- A repo content channel is defined with a stable path and schema.
- The backend can fetch, validate, and cache that channel.
- The app has bundled fallback content.
- The frontend can read validated runtime content through an API.
- The app behaves safely when GitHub is unavailable or returns invalid content.
- No secrets or executable code are accepted through runtime content.
