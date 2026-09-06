# AI Provider Connections

## Status

- Readiness: Complete
- Owner: TBD
- Date: 2026-09-05

## Summary

Add the first AI integration slice for P/OS: organization-owned AI provider connections. Users shall be able to configure one or more AI providers that the app can call for future AI-powered features without P/OS owning or paying for inference accounts directly.

This first slice proves the secure configuration flow, provider abstraction, and connectivity test path using Azure OpenAI, Google Gemini, and OpenAI as the initial providers. It does not implement journal analysis, portfolio review, memory, personas, or model orchestration.

Suggested API surface for the slice:

- `GET /api/ai/providers`
- `GET /api/ai/connections`
- `POST /api/ai/connections`
- `PATCH /api/ai/connections/:id`
- `DELETE /api/ai/connections/:id`
- `POST /api/ai/connections/:id/test`

`PATCH` covers both non-secret edits and enable/disable state changes.

## Business objective

Enable AI features to work in a BYOK (bring your own key) model, where users supply provider credentials and P/OS provides the configuration, validation, and orchestration layer for future in-product AI workflows.

## Problem / opportunity

- AI providers do not share a uniform credential or endpoint shape.
- Users need a consistent way to register OpenAI, Anthropic, Google, Azure OpenAI, xAI, OpenAI-compatible hosts, and local/self-hosted models.
- Provider configuration must be secure, descriptive, and reusable across future features.
- P/OS must validate connectivity before later features depend on the configuration.
- A flexible foundation is required so new providers can be added without repeated schema churn.

## Desired outcomes

- Users can open the existing System settings area and find an AI Connections section.
- Users can choose from supported AI providers and see only the fields needed for that provider.
- Users can save one or more organization-scoped AI provider connections.
- Users can test a saved connection and see whether the provider can respond successfully.
- Users can disable or delete a connection when it is no longer needed.
- Stored secrets are never returned to the client after save.
- The app exposes a provider registry and backend abstraction that future AI features can reuse.

## Scope

- Organization-scoped AI provider connection records.
- Dynamic provider form rendering driven by shared provider metadata.
- Server-side validation of provider-specific required fields.
- Secret encryption at rest and safe handling in server-only execution paths.
- A connection testing endpoint that invokes the selected provider with a minimal non-destructive prompt.
- UI support for listing, creating, testing, enabling/disabling, and deleting AI provider connections.
- A provider registry that maps provider IDs to adapter factories and shared metadata.
- Support for Azure OpenAI and Google Gemini as the two first-slice provider adapters.
- Support for the official OpenAI API as an additional provider adapter.
- Update of existing connections, including write-only secret rotation.

## Non-goals

- End-user AI analysis features such as journal analysis, portfolio review, or summaries.
- Prompt authoring, retrieval, or memory systems.
- Side-by-side model comparison or multi-model battle workflows.
- Generic product-facing AI invocation endpoints for app features not yet specified.
- Streaming responses in the first slice.
- A generic alerting system as part of this spec unless required for setup-state messaging.
- A provider-by-provider database schema with ad hoc columns like `openAiApiKey` or `azureEndpoint`.
- Providers beyond Azure OpenAI, Google Gemini, and OpenAI, including Anthropic, xAI, OpenAI-compatible hosts, and local model servers. The registry must accommodate them, but no adapter is required in this slice.
- Repo-sourced runtime delivery of provider metadata. Metadata is bundled in code in this slice.

## Functional requirements

1. **Provider metadata and registry**
   - The system shall expose a shared provider registry with metadata for each supported provider.
   - Provider metadata shall include at minimum:
     - provider id
     - display name
     - available credential and configuration fields
     - default or suggested model names when practical
     - whether the provider requires an API key, base URL, deployment, endpoint, or API version
   - The registry shall support adding new providers through a single provider entry without building a new dispatch layer.
   - The first slice shall implement adapters for Azure OpenAI, Google Gemini, and the official OpenAI API.
   - Azure OpenAI shall collect endpoint, deployment name, API key, and API version. Because its shape is the most complex of the candidate providers, implementing it first proves the dynamic-field path rather than deferring that risk.
   - Google Gemini shall collect API key and model name, proving the simple API-key-plus-model path.
   - OpenAI shall collect an API key and model name. The API key shall be secret and the model name shall be non-secret configuration.
   - OpenAI support shall use the official OpenAI API contract. OpenAI-compatible hosts with custom base URLs remain a separate future provider capability.
   - Provider metadata shall be bundled in application code for this slice. See the metadata sourcing requirement below for the intended long-term split.

