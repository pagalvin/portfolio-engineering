# ADR 0010: Use provider-defined BYOK schemas for AI connections

- Status: draft
- Date: 2026-09-05
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Adding, changing, or removing support for an AI provider in the provider registry.
- Designing database schema for user-supplied AI provider connections.
- Building or changing configuration UI that collects AI provider credentials and settings.
- Validating submitted AI connection payloads on the backend.
- Not applicable to prompt content, model invocation behavior, orchestration recipes, or non-AI third-party integrations unless a later ADR extends this pattern to them.

## Context

- P/OS uses a bring-your-own-key (BYOK) model. Users supply credentials for their own AI providers and P/OS orchestrates calls rather than owning inference accounts.
- Candidate providers do not share a credential or endpoint shape. Google Gemini needs an API key and model name. Azure OpenAI needs an endpoint, deployment name, API key, and API version. OpenAI-compatible hosts need a base URL. Local model servers frequently need no key at all.
- The provider list is expected to grow. Each new provider would otherwise imply new database columns, new form branches, and new validation code paths.
- Provider-specific columns such as `openAiApiKey` or `azureEndpoint` create a schema that must change every time a vendor is added, and leave most columns null for most rows.
- The frontend must render the correct fields for a selected provider without hardcoding a layout per provider.
- The backend must remain the authority on which providers are actually usable, independent of any descriptive metadata that may later arrive from runtime content under [ADR 0009](./0009-use-github-repo-sourced-runtime-content.md).
- This decision is based on the direction captured in [ai-provider-connections-feature-brief.md](../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md) and specified in [0002-ai-provider-connections.md](../specs/0002-ai-provider-connections.md).

## Decision Statement

Define each supported AI provider once in a shared provider registry that owns its field schema, validation rules, and adapter factory. Store AI connections using common columns for shared identity plus provider-specific JSON payloads, with secrets and non-secret configuration separated. Drive configuration UI and backend validation from the same provider definitions, and never add provider-specific database columns.

## Decision Drivers

- Adding a provider should require one registry entry, not a schema migration.
- The UI and the backend must agree on required fields without duplicating provider knowledge.
- Provider-specific data varies enough that fixed columns would be mostly null.
- Backend validation must not be bypassable by a frontend that renders the wrong fields.
- The registry must remain a single dispatch layer rather than growing nested dispatchers.
- Future AI features need one predictable way to select and use a configured connection.

## Options Considered

### Provider-defined schemas with JSON payload storage

- Pros:
  - New providers require a registry entry only.
  - Field definitions have one source of truth shared by UI and validation.
  - Avoids sparse, mostly-null provider columns.
  - Keeps secret and non-secret data separable.
- Cons:
  - Loses per-field database-level type constraints.
  - Requires disciplined application-level validation.
  - JSON payload shape must be versioned carefully as providers evolve.

### Provider-specific columns

- Pros:
  - Strong database typing per field.
  - Simple to query individual fields directly.
- Cons:
  - Every new provider forces a migration.
  - Table accumulates mostly-null columns.
  - Encourages provider-specific branching throughout the codebase.
  - Explicitly rejected in the source feature brief.

### One table per provider

- Pros:
  - Precise typing for each provider.
  - Clear isolation between provider shapes.
- Cons:
  - Every new provider forces a new table and new query paths.
  - Listing all connections requires unions across tables.
  - Shared concerns such as enable/disable and test metadata get duplicated.

### Fully freeform key/value configuration

- Pros:
  - Maximum flexibility with no schema work at all.
- Cons:
  - No validation contract for the backend to enforce.
  - UI cannot render meaningful field-specific input.
  - Secret and non-secret values become indistinguishable, which is unsafe.

## Chosen Approach and Rationale

- Use provider-defined schemas because provider shapes differ enough that a fixed column set is either sparse or constantly migrating.
- Keep common columns for identity and lifecycle concerns shared by every provider: id, organization id, provider id, label, enabled state, timestamps, and test metadata.
- Separate the secret payload from the non-secret configuration payload so encryption applies to a clearly bounded value and non-secret settings remain readable for display and querying.
- Derive both the UI form and the backend validation from the same provider definitions so the two cannot drift.
- Keep the registry a single dispatcher with provider entries, not a layered dispatcher of dispatchers, per the direction in [ai integration.md](../brainstorming/InitialAIWork/ai%20integration.md).
- Treat adapter support in the running build as the sole authority on whether a provider is usable, so descriptive metadata can never advertise a provider the backend cannot actually call.

