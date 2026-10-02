# Anthropic AI Provider

## Status

- Readiness: Implemented
- Owner: backend-coding
- Date: 2026-09-24

## Summary

Add Anthropic as a supported organization-scoped BYOK provider in the existing AI provider-connections capability. Anthropic shall use the existing provider-defined schema, flat registry, encrypted secret payload, metadata-driven Your AI form, connection test lifecycle, safe failure mapping, and provider-neutral streaming contract.

This is a provider-extension increment to [Spec 0002](./0002-ai-provider-connections.md), not a new connection-management feature.

## Business objective

Allow an organization to connect its own Anthropic account so current and future AI workflows can use Anthropic without P/OS storing plaintext credentials, adding provider-specific persistence, or introducing provider-specific UI architecture.

## Problem / opportunity

Anthropic is currently shown as a planned provider in the Your AI catalog and cannot be configured or tested. The repository already contains the abstractions needed to add it as a usable provider, but the provider contract, adapter, validation, and catalog availability need to be completed consistently.

## Desired outcomes

- Anthropic appears in the available-provider catalog in builds containing the adapter.
- Users can create and edit an Anthropic connection through the existing metadata-driven form.
- Anthropic API keys remain write-only and encrypted at rest.
- Users can run the existing bounded connection test and receive the same provider-neutral success or safe failure shape as other providers.
- Future AI consumers can use Anthropic through the existing non-streaming and provider-neutral streaming interfaces without changing connection storage or adding Anthropic-specific dispatch.

## Scope

1. **Provider definition**
   - Register one flat provider definition with provider id `anthropic` and display name `Anthropic`.
   - Define exactly these provider fields:
     - `apiKey`: string, required, secret.
     - `model`: string, required, non-secret.
   - Keep the model as user-supplied configuration. Do not add a model catalog, automatic model selection, or a provider-specific model profile.
   - Mark the provider usable only when its adapter is implemented and registered in the running build.

2. **Validation and persistence compatibility**
   - Add provider validation using the existing shared validation conventions.
   - Validate the API key and model as non-empty values before persistence and again when constructing the adapter.
   - Store the API key in the existing encrypted secret payload and the model in the existing non-secret configuration payload.
   - Do not add Anthropic-specific database columns, tables, migrations, or changes to the common connection record.
   - Preserve existing create, edit, secret-rotation, enable/disable, organization scoping, and label-uniqueness behavior.

3. **Anthropic adapter**
   - Implement the official Anthropic Messages API contract using the existing adapter shape.
   - Use Anthropic's official fixed API endpoint and required authentication/version headers; the endpoint, authentication header names, and API version are adapter-owned implementation details, not user-editable connection fields.
   - Send the existing fixed connection-test prompt as a minimal user message.
   - Apply the existing timeout, abort, output-token ceiling, and latency behavior.
   - Parse Anthropic text content blocks into the existing success result, including the returned model when available.
   - Implement the existing provider-neutral `streamText` contract using Anthropic's streaming response format. Streaming is an adapter capability for future consumers; this increment does not add a streaming API route or frontend streaming experience.
   - Map HTTP and transport failures through the existing `FailureKind` vocabulary and shared safe messages. Do not return provider response bodies, prompts, API keys, or other secret material.

4. **Your AI workflow**
   - Remove Anthropic from the hard-coded planned-provider catalog when the backend reports it as usable.
   - Let the existing provider metadata endpoint expose Anthropic and let the existing form render its API-key and model fields without an Anthropic-specific form branch.
   - Preserve the existing post-save test flow, connection health grouping, rate-limit messaging, failure escalation, and edit behavior.
   - Do not add a new route, page, settings section, or UI component architecture.

## Non-goals

- Anthropic-specific database schema or a migration.
- Anthropic model discovery, model recommendations, model aliases, default models, or model orchestration.
- Prompt templates, personas, tool use, vision, batches, files, citations, caching, or other Anthropic-specific capabilities.
- Changing the connection record, encryption scheme, secret key source, rate limits, health-state rules, or test workflow.
- A new Anthropic-specific API endpoint or frontend workflow.
- Streaming UI or a new streaming endpoint.
- OpenAI-compatible hosts or support for other planned providers.
- End-user journal analysis, portfolio analysis, or any other AI feature consuming the connection.

## Functional requirements

- The provider registry shall contain one `anthropic` entry and no parallel Anthropic dispatch mechanism.
- The backend shall expose Anthropic only as usable when its adapter is present and registered.
- The frontend shall receive the provider field metadata from the existing provider endpoint and shall render the form from that metadata.
- Create requests shall require `config.model` and `secrets.apiKey`; secret and non-secret fields shall remain separated as required by ADR 0010.
- Update requests shall preserve a stored API key when the secret field is blank and replace it only when a non-empty value is submitted.
- The adapter shall decrypt credentials only in the existing server-side invocation path.
- A successful connection test shall use the existing discriminated success result, including provider id, connection id, timestamp, bounded response text, latency, and optional model.
- A failed connection test shall use the existing discriminated failure result and fixed failure vocabulary, with no raw Anthropic error text unless it has passed the repository's safe-message handling.
- Both `generateText` and `streamText` shall use the common provider-neutral contracts already consumed by the AI package.
- Existing providers and existing Your AI behavior shall remain unchanged.

## Constraints / applicable ADRs