2. **Provider metadata sourcing**
   - Metadata that the backend must agree with in order to function shall remain bundled in code and shall never be overridden by remote content. This includes:
     - provider id
     - field names, types, and required/optional status
     - validation rules
     - which providers have a working adapter in the running build
     - secret versus non-secret field classification
   - Metadata that is purely descriptive shall be eligible for later repo-sourced runtime delivery under ADR 0009. This includes:
     - provider display name
     - field labels, help text, and placeholder copy
     - documentation links
     - suggested or recommended model names
     - deprecation notices and provider advisories
   - The bundled definitions shall be structured so that descriptive fields can later be overlaid by validated runtime content without a schema change.
   - The app shall never advertise a provider as usable based on descriptive metadata alone. Usability shall be determined by adapter support in the running backend.

3. **Connection model**
   - The system shall store AI provider connections at the organization scope.
   - Each connection shall include:
     - id
     - organization id
     - provider id
     - friendly label
     - enabled/disabled state
     - encrypted secret payload
     - provider-specific non-secret configuration payload
     - created timestamp
     - updated timestamp
     - optional last test result metadata
   - The system shall not use provider-specific columns for secret storage.
   - A connection shall represent one provider credential set combined with one model. Users who want to use several models shall create a separate connection for each.
   - An organization shall be able to hold multiple connections, including several connections for the same provider.
   - A connection label shall be unique within its organization so that connections remain distinguishable in lists and future model selectors. Duplicate credentials or duplicate provider/model combinations shall not be rejected, because running the same model under different labels is a legitimate configuration.
   - A label uniqueness violation shall produce a clear validation message identifying the conflict, and shall not reveal any detail of the conflicting connection's secrets.
   - Each connection shall carry a derived health state used for presentation, with at least these values:
     - `ready`: enabled and the most recent test succeeded
     - `untested`: enabled but never successfully tested
     - `failing`: enabled but the most recent test failed
     - `disabled`: explicitly disabled by a user
   - Persisted test metadata shall include last test timestamp, last test outcome, a safe last error summary, and the consecutive failure count. Provider response text and latency shall be returned in the immediate test response and are not required to be persisted.

4. **Connection updates**
   - Users shall be able to update an existing connection without deleting and recreating it.
   - Non-secret fields such as label, model name, endpoint, deployment, and API version shall be editable.
   - Secret fields shall be write-only. An empty secret field on update shall preserve the stored secret; a non-empty value shall replace it.
   - The UI shall clearly indicate that a secret is already stored and that leaving the field blank keeps the current value.
   - Updating a connection shall invalidate a prior successful test so stale success states are not shown as current, but shall preserve a prior failure result and its metadata until a subsequent successful test clears it.

5. **Dynamic form behavior**
   - The frontend shall render provider-specific fields based on the selected provider.
   - The UI shall show only the relevant fields for the selected provider.
   - The UI shall not expose secret values after save.

6. **Validation and safety**
   - The backend shall validate provider-specific required fields before saving.
   - Secrets shall be encrypted at rest and decrypted only in server-side execution paths.
   - Encryption shall live in a dedicated crypto utility package rather than in the database layer or an application package. This keeps the crypto surface small and auditable, avoids coupling secret handling to the ORM, and allows future features that need secret-at-rest storage to reuse the same primitives.
   - The encryption key shall be supplied through a server-only environment variable and shall never be persisted in the database or exposed to the frontend build.
   - Each encrypted record shall use a per-record initialization vector rather than a fixed one.
   - Secret values shall not be included in API responses, logs, telemetry, or frontend payloads.
   - The app shall treat provider errors as safe, user-facing failure states without leaking secret material.

