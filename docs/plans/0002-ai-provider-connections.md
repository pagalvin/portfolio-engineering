# Plan 0002: AI Provider Connections

- Status: `draft`
- Date: 2026-09-05
- Spec: [0002-ai-provider-connections](../specs/0002-ai-provider-connections.md)
- Audience: [coding-agents, database-agents, uxd, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: E-01
- Completed efforts: none
- Blocked tasks: none
- Next recommended task: T-01.1
- Last updated: 2026-09-05

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Crypto utility package | 2 | 0 | pending |
| E-02 | Persistence design and migration | 3 | 0 | pending |
| E-03 | Provider registry and adapters | 4 | 0 | pending |
| E-04 | API surface | 5 | 0 | pending |
| E-05 | Settings UI | 5 | 0 | pending |
| E-06 | Live verification and hardening | 3 | 0 | pending |

## Summary

Deliver organization-scoped BYOK AI provider connections: a dedicated crypto package for secret-at-rest, a Prisma model with JSON payloads, a provider registry with Azure OpenAI and Google Gemini adapters, a protected API surface, and a settings UI with two-group presentation.

The sequencing prioritises proving one real end-to-end path early. Azure is wired first because it has the hardest field shape; the rate-limiting and escalation policy layer lands after a connection can actually be created and tested.

## Inputs

- Spec readiness at planning time: `Ready for planning`, no open questions. Azure OpenAI configuration data confirmed available 2026-09-05.
- ADRs reviewed: [0001](../ADRs/0001-organization-aware-data-access.md), [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004](../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md), [0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md), [0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md).
- UX artifacts used: none exist for this feature. See R-1; UXD involvement is recommended before E-05.
- Schema reference: [schema.prisma](../../packages/database/prisma/schema.prisma). Existing models all carry a direct `organizationId` with an index, which this work follows.
- Intersecting tech debt: TD-006 notes the Journal shipped without focused frontend tests. This plan adds targeted tests for security-relevant behavior rather than repeating that gap wholesale.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0001](../ADRs/0001-organization-aware-data-access.md) | Connections are organization-owned data requiring a direct `organizationId` column and scoped queries. | E-02, E-04 |
| [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | The settings surface must remain URL-addressable. | E-05 |
| [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) | New settings route work uses React Router declarative patterns. | E-05 |
| [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | New UI uses repository-local primitives in `components/ui`. | E-05 |
| [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) | Governs registry ownership, JSON payload storage, dynamic forms, and the ban on provider-specific columns. | E-02, E-03, E-04, E-05 |
| [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) | Governs encryption, key sourcing, decryption boundaries, and write-only secrets. | E-01, E-02, E-04 |

[ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) applies only in that Settings placeholder blocks not covered by this work must remain placeholders. [ADR 0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md) does not bind this plan; metadata is bundled in code for this slice.

## Approach

**Codebase findings that shape this plan.** These were verified against the repository, not assumed:

- `packages/` contains `auth`, `database`, `shared-types`, `ui`, `validation`. A new `packages/crypto` and `packages/ai` fit the existing workspace convention (`pnpm-workspace.yaml` globs `packages/*`).
- The store pattern is established: [journalStore.ts](../../packages/database/src/journalStore.ts) exports a factory taking a `PrismaClient`, with every method requiring `organizationId`. Follow it exactly.
- Route registration follows [protected.ts](../../apps/api/src/plugins/protected.ts), which applies a `jwtVerify` hook and re-derives `request.user` before delegating to feature plugins like [journal.ts](../../apps/api/src/plugins/journal.ts).
- Shared Zod schemas live in `packages/validation/src` and are imported by API routes via subpath exports such as `@portfolio-engineering/validation/journal`.
- **The Settings route is placeholder-only.** [scaffoldRoutes.ts](../../apps/frontend/src/scaffoldRoutes.ts) defines `settings` with `placeholderBlocks: ['Preferences', 'Connections', 'Actions', 'Notes']`, and [PlaceholderPage.tsx](../../apps/frontend/src/PlaceholderPage.tsx) renders those strings as inert grid cells. "Connections" is a label, not a surface. Building the real page is genuine scope, not an integration.
- The Journal precedent for replacing a placeholder is a dedicated page component routed in `App.tsx` alongside `PlaceholderPage`, which is the pattern E-05 follows.
- Available UI primitives: `alert`, `button`, `card`, `copy-button`, `dialog`, `input`, `textarea`. There is no select/dropdown primitive, so the provider selector needs one added.
- `.env.example` shows unprefixed server variables and `VITE_`-prefixed client variables, confirming the naming boundary ADR 0011 requires.

**Sequencing rationale.** Efforts are ordered so a real Azure call succeeds as early as possible. E-01 through E-04 deliver create-and-test; the cost-control and escalation policy in T-04.5 lands after that path works. This follows the spec's own observation that the policy apparatus is sophisticated relative to the feature and should not precede a working vertical slice.

**Secret handling discipline.** Real Azure credentials will be in the working tree's `.env`. No task may commit credentials, paste them into notes, or capture them in fixtures. Debugging log entries must redact provider request bodies.

## Non-goals

- Provider adapters beyond Azure OpenAI and Google Gemini.
- Streaming responses.
- Any end-user AI feature consuming these connections.
- Repo-sourced runtime metadata delivery.
- The actionable alerts feature.
- Rebuilding Settings placeholder blocks other than Connections.

---

## E-01: Crypto utility package

**Goal:** A dedicated, auditable package providing authenticated encryption for recoverable secrets.

**Exit gate:** `packages/crypto` encrypts and decrypts round-trip, rejects tampered ciphertext, fails fast on missing or malformed keys, and is covered by tests. No other effort may store a secret before this gate passes.

**Depends on:** none

### T-01.1: Creating the crypto utility package

- **Status:** pending
- **Owner:** coding
- **Depends on:** none
- **Files:**
  - `packages/crypto/package.json` (new)
  - `packages/crypto/tsconfig.json` (new)
  - `packages/crypto/src/index.ts` (new)
  - `packages/crypto/src/secretBox.ts` (new)
- **Intent:** Provide AES-256-GCM encrypt/decrypt helpers with a per-record IV, returning a self-describing payload that carries IV, auth tag, and a key version identifier. Mirror the package scaffolding of `packages/validation`.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do use AES-256-GCM with a freshly generated IV per record; Do store IV and auth tag with the ciphertext; Do keep encryption in a dedicated, dependency-light package. Do Not use a fixed or reused IV.
- **Verify:** Encrypting the same plaintext twice yields different ciphertext. Decrypt returns the original plaintext. Mutating any byte of ciphertext, IV, or tag causes decryption to throw rather than return data. Package builds and typechecks with no runtime dependency beyond `node:crypto`.
- **Notes:** _(appended by executing agents)_

### T-01.2: Adding key sourcing and fail-fast validation

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-01.1
- **Files:**
  - `packages/crypto/src/keySource.ts` (new)
  - `.env.example` (modified)
- **Intent:** Read the encryption key from a server-only environment variable, validate its length and encoding at startup, and throw a clear error when absent or malformed. Add the unprefixed variable to `.env.example` with a comment that it must never be `VITE_`-prefixed.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do read the key from a server-only environment variable; Do fail fast at startup rather than degrading to unencrypted storage. Do Not expose the key to the frontend or persist it in the database.
- **Verify:** A missing or short key produces a descriptive startup error. No `VITE_`-prefixed key variable exists anywhere. `.env.example` documents the variable without a real value.
- **Notes:** _(appended by executing agents)_

---

## E-02: Persistence design and migration

**Goal:** An organization-scoped connection model using common columns plus JSON payloads, with a store following existing conventions.

**Exit gate:** The migration applies cleanly, the generated client exposes the model, `docs/schema/current.md` is updated, and the store enforces `organizationId` on every operation. API work may not begin before this gate.

**Depends on:** E-01

### T-02.1: Designing the AI connection persistence contract

- **Status:** pending
- **Owner:** database-design
- **Depends on:** T-01.1
- **Files:**
  - `docs/schema/0002-ai-provider-connections-design.md` (new)
- **Intent:** Define the model, columns, JSON payload shapes, indexes, uniqueness constraints, lifecycle behavior, and the application-facing store contract before any schema change. Must specify the `organizationId` + label unique constraint and resolve how `disabled` interacts with a retained consecutive-failure count.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do use common columns for identity and lifecycle plus JSON payloads for provider-specific values; Do keep secret payloads separate from non-secret configuration. Do Not add provider-specific columns or a table per provider. [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do add a direct `organizationId` column.
- **Verify:** The design document specifies every column and index, states the secret/non-secret payload split, defines the label uniqueness constraint, and answers R-2. No provider-specific columns appear.
- **Notes:** _(appended by executing agents)_

### T-02.2: Implementing the schema and migration

- **Status:** pending
- **Owner:** database-design
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified)
  - `packages/database/prisma/migrations/` (new migration)
  - `docs/schema/current.md` (modified)
- **Intent:** Add the `AiConnection` model per the approved design, with `organizationId` relation and index matching existing models, and generate the migration.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do add a direct `organizationId` column to every organization-owned table; Do document the relation consistently with existing models. [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do Not add provider-specific columns.
- **Verify:** Migration applies to a clean database. Generated client exposes the model. A unique constraint on `(organizationId, label)` exists. `docs/schema/current.md` reflects the new model.
- **Notes:** _(appended by executing agents)_

### T-02.3: Adding the AI connection store

- **Status:** pending
- **Owner:** database-design
- **Depends on:** T-02.2
- **Files:**
  - `packages/database/src/aiConnectionStore.ts` (new)
  - `packages/database/src/index.ts` (modified)
- **Intent:** Provide a `createAiConnectionStore` factory following [journalStore.ts](../../packages/database/src/journalStore.ts), with every method requiring `organizationId`. Include create, list, findById, update, delete, enable/disable, and test-metadata update. Encrypt on write and expose a separate explicit decrypt path used only by the invocation layer.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do filter every read, write, update, and delete by `organizationId`; Do treat missing organization scope as an error. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not decrypt in list or read paths.
- **Verify:** Every store method requires `organizationId`. List and read return records with no plaintext secret and no decryption performed. A record fetched for another organization is not returned. Store is exported from the package index.
- **Notes:** _(appended by executing agents)_

---

## E-03: Provider registry and adapters

**Goal:** A `packages/ai` registry owning provider definitions, validation schemas, and adapter factories for Azure OpenAI and Google Gemini.

**Exit gate:** The registry validates payloads for both providers and can construct an adapter that performs a bounded, non-streaming text generation call. Adding a provider requires no schema change.

**Depends on:** E-01

### T-03.1: Creating the provider registry package and contracts

- **Status:** pending
- **Owner:** coding
- **Depends on:** none
- **Files:**
  - `packages/ai/package.json` (new)
  - `packages/ai/tsconfig.json` (new)
  - `packages/ai/src/index.ts` (new)
  - `packages/ai/src/registry.ts` (new)
  - `packages/ai/src/types.ts` (new)
- **Intent:** Define the provider definition type (id, field schema with secret classification, adapter factory), the flat registry that maps provider id to definition, and the shared test-result type including the `failureKind` vocabulary. One dispatcher, no nesting.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do define each provider once including id, field schema, secret classification, and adapter factory; Do keep the registry flat. Do Not add dispatch layers on top of the registry.
- **Verify:** The registry exposes provider metadata and a lookup by id. The result type discriminates success and failure with the full eight-value `failureKind` union. Adding a provider entry touches only the registry.
- **Notes:** _(appended by executing agents)_

### T-03.2: Defining Azure OpenAI and Gemini provider definitions

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-03.1
- **Files:**
  - `packages/ai/src/providers/azureOpenAi.ts` (new)
  - `packages/ai/src/providers/googleGemini.ts` (new)
  - `packages/validation/src/aiConnection.ts` (new)
  - `packages/validation/package.json` (modified)
- **Intent:** Declare Azure OpenAI fields (endpoint, deployment, API key, API version) and Gemini fields (API key, model), each marked secret or non-secret, with Zod validation shared between API and frontend via a subpath export following the `validation/journal` precedent.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do drive UI forms and backend validation from the same provider definitions; Do separate functional metadata from descriptive metadata.
- **Verify:** Both definitions validate a correct payload and reject one missing a required field, naming the field. Secret fields are classified distinctly from non-secret fields. The subpath export resolves from the API package.
- **Notes:** _(appended by executing agents)_

### T-03.3: Implementing the Azure OpenAI adapter

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-03.2
- **Files:**
  - `packages/ai/src/providers/azureOpenAi.ts` (modified)
  - `packages/ai/src/invoke.ts` (new)
  - `packages/ai/package.json` (modified)
- **Intent:** Implement a bounded non-streaming generation call for Azure OpenAI, with an abortable timeout and an output token ceiling, mapping provider and transport errors onto the `failureKind` vocabulary. Azure is first because its endpoint/deployment/API-version shape is the hardest and proves the dynamic-field path.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do decrypt only in server-side paths about to use the secret; Do Not pass raw provider error bodies to clients without filtering.
- **Verify:** A successful call returns response text and latency. An invalid key maps to `auth`, a wrong deployment to `not_found`. Timeout aborts the in-flight request rather than abandoning it. No credential value appears in any thrown error or log line.
- **Notes:** _(appended by executing agents)_

### T-03.4: Implementing the Google Gemini adapter

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-03.3
- **Files:**
  - `packages/ai/src/providers/googleGemini.ts` (modified)
- **Intent:** Implement the same bounded call contract for Gemini, reusing the shared invocation and error-mapping helpers to confirm the abstraction generalises beyond one provider.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do Not re-encode provider knowledge outside the registry.
- **Verify:** Gemini uses the shared invocation path with no provider-specific branching outside its definition. Error mapping produces the same `failureKind` vocabulary. If no live key is available, verification is deferred to T-06.2 and recorded in Notes.
- **Notes:** _(appended by executing agents)_

---

## E-04: API surface

**Goal:** Protected, organization-scoped endpoints for provider metadata and connection lifecycle, including testing.

**Exit gate:** All endpoints work under the protected plugin, secrets never appear in responses, and a connection can be created and tested end to end against live Azure.

**Depends on:** E-02, E-03

### T-04.1: Adding the AI routes plugin skeleton

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-02.3, T-03.1
- **Files:**
  - `apps/api/src/plugins/ai.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified)
- **Intent:** Register an AI routes plugin inside the existing protected scope so it inherits `jwtVerify` and the re-derived `request.user`, following the journal registration precedent. Add `GET /api/ai/providers` returning safe provider metadata only.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do read `organizationId` from verified auth context. [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do determine provider usability from adapter support in the running build.
- **Verify:** Unauthenticated requests are rejected. The providers endpoint returns field definitions for both providers and no secret values. Only providers with a working adapter are listed as usable.
- **Notes:** _(appended by executing agents)_

### T-04.2: Implementing connection create and list

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/api/src/plugins/ai.ts` (modified)
- **Intent:** Add `POST /api/ai/connections` and `GET /api/ai/connections`, validating payloads against the provider definition, encrypting secrets on write, and returning records with health state and no secret material.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do treat secret fields as write-only across all APIs; Do Not return secret values from any API, masked or otherwise. [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do scope all operations by `organizationId`.
- **Verify:** Creating a connection persists ciphertext, not plaintext. The create response contains no secret. Listing returns only the caller's organization records. A payload missing a required provider field is rejected naming the field. A duplicate label in the same organization is rejected.
- **Notes:** _(appended by executing agents)_

### T-04.3: Implementing connection update and delete

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-04.2
- **Files:**
  - `apps/api/src/plugins/ai.ts` (modified)
- **Intent:** Add `PATCH /api/ai/connections/:id` handling non-secret edits, write-only secret rotation, and enable/disable, plus `DELETE`. A blank secret preserves the stored value; a supplied value replaces it. Updating invalidates the prior test result.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do preserve the stored secret when the field is blank and replace it when a value is supplied.
- **Verify:** Blank secret on update leaves ciphertext unchanged; a supplied secret changes it. Editing clears prior test result so a stale success is not displayed. Delete removes only the caller's organization record. Cross-organization update or delete returns not-found rather than succeeding.
- **Notes:** _(appended by executing agents)_

### T-04.4: Implementing the connection test endpoint

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-04.3, T-03.3
- **Files:**
  - `apps/api/src/plugins/ai.ts` (modified)
- **Intent:** Add `POST /api/ai/connections/:id/test`, decrypting server-side, invoking through the registry with the fixed prompt, returning the discriminated result, and persisting test metadata including the consecutive failure count.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do decrypt only inside server-side paths immediately before calling a provider; Do exclude secret values from logs, error messages, and telemetry.
- **Verify:** A live Azure connection returns success with response text and latency. An invalid key returns `failureKind` of `auth`. Persisted metadata records outcome, timestamp, safe error summary, and failure count. No secret appears in server logs during success or failure.
- **Notes:** _(appended by executing agents)_

### T-04.5: Adding test rate limiting and failure escalation

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-04.4
- **Files:**
  - `apps/api/src/plugins/ai.ts` (modified)
  - `apps/api/src/lib/aiTestLimits.ts` (new)
- **Intent:** Enforce the two-tier rate limit and minimum interval server-side before any provider call, and implement escalation on consecutive failures with immediate escalation for `auth`, `not_found`, and `bad_request`. All thresholds come from named configuration, not literals. Sequenced after T-04.4 so the working path exists before the policy layer.
- **ADRs:** none beyond the spec's Configurable defaults section.
- **Verify:** Exceeding a configured limit is rejected before the provider is contacted, with a resume-time message. Two clicks inside the minimum interval produce one provider call. A deterministic failure escalates on first occurrence; transient failures escalate at the configured threshold. A success resets the count. Thresholds are readable from named configuration.
- **Notes:** _(appended by executing agents)_

---

## E-05: Settings UI

**Goal:** A real Settings page with an AI Connections section supporting the full connection lifecycle.

**Exit gate:** A user can create, edit, test, enable/disable, and delete a connection through the UI, with secrets never displayed and both provider forms rendered from metadata.

**Depends on:** E-04

### T-05.1: Replacing the Settings placeholder with a real page

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/frontend/src/SettingsPage.tsx` (new)
  - `apps/frontend/src/App.tsx` (modified)
- **Intent:** Add a routed Settings page following the Journal precedent, replacing `PlaceholderPage` for the `settings` route only. Preserve the Preferences, Actions, and Notes blocks as placeholders; build out Connections only.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Do keep the surface URL-addressable. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — Do use React Router declarative navigation. [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — Do keep unimplemented blocks as shared placeholders.
- **Verify:** `/workspace/settings` renders the new page; refresh and back/forward preserve it. Non-Connections blocks still present as placeholders and make no API calls. Other scaffold routes are unaffected.
- **Notes:** _(appended by executing agents)_

### T-05.2: Adding a select primitive and the connections API client

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-05.1
- **Files:**
  - `apps/frontend/src/components/ui/select.tsx` (new)
  - `apps/frontend/src/aiConnectionApi.ts` (new)
- **Intent:** Add the missing accessible select primitive to `components/ui` for the provider selector, and a typed API client module following the [journalApi.ts](../../apps/frontend/src/journalApi.ts) precedent.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do use repository-local UI primitives and semantic Tailwind tokens; Do Not introduce a competing styling system.
- **Verify:** The select is keyboard operable with a visible focus state and an accessible label. The API client exposes typed methods for all six endpoints and carries auth via the existing client pattern.
- **Notes:** _(appended by executing agents)_

### T-05.3: Building the metadata-driven connection form

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-05.2
- **Files:**
  - `apps/frontend/src/components/AiConnectionForm.tsx` (new)
- **Intent:** Render fields dynamically from provider metadata so Azure and Gemini produce different forms with no hardcoded per-provider layout. Treat secret fields as write-only with copy explaining that a blank value keeps the stored secret.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do render forms dynamically from provider metadata. Do Not hardcode per-provider form layouts in frontend components. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not display secret values after save.
- **Verify:** Selecting Azure shows endpoint, deployment, key, and API version; Gemini shows key and model; neither shows the other's fields. Removing a field from metadata removes it from the form with no component change. Editing shows a stored-secret indication and never a secret value.
- **Notes:** _(appended by executing agents)_

### T-05.4: Building the two-group connection list

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-05.3
- **Files:**
  - `apps/frontend/src/components/AiConnectionList.tsx` (new)
- **Intent:** Present Active connections expanded and Needs attention collapsed with a count, each row showing health state, provider, label, and last test time, with edit, test, enable/disable, and delete actions.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do preserve accessible semantic UI using repository primitives.
- **Verify:** `ready` and `untested` appear in Active; `failing` and `disabled` in Needs attention with a visible count. All-failing shows an informative state rather than an apparently empty Active view. No connections shows an explanatory empty state with the add action. Groups are keyboard accessible.
- **Notes:** _(appended by executing agents)_

### T-05.5: Wiring test results and failure messaging

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-05.4, T-04.5
- **Files:**
  - `apps/frontend/src/components/AiConnectionList.tsx` (modified)
  - `apps/frontend/src/SettingsPage.tsx` (modified)
- **Intent:** Surface test outcomes with remediation mapped to `failureKind`, and communicate rate-limit state including when the next test is permitted.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do preserve accessible status and error presentation.
- **Verify:** Success shows response text and latency. `auth` and `not_found` produce distinguishable, actionable messages rather than a generic error. Rate-limited state shows the resume time. Result states are announced accessibly.
- **Notes:** _(appended by executing agents)_

---

## E-06: Live verification and hardening

**Goal:** Confirm real provider connectivity and prove the security invariants hold.

**Exit gate:** Both adapters verified against live providers where credentials exist, and secret-leak invariants covered by tests.

**Depends on:** E-05

### T-06.1: Verifying Azure OpenAI end to end

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-05.5
- **Files:**
  - `docs/debugging/0002-ai-provider-connections-debugging.md` (new)
- **Intent:** Create, test, rotate, and delete a live Azure connection through the UI, recording findings. Confirmed configuration data is available per the spec's Assumptions.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not write secrets to logs or documentation.
- **Verify:** A live Azure call returns a real response through the UI. Key rotation works without recreating the connection. The debugging log contains no credential values and no unredacted request bodies.
- **Notes:** _(appended by executing agents)_

### T-06.2: Verifying Google Gemini end to end

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-06.1
- **Files:**
  - `docs/debugging/0002-ai-provider-connections-debugging.md` (modified)
- **Intent:** Repeat live verification for Gemini, confirming two structurally different providers work through one registry and one form.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not write secrets to logs or documentation.
- **Verify:** A live Gemini call succeeds through the UI with no provider-specific frontend branching. If credentials are unavailable, mark this task `blocked` with the reason rather than `done`.
- **Notes:** _(appended by executing agents)_

### T-06.3: Adding focused security and contract tests

- **Status:** pending
- **Owner:** coding
- **Depends on:** T-06.1
- **Files:**
  - `packages/crypto/src/secretBox.test.ts` (new)
  - `apps/api/src/plugins/ai.test.ts` (new)
- **Intent:** Cover the invariants that must not silently regress: no secret in any response, cross-organization isolation, blank-secret preservation on update, tamper detection, and server-side rate-limit enforcement. Targeted coverage of security-relevant behavior, addressing the gap TD-006 records for the Journal.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do verify that no API response includes a secret value; Do verify tampered ciphertext fails to decrypt. [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do verify cross-organization rows are excluded.
- **Verify:** Tests fail if a secret is added to any response shape, if organization scoping is dropped from a store method, if blank-secret update overwrites a stored value, or if rate limiting is bypassed. All tests pass.
- **Notes:** _(appended by executing agents)_

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | No UX artifacts exist for this feature. The spec carries a UX handoff section, but `docs/uxd` has no flow or prototype, and Settings has never had a real page. The two-group list and write-only secret affordance are non-obvious to get right. | Medium. E-05 may need rework if UX is designed after implementation. | uxd | E-05 (advisory, not hard-blocking) |
| R-2 | Health state treats `disabled` and `failing` as exclusive, but a disabled connection may retain a failure count. Re-enabling has undefined behavior: return to `failing`, reset to `untested`, or retain the count. | Low. Two reasonable implementations diverge without a decision. | database-design | T-02.1 |
| R-3 | Real Azure credentials will be present in the working tree during E-03 through E-06. This repository's workflow generates extensive documentation, which is a likely accidental leak path. | High if realised. Committed credentials require rotation and history rewrite. | coding | all of E-03 through E-06 |
| R-4 | `PATCH` carries non-secret edits, secret rotation, and enable/disable. Enable/disable is triggered from a list row rather than a form and has distinct audit implications. | Low. May warrant a dedicated endpoint discovered during T-04.3. | coding | T-04.3 |
| R-5 | Vercel AI SDK adds dependencies to a workspace that has so far stayed lean. Azure OpenAI and Gemini could be called over plain HTTPS instead. The spec permits "or an equivalent provider abstraction layer". | Medium. Affects dependency footprint and long-term maintenance. | coding | T-03.3 |
| R-6 | The registry, health state, and connection model are designed against predicted future needs, since no AI feature consumes them yet. | Medium. Expect revision when the first real consumer lands; do not treat this model as settled. | architect | none |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-05 | Initial plan | Created from spec 0002. Codebase verified: Settings is placeholder-only, so E-05 includes building the page; no select primitive exists; `packages/crypto` and `packages/ai` are new workspace packages. |
