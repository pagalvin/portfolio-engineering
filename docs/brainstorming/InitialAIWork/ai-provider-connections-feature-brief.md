# AI Provider Connections Feature Brief

- Status: draft
- Date: 2026-09-05
- Source: [ai integration.md](./ai%20integration.md)

## Summary

Build the first AI integration slice around organization-owned AI provider connections. Users should be able to bring their own provider credentials, configure one or more model connections, and test that P/OS can successfully call those providers.

This feature is infrastructure-first. It does not yet deliver journal analysis, portfolio review, memory, personas, or multi-model orchestration. It proves the secure configuration, provider abstraction, and connectivity path that later AI features will reuse.

## Business objective

Enable P/OS to support AI features without owning inference accounts or paying model usage costs directly. Users bring credentials for their preferred providers, while P/OS provides the orchestration, configuration UI, and feature-specific prompts.

## Problem / opportunity

AI providers do not share one credential or endpoint shape. OpenAI, Anthropic, Azure OpenAI, xAI, Google, OpenAI-compatible hosts, and local/self-hosted model servers all require different fields.

P/OS needs a flexible BYOK foundation that:

- lets the UI adapt to the selected provider;
- lets the backend validate provider-specific requirements;
- stores secrets safely;
- supports more providers without repeated schema churn;
- gives users confidence by testing a connection before any product feature depends on it.

## Desired user outcomes

- As a user, I can open settings and see a Connections area for AI providers.
- As a user, I can choose a provider from a supported provider list.
- As a user, I see only the fields needed for the selected provider.
- As a user, I can save one or more AI provider connections for my organization.
- As a user, I can test a saved connection and see whether P/OS can call the provider successfully.
- As a user, I can disable or delete a connection that should no longer be used.
- As a user, I never see stored secret values returned after save.

## Initial scope

### Provider discovery

Expose safe provider metadata that the frontend can use to render dynamic forms.

Provider metadata should describe:

- provider id;
- display name;
- credential fields;
- non-secret configuration fields;
- suggested or default model names, where practical;
- whether the provider requires a base URL, endpoint, deployment, API version, or API key.

### AI connection management

Support organization-scoped connection records with:

- id;
- organization id;
- provider id;
- friendly label;
- enabled/disabled state;
- encrypted secret payload;
- provider-specific non-secret configuration payload;
- created and updated timestamps;
- optional last test status metadata.

Avoid provider-specific database columns such as `openAiApiKey`, `anthropicApiKey`, or `azureEndpoint`.

### Connection testing

Provide a test action for saved connections.

The test should:

- load the selected organization-owned connection;
- decrypt credentials only on the server;
- call the configured provider through the provider registry;
- use a small fixed prompt such as "Say hello and confirm you are online.";
- return success/failure, response text when successful, latency, and a safe error message when unsuccessful.

### Settings UI

Use the existing System settings area as the entry point. The Connections block is the expected home for this feature.

The first UI should support:

- listing configured AI connections;
- adding a connection;
- selecting a provider;
- rendering provider-specific fields dynamically;
- saving the connection;
- testing the connection;
- disabling/enabling if supported in the first cut;
- deleting a connection.

## Non-goals

Do not include these in the first slice unless a later spec explicitly expands scope:

- end-user AI analysis features;
- prompt authoring for journal or portfolio workflows;
- streaming responses;
- side-by-side model comparison;
- battle/critique orchestration;
- a generic actionable alerting system;
- AI memory, facts, embeddings, or vector search;
- analyst/persona catalogs;
- community analyst submission flows;
- router or navigation changes beyond using the existing settings route;
- a generic AI invocation endpoint for product features.

## Provider examples

These examples are intended to guide schema and UI design. They are not a final provider commitment list.

| Provider | Typical user-supplied fields |
| --- | --- |
| OpenAI | API key, model name, optional organization/project metadata |
| Anthropic | API key, model name |
| xAI | API key, model name |
| Google Gemini | API key, model name |
| Azure OpenAI | endpoint, deployment name, API key, API version |
| OpenAI-compatible host | base URL, model name, optional API key |
| Ollama/local | base URL, model name, usually no API key |
| Llama through hosted provider | provider host credentials, base URL or provider-specific endpoint, model name |

## Suggested architecture

### Provider registry

Create a provider registry, likely in a new `packages/ai` package, that owns provider definitions and adapter factories.

Suggested responsibilities:

- define supported provider ids;
- define provider field schemas;
- validate submitted connection payloads;
- construct provider-specific SDK adapters;
- expose safe metadata to the API/frontend;
- provide a common test/generate-text operation for the first slice.