7. **Connection testing**
   - The system shall provide a test action for saved connections.
   - A test shall:
     - load the selected organization-owned connection
     - decrypt credentials only on the server
     - invoke the configured provider through the provider registry
     - send a small fixed prompt such as "Say hello and confirm you are online."
     - return success or failure plus safe payload details
   - A successful response shall include the provider response text, latency, and status.
   - An unsuccessful response shall include a safe error message without exposing secrets.
   - The test endpoint shall return a single discriminated result shape so the frontend can render states without provider-specific branching:
     - `status`: `success` or `failure`
     - `providerId`
     - `connectionId`
     - `testedAt`: ISO 8601 timestamp
     - `latencyMs`: integer, present on both outcomes when a request was actually issued
     - on success: `responseText`, plus optional `modelUsed`
     - on failure: `failureKind`, `message`, and optional `providerStatusCode`
   - `failureKind` shall use a fixed vocabulary so the UI can offer the right remediation:
     - `auth`: credentials rejected
     - `not_found`: endpoint, deployment, or model not found
     - `rate_limit`: throttled or quota exhausted
     - `timeout`: no response within the configured timeout
     - `network`: connection could not be established
     - `bad_request`: provider rejected the request shape or parameters
     - `provider_error`: provider returned a server-side error
     - `unknown`: unclassified failure
   - The `message` field shall be a short, human-readable summary safe to display. Raw provider error bodies shall not be passed through unfiltered.
   - Reaching the configured timeout shall abort the underlying provider request, not merely stop waiting for it. An abandoned in-flight call would continue to incur cost after the user has been told the test failed.
   - A timeout shall be reported as `failureKind` of `timeout`.
   - The response text returned to the frontend shall be truncated for display if a provider ignores the configured token ceiling.

8. **Test cost control and failure escalation**
   - The test operation shall enforce a bounded timeout and a minimal token allowance so a misconfigured connection cannot produce a long or expensive call. See Configurable defaults for the recommended values.
   - The test action shall be rate-limited. Because every test spends real user money at the provider, the limit protects against accidental repeated clicks, runaway retry loops, and provider-side throttling.
   - The rate limit shall apply at two tiers, because they guard against different failure modes:
     - a per-connection limit, which prevents repeated hammering of one misconfigured connection
     - a per-organization limit, which prevents cycling across many connections to evade the per-connection limit
   - A short minimum interval shall separate consecutive tests of the same connection. Double-clicks and impatient retries are the most common accidental duplicates and shall not consume the hourly allowance.
   - Rate-limit thresholds shall stay well clear of legitimate troubleshooting. Editing a field and retesting several times in a row shall never hit the limit.
   - When a request exceeds the rate limit, the system shall reject it before contacting the provider and shall return a clear message indicating when testing can resume.
   - The rate limit shall be applied server-side. UI affordances such as disabling the test button are a convenience and shall not be the enforcement mechanism.
   - Repeated test failures shall flag the connection through its health state only. The system shall never automatically disable a connection, because a failure may be caused by a transient provider outage rather than a bad configuration, and silently disabling a user's connection would be surprising.
   - The system shall track a consecutive failure count per connection. Any successful test shall reset that count to zero.
   - A connection shall be escalated to prominent presentation within the Needs attention view after the configured consecutive-failure threshold is reached.
   - Failures whose `failureKind` is `auth`, `not_found`, or `bad_request` shall escalate immediately on the first occurrence. These are deterministic configuration errors that cannot resolve on their own, so requiring repeated attempts before saying so would waste the user's time and money.
   - Failures whose `failureKind` is `rate_limit`, `timeout`, `network`, or `provider_error` shall use the consecutive-failure threshold, since these are frequently transient.
   - Escalation shall affect presentation and messaging only. It shall not change the enabled state of the connection.
   - Enabling and disabling a connection shall remain an explicit user action.