## Consequences and Tradeoffs

- Adding a provider becomes a bounded, low-risk change confined to the registry.
- The database cannot enforce provider field correctness, so application validation becomes security-relevant and must be tested.
- JSON payloads are less directly queryable than columns; any field that later needs indexing or aggregation may justify promotion to a common column.
- Provider definitions become a shared contract consumed by the API, the UI, and future AI features, so changing one requires considering all three.
- Field-schema changes for an existing provider need a compatibility story for already-stored connections.

## Guidance for Architect Agents

- Treat the provider registry as the single source of provider knowledge. Provider details should not be re-encoded in routes, UI components, or database schema.
- Distinguish functional metadata, which the backend must agree with to operate, from descriptive metadata, which is presentation only.
- Functional metadata includes provider ids, field names and types, required/optional status, validation rules, secret classification, and adapter availability. It stays in code.
- Descriptive metadata includes display names, labels, help copy, documentation links, suggested models, and advisories. It is eligible for runtime delivery under [ADR 0009](./0009-use-github-repo-sourced-runtime-content.md).
- Promote a JSON field to a common column only when a real query, index, or cross-provider behavior requires it.
- Keep the registry flat. If dispatch appears to need nesting, revisit the abstraction before adding a layer.

## Guidance for Coding Agents

- Define each provider once, including its id, field schema, secret classification, and adapter factory.
- Store connections with common columns for id, organization id, provider id, label, enabled state, timestamps, and test metadata.
- Store provider-specific values in JSON payloads, keeping secrets separate from non-secret configuration.
- Validate submitted payloads on the backend against the provider definition before persisting, regardless of what the frontend sent.
- Render configuration forms dynamically from provider metadata rather than branching on hardcoded per-provider layouts.
- Return a clear validation error naming the offending field when a provider-required field is missing.
- Determine provider usability from adapter support in the running build, never from descriptive metadata alone.
- Apply [ADR 0001](./0001-organization-aware-data-access.md); AI connections are organization-owned data and require a direct `organizationId` column.

## Guidance for Testing Agents

- Verify that selecting a provider renders exactly its defined fields and no fields belonging to another provider.
- Verify that a payload missing a provider-required field is rejected with a message identifying the field.
- Verify that backend validation rejects invalid payloads submitted directly to the API, bypassing the UI.
- Verify that fields not defined by the selected provider are rejected or ignored rather than silently persisted.
- Verify that two providers with different field shapes can both be stored and retrieved correctly.
- Verify that a provider present in descriptive metadata but lacking an adapter is not presented as usable.
- Verify that adding a provider entry requires no database migration.

## Do

- Define every supported provider in the shared provider registry.
- Use common columns for connection identity and lifecycle state.
- Use JSON payloads for provider-specific values.
- Keep secret payloads separate from non-secret configuration.
- Drive UI forms and backend validation from the same provider definitions.
- Validate every submitted connection payload server-side.
- Treat adapter availability in the running build as the authority on provider usability.

## Do Not

- Do not add provider-specific database columns such as `openAiApiKey`, `anthropicApiKey`, or `azureEndpoint`.
- Do not create a separate table per provider.
- Do not hardcode per-provider form layouts in frontend components.
- Do not rely on frontend validation as the enforcement mechanism.
- Do not store secrets in the non-secret configuration payload.
- Do not let descriptive or runtime-sourced metadata enable a provider the backend cannot call.
- Do not add dispatch layers on top of the registry.

## Open Questions and Follow-up Items

- Define the versioning and migration story for provider field schemas when a vendor changes requirements.
- Decide whether any provider-specific field later warrants promotion to a common column for querying.
- Decide how connection records should behave if a provider entry is removed from the registry in a later build.
- Revisit whether credentials and model selection should separate into reusable model profiles, as noted in [0002-ai-provider-connections.md](../specs/0002-ai-provider-connections.md).