The registry should be one dispatcher plus provider entries, not a layered "dispatcher of dispatchers".

### Vercel AI SDK usage

Use Vercel AI SDK as the provider abstraction layer. P/OS would use the SDK internally; users do not need Vercel accounts or Vercel API keys.

Users bring credentials for the selected AI provider. Vercel AI SDK helps normalize calls to different model providers.

For the first slice, use non-streaming text generation to prove connectivity. Streaming can be added later.

### Storage shape

Use common columns for shared connection identity and JSON payloads for provider-specific data:

- common columns for id, organization id, provider id, label, enabled state, timestamps, and test metadata;
- encrypted JSON or structured encrypted payload for secrets;
- non-secret JSON configuration for model, endpoint, deployment, base URL, API version, and similar fields.

### Secret handling

Secrets must be encrypted at rest and never returned by read/list APIs.

Suggested approach:

- AES-256-GCM with Node `node:crypto`;
- per-record IV/nonce;
- server-only encryption key such as `AI_CREDENTIALS_ENCRYPTION_KEY`;
- no `VITE_` prefix for secret-related environment variables;
- plaintext available only inside server-side execution paths that call providers;
- no secret values in logs, errors, telemetry, or frontend responses.

## Suggested first provider order

Start with the smallest useful provider set:

1. OpenAI or Anthropic, depending on which live test key is available first.
2. Add the other simple API-key-plus-model provider.
3. Add xAI or Google Gemini.
4. Add OpenAI-compatible custom endpoint.
5. Add Azure OpenAI once the dynamic-field path is proven.

Azure OpenAI is important, but it should not be the first provider because its endpoint/deployment/API-version shape is more complex.

## Suggested API surface

Initial endpoints could be:

- `GET /api/ai/providers`
- `GET /api/ai/connections`
- `POST /api/ai/connections`
- `DELETE /api/ai/connections/:id`
- `POST /api/ai/connections/:id/test`

Optional first-slice endpoint:

- `PATCH /api/ai/connections/:id/enabled`

Defer a generic product-facing invocation endpoint until the first end-user AI feature exists.

## Applicable constraints and ADR candidates

Existing ADRs:

- [ADR 0001](../../ADRs/0001-organization-aware-data-access.md): AI provider connections should be organization-owned data.
- [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md): keep the settings experience URL-addressable through existing routing patterns.
- [ADR 0003](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md): planned AI features should remain placeholders until implemented.
- [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md): repo-sourced runtime content should use public raw GitHub URLs from `main`, server-side validation, database caching, bundled defaults, and automatic/manual refresh.
- [Repo-Sourced Runtime Content Feature Brief](./repo-sourced-runtime-content-feature-brief.md): AI provider metadata should be eligible for runtime updates from GitHub when the content is non-secret and compatible with the running backend.
- [Actionable Alerts Feature Brief](./actionable-alerts-feature-brief.md): missing or disabled AI provider setup should eventually produce an actionable alert that routes users to provider configuration.

Recommended new ADRs before or alongside implementation:

- Use provider-defined BYOK schemas for AI connections.
- Encrypt AI provider credentials at rest.
- Use generic actionable alerts for attention-worthy app conditions.

Recommended ADR update:

- Update [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) to explicitly call AI provider connections organization-owned data.

## Open questions for decomposition

- Which provider should be implemented first based on available test credentials?
- Should encrypted secret handling live in `packages/database`, a new `packages/crypto`, or another shared package?
- Should one saved connection represent one provider account plus one model, or should the first design separate provider credentials from model profiles?
- Which parts of provider metadata should be bundled in code versus fetched as validated runtime content from GitHub?
- Should the first AI provider work include only configuration UI, or also emit a follow-on "no AI providers configured" actionable alert?
- Which connection fields must be unique per organization, if any?
- What test result metadata should be persisted versus shown only in the immediate response?
- Should disabled connections be hidden from future AI feature selectors or shown as unavailable?

## Definition of done for the first slice

- Users can create at least one AI provider connection through the settings UI.
- The saved connection is organization-scoped.
- Secrets are encrypted at rest and are not returned by list/read APIs.
- The backend validates provider-specific required fields.
- The UI renders fields dynamically from provider metadata or an equivalent shared provider definition.
- Users can test a saved connection and receive a clear success or failure result.
- At least one real provider adapter successfully calls a live provider in development.
- Later AI features have a clear backend path for selecting and using a configured connection.