9. **Connection management UI**
   - System settings shall expose URL-addressable top-level tabs. The first tabs shall be:
     - **Your AI**
     - **Preferences**, which includes the planned UI Theme surface
   - `/workspace/settings` shall resolve to the default `/workspace/settings/your-ai` view.
   - `/workspace/settings/your-ai` shall redirect to `/workspace/settings/your-ai/overview` and remain usable as a deep link after refresh and browser back/forward navigation.
   - Your AI shall provide URL-addressable sub-navigation for:
     - **Overview**, containing the enabled connection summary and primary create action
     - **Connections**, containing configured connection management
     - **Providers**, containing supported and planned provider information
   - `/workspace/settings/preferences` shall be a presentation-only planned surface until preference behavior is implemented. It shall include the planned UI Theme surface, make no API calls, and not simulate theme changes.
   - The Your AI section shall organize AI provider management under a **Bring Your Own AI** section.
   - The Overview subpage shall show:
     - a primary **Create new connection** action
     - the total number of enabled connections
   - The Connections subpage shall show a list of existing organization-owned connections.
   - The Providers subpage shall show the supported-provider catalog.
   - The connection creation and edit workflows shall be URL-addressable at `/workspace/settings/your-ai/connections/new` and `/workspace/settings/your-ai/connections/:id/edit`.
   - The UI shall support:
     - listing configured AI connections
     - adding an AI connection
     - selecting a provider
     - entering provider-specific configuration values
     - saving the connection
     - testing the connection
     - disabling or enabling the connection where supported
     - editing an existing connection
     - deleting the connection
   - The list shall be presented as two distinct groupings rather than one undifferentiated list:
     - an **Active connections** view, expanded by default, containing connections whose health state is `ready` or `untested`
     - a **Needs attention** view, collapsed by default, containing connections whose health state is `disabled` or `failing`
   - The collapsed grouping shall show a summary count so problems remain discoverable without dominating the screen.
   - Each row shall show its health state, provider, label, and the time of its last test.
   - A failing connection shall be visibly flagged with its failure reason and shall remain enabled until the user chooses otherwise.
   - The test control shall communicate rate-limit state, including when the next test is permitted.
   - When every connection is in the Needs attention grouping, the UI shall make that condition obvious rather than presenting an apparently empty Active view.
   - When no connections exist at all, the UI shall show an empty state that explains the feature and offers the add action.
   - The supported-provider catalog shall distinguish:
     - providers available in the current build, which may expose connection actions
     - providers planned but not yet implemented, which are presentation-only and have no create, test, or simulated-result actions
   - The initial planned-provider catalog may include OpenAI, Anthropic, xAI, OpenAI-compatible hosts, and local/self-hosted model servers. Their presence shall not imply adapter availability.
   - Once OpenAI support is implemented, OpenAI shall move from the planned catalog to the available-provider catalog and expose connection creation and testing.
   - The enabled connection count shall count only connections whose `enabled` state is true; health state shall remain separately visible.

10. **Provider abstraction**
   - The backend shall use a common provider abstraction for AI work.
   - The first implementation shall support Azure OpenAI, Google Gemini, and official OpenAI adapters through the Vercel AI SDK or an equivalent provider abstraction layer.
   - The abstraction shall enable future provider additions without creating a network of new dispatch systems.

11. **Future compatibility**
    - The system shall avoid design choices that prevent later adding additional providers or future AI features.
    - The provider connection model shall remain generic enough to support later feature-specific usage patterns. Concretely, this means a future feature shall be able to select an enabled connection, obtain a configured provider adapter, and invoke it without modifying the connection schema or the registry contract.
    - The connection model shall be structured so that credentials and model selection can later be separated into reusable model profiles without discarding stored connections.

## Configurable defaults

The values below are **recommended defaults, not invariants**. They are informed estimates rather than derived constraints, and they are expected to be adjusted once real usage data exists. Every one of them shall be implemented as a named configuration value rather than an inline literal.

Requirements stated elsewhere in this spec are binding. These numbers are not.

| Setting | Recommended default | Rationale |
| --- | --- | --- |
| Per-connection test limit | 10 tests per rolling hour | Generous for edit-and-retest troubleshooting while stopping a runaway loop against one broken connection. |
| Per-organization test limit | 30 tests per rolling hour | Prevents cycling across connections to evade the per-connection limit. |
| Minimum interval between tests of one connection | 5 seconds | Absorbs double-clicks and impatient retries without consuming the hourly allowance. |
| Test request timeout | 15 seconds | A healthy provider answers the fixed prompt in roughly 1-3 seconds. This tolerates a cold start or a slow first Azure deployment call without an indefinite spinner. |
| Test output token ceiling | 64 tokens | Far more than the expected reply needs, allows for a verbose model, and bounds worst-case cost per test to a negligible amount. |
| Consecutive-failure escalation threshold | 3 failures | One failure is commonly transient, two is suspicious, three establishes a pattern. Deterministic configuration errors bypass this and escalate immediately. |