- [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) applies. Anthropic must be defined once in the shared registry, use common columns plus separated JSON payloads, derive form metadata from the provider definition, and avoid provider-specific database columns or dispatch layers.
- [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) applies. The Anthropic API key must use the existing authenticated encryption, server-only decryption boundary, write-only update semantics, and secret-redaction rules.
- [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) applies to the catalog transition: once Anthropic is usable, it must not remain represented as an inert planned capability. No new placeholder is needed.
- The existing routing and settings architecture remains in force; this feature does not add or alter routes.
- Provider metadata remains bundled functional code for this increment. No repo-sourced runtime metadata is required.

## UX handoff context

- **Target users:** authenticated organization members managing organization-owned AI connections.
- **User goal:** configure an Anthropic API key and model, save the connection, and verify that it can respond.
- **Workflow intent:** use the existing Your AI > Providers and Connections flows; Anthropic should behave like the current available providers.
- **Permissions and visibility:** follow the existing organization-scoped connection authorization. API keys are never displayed after save.
- **Content constraints:** use “Anthropic” as the provider name; describe the API key as stored securely and leave-blank-to-preserve on edit using existing form behavior.
- **Known edge cases:** invalid credentials, unknown or unavailable models, rate limits, timeouts, network failures, empty/invalid responses, and streaming provider errors must use existing safe states.
- **Business constraints:** tests consume the organization's Anthropic account, so existing server-side rate limits and bounded requests remain mandatory.
- **Success criteria:** a member can create, edit, test, disable, enable, and delete an Anthropic connection using the existing workflow without seeing or exposing the API key.

No dedicated UXD redesign is required. UXD handoff is limited to confirming that Anthropic moves from Planned to Available now and that the existing metadata-driven field copy is suitable.

## Assumptions

- The official Anthropic Messages API is the supported Anthropic integration target.
- The adapter will use the current stable Anthropic API version supported by the implementation at delivery time; that version is not user-configurable.
- Anthropic's response and server-sent event formats can be mapped to the existing text result and `StreamTextEvent` contracts without changing those contracts.
- No new dependency is needed; if the existing HTTP adapter conventions are sufficient, implementation should reuse them.

## Open questions

No unresolved product decision currently blocks planning. In particular, this request does not require choosing a default model or exposing model recommendations; the existing connection schema requires the user to provide a model.

The coding and testing handoffs must verify the current official API-version/header requirements and exact streaming event format at implementation time. If that technical verification reveals a product choice (for example, whether to support a non-default Anthropic endpoint), stop and raise it rather than adding a user-editable field or expanding scope silently.

## Definition of done

- Anthropic is registered as a usable provider through the existing flat registry.
- The shared validation and provider metadata expose only required API-key and model fields with correct secret classification.
- An Anthropic connection can complete the existing create/edit/test lifecycle with no database change.
- Credentials are encrypted, write-only, never returned, and absent from logs and safe errors.
- Non-streaming and streaming adapter tests cover success, response parsing, authentication failure, rate limiting, timeout/abort, bounded output, and secret/prompt redaction.
- Existing provider tests and targeted API/frontend checks pass.
- Anthropic is removed from the planned catalog and appears in Available now only when supported by the running backend.
- Documentation and downstream implementation artifacts cite this spec.

## Acceptance criteria

1. `GET /api/ai/providers` lists `anthropic` as usable only when the Anthropic adapter is registered; the Your AI catalog does not also list Anthropic as planned.
2. The provider metadata for `anthropic` contains exactly one required secret API-key field and one required non-secret model field, and the existing form renders those fields without provider-specific JSX.
3. Creating an Anthropic connection with a valid model and API key succeeds, persists no plaintext API key, and returns no API key in the response.
4. Missing or invalid API-key/model values are rejected with field-oriented validation errors before a connection is stored.
5. Editing an Anthropic connection with a blank API-key field preserves the existing encrypted key; entering a new key rotates it without displaying either value.
6. A successful connection test calls only the official Anthropic endpoint, uses the fixed test prompt and bounded token/timeout settings, returns the common success shape, and never exposes the API key or raw provider body.
7. Authentication, not-found/model, rate-limit, timeout, network, bad-request, and provider-server failures map to the existing safe failure shape and health-state behavior.
8. The adapter implements `streamText` and translates representative Anthropic stream events into `chunk`, `done`, and safe `error` events without exposing credentials or prompt contents.
9. No Prisma schema, migration, connection payload contract, encryption utility, rate-limit policy, route, or new UI architecture is added or changed solely for Anthropic.
10. Existing Azure OpenAI, Google Gemini, and OpenAI provider tests and workflows continue to pass.

## Downstream handoffs

- **Implementation planner:** create a bounded plan for this spec, covering validation, registry/adapter, streaming parser, catalog transition, and focused verification. Do not reopen Spec 0002's completed plan except to cite existing contracts.
- **Backend/provider coding:** implement the provider definition, validation, official Messages API adapter, safe non-streaming invocation, and provider-neutral streaming parser using existing helpers.
- **Frontend coding:** remove Anthropic from the planned list and verify the existing metadata-driven form/catalog behavior; do not add an Anthropic-specific form or route.
- **Testing:** add provider-level mocked tests and focused API/UI regression coverage for registration, field classification, encryption boundaries, failure mapping, streaming, and preservation of existing providers.
- **UXD:** optional confirmation only; no new interaction design is requested.
- **Governance/closeout:** verify this artifact's acceptance criteria, ADR compliance, no schema migration, and absence of secret leakage before marking the increment complete.