By contrast, the following are invariants and shall not be treated as tunable:

- Secrets are never returned by any API, masked or otherwise.
- Rate limiting is enforced server-side.
- A timeout aborts the underlying provider request rather than merely abandoning it.
- Connections are never automatically disabled.
- Connection health state is exposed through the API.

## Deferred dependencies

These items are deliberately out of scope here but are recorded so they are not lost when the enabling features arrive.

| Deferred item | Depends on | Intent |
| --- | --- | --- |
| "No AI providers configured" setup alert | Actionable alerts feature | When an organization has no enabled, working connection, emit an actionable alert routing the user to this settings section. See [../brainstorming/InitialAIWork/actionable-alerts-feature-brief.md](../brainstorming/InitialAIWork/actionable-alerts-feature-brief.md). |
| "AI provider failing" alert | Actionable alerts feature | The `failing` health state defined in this spec is the intended trigger source, so no new detection logic should be required. |
| Repo-sourced provider metadata | ADR 0009 runtime content | Descriptive provider metadata becomes remotely updatable; functional metadata stays bundled. |
| Separated model profiles | Future AI feature demand | Allow one credential set to back several model configurations if per-model connections become cumbersome. |

To keep the alert work cheap when it arrives, this slice shall expose connection health state through the API rather than computing it only in the frontend. An alerts producer should be able to derive "no usable AI provider" from existing backend state without new queries or duplicated rules.

## Constraints / applicable ADRs

- [ADR 0001](../ADRs/0001-organization-aware-data-access.md): organization-aware data access applies; AI provider connections are organization-scoped data and require a direct `organizationId` column.
- [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md): settings and connection management should remain URL-addressable through the existing routing patterns.
- [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md): any planned AI features should remain clearly placeholder-based until implemented.
- [ADR 0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md): runtime content must be safe, validated, and server-sourced; this spec does not require runtime content for the first slice, but descriptive provider metadata may later be sourced from a repo-backed content channel.
- [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md): governs the provider registry, the common-columns-plus-JSON storage shape, dynamic form rendering, and the prohibition on provider-specific database columns. This spec's provider metadata, connection model, and dynamic form requirements implement that ADR.
- [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md): governs credential encryption, the dedicated crypto utility package, key sourcing, decryption boundaries, and write-only secret handling. This spec's validation, safety, and connection update requirements implement that ADR.

Relevant background documents:

- [../brainstorming/InitialAIWork/ai integration.md](../brainstorming/InitialAIWork/ai%20integration.md)
- [../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md](../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md)
- [../brainstorming/InitialAIWork/actionable-alerts-feature-brief.md](../brainstorming/InitialAIWork/actionable-alerts-feature-brief.md)
- [../brainstorming/InitialAIWork/repo-sourced-runtime-content-feature-brief.md](../brainstorming/InitialAIWork/repo-sourced-runtime-content-feature-brief.md)

## UX handoff context

The existing System settings route remains the expected home for this feature. Revise it into a URL-addressable settings shell with top-level tabs. Your AI is the first functional tab; UI Theme is a planned presentation-only tab until its behavior is separately specified and implemented.

The Your AI landing page should present a Bring Your Own AI section with:

- a primary Create new connection action
- a count of enabled connections
- existing connections in two groupings: Active connections expanded by default, and a collapsed Needs attention group for disabled or failing connections
- a supported-provider catalog separated into available-now providers and planned providers
- a clear distinction between providers that can be configured now and providers shown for future direction only

The initial UX should remain simple and safe:

- show a provider selector and a dynamic, provider-specific form
- allow save, edit, test, enable/disable, and delete actions
- treat secret fields as write-only, with clear copy explaining that leaving the field blank keeps the stored value
- surface clear success and failure states, with failure messaging that maps to the failure kind (for example, credentials versus a missing deployment)
- avoid exposing secrets in the UI at any point after save
- keep planned provider cards presentation-only; they must not invoke APIs or simulate connection results
- preserve the selected settings tab and connection workflow location in the URL

Azure OpenAI and Google Gemini have noticeably different field sets, so the form must be genuinely metadata-driven rather than visually branching on two hardcoded layouts.

Real Azure credentials will be used during development. Live keys must be supplied through local environment configuration only. They must not be committed to the repository, pasted into specs, plans, debugging logs, or test fixtures, and must not appear in captured request or response examples.

## Assumptions

- The app already has an organization-aware backend model and an existing settings route to extend.
- Azure OpenAI configuration data is confirmed available and ready to use when implementation reaches the point of needing it (confirmed 2026-09-05). Azure is first in the build order by design, so this removes the main sequencing risk for the slice.
- Google Gemini credentials are expected to be available for the second adapter. If they are not, Gemini work can proceed against the registry contract and be verified live once a key exists, since the Azure adapter already proves the end-to-end path.
- The first slice will avoid streaming UI and will focus on non-streaming connectivity proof.
- The organization-owned connection model is the correct foundation for future AI feature integration.
- The implementation may use Vercel AI SDK or equivalent provider adapter abstraction as the provider compatibility layer.
- OpenAI support in this requirement means the official OpenAI API, not arbitrary OpenAI-compatible hosts.

## Resolved decisions

| Question | Decision |
| --- | --- |
| First supported adapters | Azure OpenAI, Google Gemini, and the official OpenAI API. Azure proves the complex endpoint/deployment/API-version path; Gemini and OpenAI prove the simple key-plus-model path. |
| Encryption helper placement | A dedicated crypto utility package, keeping the crypto surface small, auditable, and reusable by future secret-bearing features. |
| Connection updates in first slice | Included. Non-secret fields are editable and secrets are write-only, so users can rotate a key or change a model without deleting and recreating a connection. |
| Disabled connection visibility | Two groupings in the settings UI: an expanded Active connections view and a collapsed Needs attention view for disabled, failing, or incomplete connections. |
| Bundled versus repo-sourced metadata | Functional metadata (ids, fields, validation, adapter support) stays bundled in code. Descriptive metadata (labels, help copy, docs links, suggested models, advisories) is eligible for later repo-sourced delivery. |
| Test result payload | A discriminated success/failure result with `status`, `latencyMs`, `testedAt`, response text on success, and a fixed `failureKind` vocabulary plus a safe message on failure. |
| Connection-to-model relationship | One connection represents one provider credential set plus one model. Users add a separate connection for each model they want to use. Separating credentials from reusable model profiles is deferred. |
| Uniqueness within an organization | Connection label must be unique per organization. Credentials and provider/model combinations are not constrained, so duplicate or parallel connections remain possible. |
| Test rate limiting | The test action is rate-limited per organization to prevent accidental cost and provider throttling. |
| Repeated test failures | A repeatedly failing connection is flagged only. The system never auto-disables a connection; enable/disable stays a user decision. |
| Setup-state alert | Deferred to the actionable alerts feature. This spec records the dependency so it is not lost. |
| Rate-limit thresholds | Two-tier per-connection and per-organization limits plus a minimum interval between repeat tests. Recommended values in Configurable defaults. |
| Test call bounds | A request timeout that aborts the underlying provider call, and an output token ceiling. Recommended values in Configurable defaults. |
| Failure escalation threshold | A consecutive-failure threshold, reset on any success. Deterministic configuration errors (`auth`, `not_found`, `bad_request`) escalate on the first failure. Recommended value in Configurable defaults. |

## Open questions

None outstanding. OpenAI support is bounded to the official OpenAI API; OpenAI-compatible hosts remain a separate future capability.

Tunable values are collected in Configurable defaults with recommended starting points and rationale. They are expected to be adjusted based on real usage and shall be implemented as named configuration rather than inline literals.

## Definition of done

- The app has a provider registry supporting Azure OpenAI, Google Gemini, and the official OpenAI API.
- The storage model supports organization-scoped AI provider connections.
- A configuration form renders provider-specific fields dynamically from bundled provider metadata.
- Secret values are encrypted at rest by a dedicated crypto utility package and are never returned by list or read APIs.
- Users can create, edit, test, enable/disable, and delete a saved provider connection.
- Secret rotation works without requiring the user to delete and recreate a connection.
- The backend can successfully call Azure OpenAI, Google Gemini, and the official OpenAI API using real credentials in development.
- Connection tests return the defined discriminated result payload, including a classified failure kind on failure.
- The settings UI separates active connections from those needing attention.
- The feature is integrated into the existing System settings experience with Your AI and UI Theme tabs.
- The Your AI landing page shows the create action, enabled-connection count, existing connection list, and supported-provider catalog.
- Planned providers are visibly labeled as unavailable and do not expose actions or invoke APIs.
- Clear error states exist for validation and provider connectivity failures.
- The test action is rate-limited per organization and enforced server-side.
- Connection health state is exposed through the API for future alerting consumers.

## Acceptance criteria

1. A user can navigate to the existing System settings area and access the AI Connections section.
2. The user can choose Azure OpenAI, Google Gemini, or OpenAI from a provider selector.
3. Selecting Azure OpenAI shows endpoint, deployment, API key, and API version fields; selecting Google Gemini shows API key and model fields; selecting OpenAI shows API key and model fields. No irrelevant fields are shown for any provider.
4. The user can save an AI provider connection tied to their organization.
5. The saved connection does not expose secret values in list or read responses.
6. The user can edit a saved connection's label and non-secret configuration without re-entering the secret.
7. Submitting an edit with a non-empty secret field replaces the stored secret; submitting with a blank secret field preserves it.
8. Editing a connection clears a previous successful test so a stale success state is not displayed, while preserving a previous failure state in Needs attention until a successful retest.
9. The user can trigger a connection test and receive a success result containing response text and latency, or a failure result containing a classified failure kind and a safe message.
10. An invalid credential produces a failure result with `failureKind` of `auth`, not a generic or raw provider error.
11. The backend rejects a connection that omits a provider-required field, with a validation message identifying the field.
12. All three provider adapters successfully call their live provider in a development environment with valid credentials.
13. Enabled and healthy connections appear in the Active connections view; disabled and failing connections appear in their corresponding status views with visible counts.
14. The connection can be disabled, re-enabled, or deleted without breaking the settings experience.
15. An organization can hold multiple connections, including two connections for the same provider using different models.
16. Saving a connection whose label duplicates an existing label in the same organization is rejected with a clear validation message.
17. Exceeding the per-organization test rate limit is rejected server-side before any provider call is made, with a message indicating when testing can resume.
18. Exceeding the configured per-connection limit is rejected, as is exceeding the configured per-organization limit across different connections.
19. Two test clicks within the configured minimum interval on the same connection result in a single provider call.
20. A provider that does not respond within the configured timeout produces a `timeout` failure, and the underlying provider request is aborted rather than left in flight.
21. A test call requests no more than the configured output token ceiling.
22. Rate-limit thresholds, timeout, token ceiling, and escalation threshold are all readable from named configuration rather than inline literals.
23. A connection that fails testing repeatedly remains enabled and is flagged in the Needs attention view; it is never auto-disabled.
24. Reaching the configured consecutive-failure threshold with transient failures escalates the connection's presentation; a single `auth` failure escalates immediately.
25. A successful test resets the consecutive failure count and clears escalated presentation.
26. Connection health state is available through the API, so a future alerts producer can determine that an organization has no usable AI provider without new backend logic.
27. No secret value appears in any API response, server log, or frontend payload at any point in the flow.
28. Future AI feature work can select an enabled connection, obtain a provider adapter, and invoke it without schema or registry-contract changes.
29. `/workspace/settings` resolves to `/workspace/settings/your-ai`, and direct navigation, refresh, and browser back/forward preserve the selected settings view.
30. The Your AI landing page displays a Create new connection action, the total enabled-connection count, existing connections, and a supported-provider catalog.
31. Available providers expose the connection workflow; planned providers are labeled not implemented and expose no create, test, or simulated-result action.
32. `/workspace/settings/theme` renders a clearly planned UI Theme surface without making API calls or simulating theme changes.
