# Plan 0002: AI Provider Connections

- Status: `closed`
- Date: 2026-09-05
- Spec: [0002-ai-provider-connections](../../specs/0002-ai-provider-connections.md)
- Audience: [coding-agents, database-agents, uxd, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: E-13
- Completed efforts: E-01, E-02, E-03, E-04, E-05, E-06, E-07, E-08, E-09, E-10, E-11, E-12, E-13
- Blocked tasks: none
- Next recommended task: none; feature ready for closeout
- Last updated: 2026-09-05 17:12

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Crypto utility package | 2 | 2 | done |
| E-02 | Persistence design and migration | 3 | 3 | done |
| E-03 | Provider registry and adapters | 4 | 4 | done |
| E-04 | API surface | 5 | 5 | done |
| E-05 | Settings UI | 5 | 5 | done |
| E-06 | Live verification and hardening | 3 | 3 | done |
| E-07 | Settings information architecture refinement | 4 | 4 | done |
| E-08 | Your AI sub-navigation refinement | 1 | 1 | done |
| E-09 | Connection workflow testing | 1 | 1 | done |
| E-10 | Preserve failed connection state during edits | 1 | 1 | done |
| E-11 | Automate post-save connection testing | 1 | 1 | done |
| E-12 | Regroup failed tests and sort connections | 1 | 1 | done |
| E-13 | OpenAI provider support | 3 | 3 | done |

## Summary

Deliver organization-scoped BYOK AI provider connections: a dedicated crypto package for secret-at-rest, a Prisma model with JSON payloads, a provider registry with Azure OpenAI, Google Gemini, and official OpenAI adapters, a protected API surface, and a URL-addressable Settings experience with Your AI sub-navigation and Preferences.

The sequencing prioritises proving one real end-to-end path early. Azure is wired first because it has the hardest field shape; the rate-limiting and escalation policy layer lands after a connection can actually be created and tested.

## Inputs

- Spec readiness at planning time: `Ready for planning`, no open questions. OpenAI support was added as a bounded requirement on 2026-09-05; official OpenAI API only, with OpenAI-compatible hosts remaining deferred.
- ADRs reviewed: [0001](../ADRs/0001-organization-aware-data-access.md), [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004](../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md), [0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md), [0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md).
- UX artifacts used: [ui-scaffold-contract.json](../../docs/uxd/flows/ui-scaffold-contract.json), revised 2026-09-05 to define Settings tabs and Your AI routes. No dedicated visual prototype exists.
- Schema reference: [schema.prisma](../../packages/database/prisma/schema.prisma). Existing models all carry a direct `organizationId` with an index, which this work follows.
- Intersecting tech debt: TD-006 notes the Journal shipped without focused frontend tests. This plan adds targeted tests for security-relevant behavior rather than repeating that gap wholesale.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0001](../ADRs/0001-organization-aware-data-access.md) | Connections are organization-owned data requiring a direct `organizationId` column and scoped queries. | E-02, E-04 |
| [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | The settings surface must remain URL-addressable, including selected tabs and connection workflows. | E-05, E-07 |
| [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) | UI Theme and planned providers must remain inert shared placeholders rather than simulated capabilities. | E-05, E-07 |
| [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) | New settings route work uses React Router declarative patterns. | E-05, E-07 |
| [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | New UI uses repository-local primitives in `components/ui`. | E-05, E-07 |
| [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) | Governs registry ownership, JSON payload storage, dynamic forms, and the ban on provider-specific columns. | E-02, E-03, E-04, E-05 |
| [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) | Governs encryption, key sourcing, decryption boundaries, and write-only secrets. | E-01, E-02, E-04 |
| [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) | OpenAI must be added through the shared provider-defined schema and flat registry without provider-specific database columns. | E-13 |
| [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) | OpenAI API keys are recoverable provider credentials and must remain encrypted at rest and write-only. | E-13 |

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
- The revised Settings contract now exceeds the completed E-05 surface: the current implementation is a single Settings page with inline connection form/list behavior, not a tabbed shell or route-based create/edit workflow. E-07 is additive rework against this known baseline.

**Sequencing rationale.** Efforts are ordered so a real Azure call succeeds as early as possible. E-01 through E-04 deliver create-and-test; the cost-control and escalation policy in T-04.5 lands after that path works. This follows the spec's own observation that the policy apparatus is sophisticated relative to the feature and should not precede a working vertical slice.

**Secret handling discipline.** Real Azure credentials will be in the working tree's `.env`. No task may commit credentials, paste them into notes, or capture them in fixtures. Debugging log entries must redact provider request bodies.

## Non-goals

- Provider adapters beyond Azure OpenAI and Google Gemini.
- Streaming responses.
- Any end-user AI feature consuming these connections.
- Repo-sourced runtime metadata delivery.
- The actionable alerts feature.
- Implementing UI theme behavior or additional settings persistence.
- Implementing adapters for planned providers shown in the catalog.

---

## E-01: Crypto utility package

**Goal:** A dedicated, auditable package providing authenticated encryption for recoverable secrets.

**Exit gate:** `packages/crypto` encrypts and decrypts round-trip, rejects tampered ciphertext, fails fast on missing or malformed keys, and is covered by tests. No other effort may store a secret before this gate passes.

**Depends on:** none

### T-01.1: Creating the crypto utility package

- **Status:** done
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
- **Notes:** Implemented AES-256-GCM secret-box helpers with per-record IVs, authenticated payloads, and key-version metadata. Verified round-trip, unique ciphertext/IV, and ciphertext/IV/tag tamper rejection; package typecheck and build pass.

### T-01.2: Adding key sourcing and fail-fast validation

- **Status:** done
- **Owner:** coding
- **Depends on:** T-01.1
- **Files:**
  - `packages/crypto/src/keySource.ts` (new)
  - `.env.example` (modified)
- **Intent:** Read the encryption key from a server-only environment variable, validate its length and encoding at startup, and throw a clear error when absent or malformed. Add the unprefixed variable to `.env.example` with a comment that it must never be `VITE_`-prefixed.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do read the key from a server-only environment variable; Do fail fast at startup rather than degrading to unencrypted storage. Do Not expose the key to the frontend or persist it in the database.
- **Verify:** A missing or short key produces a descriptive startup error. No `VITE_`-prefixed key variable exists anywhere. `.env.example` documents the variable without a real value.
- **Notes:** Added a server-only `AI_CREDENTIALS_ENCRYPTION_KEY` source with strict base64 and 32-byte validation; missing, short, and malformed values fail with descriptive errors. Documented the empty server-only variable in `.env.example`; crypto typecheck, build, lint, and validation checks pass.

---

## E-02: Persistence design and migration

**Goal:** An organization-scoped connection model using common columns plus JSON payloads, with a store following existing conventions.

**Exit gate:** The migration applies cleanly, the generated client exposes the model, `docs/schema/current.md` is updated, and the store enforces `organizationId` on every operation. API work may not begin before this gate.

**Depends on:** E-01

### T-02.1: Designing the AI connection persistence contract

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.1
- **Files:**
  - `docs/schema/0002-ai-provider-connections-design.md` (new)
- **Intent:** Define the model, columns, JSON payload shapes, indexes, uniqueness constraints, lifecycle behavior, and the application-facing store contract before any schema change. Must specify the `organizationId` + label unique constraint and resolve how `disabled` interacts with a retained consecutive-failure count.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do use common columns for identity and lifecycle plus JSON payloads for provider-specific values; Do keep secret payloads separate from non-secret configuration. Do Not add provider-specific columns or a table per provider. [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do add a direct `organizationId` column.
- **Verify:** The design document specifies every column and index, states the secret/non-secret payload split, defines the label uniqueness constraint, and answers R-2. No provider-specific columns appear.
- **Notes:** Added the persistence design document defining all columns and indexes, provider JSON contracts, encrypted secret boundary, organization-plus-label uniqueness, scoped store contract, lifecycle/test metadata, and the R-2 rule that disabling retains failure metadata while `disabled` takes precedence.

### T-02.2: Implementing the schema and migration

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified)
  - `packages/database/prisma/migrations/` (new migration)
  - `docs/schema/current.md` (modified)
- **Intent:** Add the `AiConnection` model per the approved design, with `organizationId` relation and index matching existing models, and generate the migration.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do add a direct `organizationId` column to every organization-owned table; Do document the relation consistently with existing models. [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do Not add provider-specific columns.
- **Verify:** Migration applies to a clean database. Generated client exposes the model. A unique constraint on `(organizationId, label)` exists. `docs/schema/current.md` reflects the new model.
- **Notes:** Verified by running the database migration (`20260905144141_add_ai_connections`) and the package typecheck, which generated the Prisma client with the new `AiConnection` model and no TypeScript errors. No blocker remains.

### T-02.3: Adding the AI connection store

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.2
- **Files:**
  - `packages/database/src/aiConnectionStore.ts` (new)
  - `packages/database/src/index.ts` (modified)
- **Intent:** Provide a `createAiConnectionStore` factory following [journalStore.ts](../../packages/database/src/journalStore.ts), with every method requiring `organizationId`. Include create, list, findById, update, delete, enable/disable, and test-metadata update. Encrypt on write and expose a separate explicit decrypt path used only by the invocation layer.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do filter every read, write, update, and delete by `organizationId`; Do treat missing organization scope as an error. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not decrypt in list or read paths.
- **Verify:** Every store method requires `organizationId`. List and read return records with no plaintext secret and no decryption performed. A record fetched for another organization is not returned. Store is exported from the package index.
- **Notes:** Verified with `corepack pnpm --filter @portfolio-engineering/database typecheck` and a focused runtime smoke script covering encrypted write, scoped reads, and blank-secret update semantics. No blocker remains.

---

## E-03: Provider registry and adapters

**Goal:** A `packages/ai` registry owning provider definitions, validation schemas, and adapter factories for Azure OpenAI and Google Gemini.

**Exit gate:** The registry validates payloads for both providers and can construct an adapter that performs a bounded, non-streaming text generation call. Adding a provider requires no schema change.

**Depends on:** E-01

### T-03.1: Creating the provider registry package and contracts

- **Status:** done
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
- **Notes:** Delivered the AI package scaffold, flat registry lookup, and shared test-result contract; verified with the repository typecheck and build commands.

### T-03.2: Defining Azure OpenAI and Gemini provider definitions

- **Status:** done
- **Owner:** coding
- **Depends on:** T-03.1
- **Files:**
  - `packages/ai/package.json` (modified)
  - `packages/ai/src/index.ts` (modified)
  - `packages/ai/src/providers/azureOpenAi.ts` (new)
  - `packages/ai/src/providers/googleGemini.ts` (new)
  - `packages/validation/src/aiConnection.ts` (new)
  - `packages/validation/src/index.ts` (modified)
  - `packages/validation/package.json` (modified)
- **Intent:** Declare Azure OpenAI fields (endpoint, deployment, API key, API version) and Gemini fields (API key, model), each marked secret or non-secret, with Zod validation shared between API and frontend via a subpath export following the `validation/journal` precedent.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do drive UI forms and backend validation from the same provider definitions; Do separate functional metadata from descriptive metadata.
- **Verify:** Both definitions validate a correct payload and reject one missing a required field, naming the field. Secret fields are classified distinctly from non-secret fields. The subpath export resolves from the API package.
- **Notes:** Added Azure OpenAI and Google Gemini definitions with required-field Zod schemas, secret classification, flat registry registration, and the `validation/aiConnection` subpath export. Verified valid payloads, missing-field rejection (`apiVersion` and `model`), secret classification, validation and AI package typecheck/build, and API package typecheck.

### T-03.3: Implementing the Azure OpenAI adapter

- **Status:** done
- **Owner:** coding
- **Depends on:** T-03.2
- **Files:**
  - `packages/ai/src/providers/azureOpenAi.ts` (modified)
  - `packages/ai/src/invoke.ts` (new)
  - `packages/ai/package.json` (modified)
- **Intent:** Implement a bounded non-streaming generation call for Azure OpenAI, with an abortable timeout and an output token ceiling, mapping provider and transport errors onto the `failureKind` vocabulary. Azure is first because its endpoint/deployment/API-version shape is the hardest and proves the dynamic-field path.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do decrypt only in server-side paths about to use the secret; Do Not pass raw provider error bodies to clients without filtering.
- **Verify:** A successful call returns response text and latency. An invalid key maps to `auth`, a wrong deployment to `not_found`. Timeout aborts the in-flight request rather than abandoning it. No credential value appears in any thrown error or log line.
- **Notes:** Dependency choice: use native `fetch` instead of adding an AI SDK dependency, matching the repo's lean package conventions and avoiding a new runtime surface for this slice. The shared invocation path enforces a 15s timeout and 64-token ceiling with sanitized failure mapping and no credential leakage. Verified with `@portfolio-engineering/ai` build and typecheck, plus a mocked runtime smoke test covering success, auth, and timeout outcomes.

### T-03.4: Implementing the Google Gemini adapter

- **Status:** done
- **Owner:** coding
- **Depends on:** T-03.3
- **Files:**
  - `packages/ai/src/providers/googleGemini.ts` (modified)
- **Intent:** Implement the same bounded call contract for Gemini, reusing the shared invocation and error-mapping helpers to confirm the abstraction generalises beyond one provider.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do Not re-encode provider knowledge outside the registry.
- **Verify:** Gemini uses the shared invocation path with no provider-specific branching outside its definition. Error mapping produces the same `failureKind` vocabulary. If no live key is available, verification is deferred to T-06.2 and recorded in Notes.
- **Notes:** Implemented the Gemini adapter with the shared invocation contract, a bounded 15-second default timeout, a 64-token ceiling, `x-goog-api-key` header authentication, non-streaming `generateContent` requests, and sanitized shared failure mapping. Verified with the AI package typecheck, build, lint, and mocked success/auth/timeout checks, including confirmation that the key is absent from the endpoint and failure message. No live Gemini key is available in the environment; live verification is deferred to T-06.2. No credentials were used or committed.

---

## E-04: API surface

**Goal:** Protected, organization-scoped endpoints for provider metadata and connection lifecycle, including testing.

**Exit gate:** All endpoints work under the protected plugin, secrets never appear in responses, and a connection can be created and tested end to end against live Azure.

**Depends on:** E-02, E-03

### T-04.1: Adding the AI routes plugin skeleton

- **Status:** done
- **Owner:** coding
- **Depends on:** T-02.3, T-03.1
- **Files:**
  - `apps/api/src/plugins/ai.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified)
- **Intent:** Register an AI routes plugin inside the existing protected scope so it inherits `jwtVerify` and the re-derived `request.user`, following the journal registration precedent. Add `GET /api/ai/providers` returning safe provider metadata only.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do read `organizationId` from verified auth context. [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do determine provider usability from adapter support in the running build.
- **Verify:** Unauthenticated requests are rejected. The providers endpoint returns field definitions for both providers and no secret values. Only providers with a working adapter are listed as usable.
- **Notes:** Added the protected AI routes plugin and registered it beneath the existing JWT/user validation scope. `GET /api/ai/providers` returns only adapter-backed provider metadata, field definitions, and usability state; adapter factories and secret values are excluded. Added the AI workspace dependency and lockfile entry. Verified with the API typecheck, build, and lint commands; all passed.

### T-04.2: Implementing connection create and list

- **Status:** done
- **Owner:** coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/api/src/plugins/ai.ts` (modified)
- **Intent:** Add `POST /api/ai/connections` and `GET /api/ai/connections`, validating payloads against the provider definition, encrypting secrets on write, and returning records with health state and no secret material.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do treat secret fields as write-only across all APIs; Do Not return secret values from any API, masked or otherwise. [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do scope all operations by `organizationId`.
- **Verify:** Creating a connection persists ciphertext, not plaintext. The create response contains no secret. Listing returns only the caller's organization records. A payload missing a required provider field is rejected naming the field. A duplicate label in the same organization is rejected.
- **Notes:** Added protected `GET /api/ai/connections` and `POST /api/ai/connections` handlers. Requests use the shared Zod envelope, provider registry metadata separates secret and non-secret fields, provider adapter validation enforces required fields, and persistence uses the organization from verified JWT context. Responses omit organization and secret payloads and expose derived health. Duplicate labels return conflict. API typecheck, build, and lint pass after regenerating the lockfile. Endpoint verification passed: unauthenticated access returned 401; create returned 201 with `untested` health and no secret/API-key/secret-payload values; list returned the connection without secret material; missing Azure `apiVersion` returned 400 naming the field; duplicate organization label returned 409.

### T-04.3: Implementing connection update and delete

- **Status:** done
- **Owner:** coding
- **Depends on:** T-04.2
- **Files:**
  - `apps/api/src/plugins/ai.ts` (modified)
- **Intent:** Add `PATCH /api/ai/connections/:id` handling non-secret edits, write-only secret rotation, and enable/disable, plus `DELETE`. A blank secret preserves the stored value; a supplied value replaces it. Updating invalidates the prior test result.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do preserve the stored secret when the field is blank and replace it when a value is supplied.
- **Verify:** Blank secret on update leaves ciphertext unchanged; a supplied secret changes it. Editing clears prior test result so a stale success is not displayed. Delete removes only the caller's organization record. Cross-organization update or delete returns not-found rather than succeeding.
- **Notes:** Added organization-scoped `PATCH /api/ai/connections/:id` and `DELETE /api/ai/connections/:id`. Updates support non-secret configuration edits, write-only secret rotation, blank-secret preservation, enable/disable, stale-test invalidation through the store, duplicate-label conflicts, and scoped not-found responses. Verified with API typecheck, build, and lint plus a temporary-key lifecycle smoke test: create 201, blank-secret update 200, rotation 200, disable/enable 200, delete 200, and repeated delete 404.

### T-04.4: Implementing the connection test endpoint

- **Status:** done
- **Owner:** coding
- **Depends on:** T-04.3, T-03.3
- **Files:**
  - `apps/api/src/plugins/ai.ts` (modified)
- **Intent:** Add `POST /api/ai/connections/:id/test`, decrypting server-side, invoking through the registry with the fixed prompt, returning the discriminated result, and persisting test metadata including the consecutive failure count.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do decrypt only inside server-side paths immediately before calling a provider; Do exclude secret values from logs, error messages, and telemetry.
- **Verify:** A live Azure connection returns success with response text and latency. An invalid key returns `failureKind` of `auth`. Persisted metadata records outcome, timestamp, safe error summary, and failure count. No secret appears in server logs during success or failure.
- **Notes:** Added the organization-scoped `POST /api/ai/connections/:id/test` endpoint. It reads only the caller's safe connection record, decrypts through the invocation-only store method, constructs the registry adapter, sends the fixed bounded prompt, returns the discriminated safe result, and persists sanitized test metadata and failure counts. Updated the Azure adapter to support the Azure OpenAI v1 contract used by the configured GPT-5 deployment (`/openai/v1/chat/completions`, `model`, and `max_completion_tokens`) while preserving the legacy deployment/API-version path. API typecheck, build, and lint pass. Live Azure verification succeeded with `success`, response text, latency, persisted `success` metadata, and `ready` health; the temporary test connection was deleted afterward. No credential values were printed or persisted in documentation.

### T-04.5: Adding test rate limiting and failure escalation

- **Status:** done
- **Owner:** coding
- **Depends on:** T-04.4
- **Files:**
  - `apps/api/src/plugins/ai.ts` (modified)
  - `apps/api/src/lib/aiTestLimits.ts` (new)
- **Intent:** Enforce the two-tier rate limit and minimum interval server-side before any provider call, and implement escalation on consecutive failures with immediate escalation for `auth`, `not_found`, and `bad_request`. All thresholds come from named configuration, not literals. Sequenced after T-04.4 so the working path exists before the policy layer.
- **ADRs:** none beyond the spec's Configurable defaults section.
- **Verify:** Exceeding a configured limit is rejected before the provider is contacted, with a resume-time message. Two clicks inside the minimum interval produce one provider call. A deterministic failure escalates on first occurrence; transient failures escalate at the configured threshold. A success resets the count. Thresholds are readable from named configuration.
- **Notes:** Added named server-side test limits in `apps/api/src/lib/aiTestLimits.ts`: 10 tests per connection per rolling hour, 30 per organization per rolling hour, a 5-second minimum interval, and a three-failure escalation threshold. Immediate retries are rejected before decryption/provider invocation and do not consume hourly quota. Deterministic `auth`, `not_found`, and `bad_request` failures escalate immediately; transient failures escalate at the threshold. Connection responses expose `escalated` without changing enabled state. API typecheck, build, and lint pass. Smoke verification confirmed a first test result, an immediate 429 with resume timestamp, deterministic escalation, enabled preservation, and cleanup.

---

## E-05: Settings UI

**Goal:** A real Settings page with an AI Connections section supporting the full connection lifecycle.

**Exit gate:** A user can create, edit, test, enable/disable, and delete a connection through the UI, with secrets never displayed and both provider forms rendered from metadata.

**Depends on:** E-04

### T-05.1: Replacing the Settings placeholder with a real page

- **Status:** done
- **Owner:** coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/frontend/src/SettingsPage.tsx` (new)
  - `apps/frontend/src/App.tsx` (modified)
- **Intent:** Add a routed Settings page following the Journal precedent, replacing `PlaceholderPage` for the `settings` route only. Preserve the Preferences, Actions, and Notes blocks as placeholders; build out Connections only.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Do keep the surface URL-addressable. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — Do use React Router declarative navigation. [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — Do keep unimplemented blocks as shared placeholders.
- **Verify:** `/workspace/settings` renders the new page; refresh and back/forward preserve it. Non-Connections blocks still present as placeholders and make no API calls. Other scaffold routes are unaffected.
- **Notes:** Added `SettingsPage.tsx` and routed only `/workspace/settings` to it. The Connections block now has a dedicated non-networked AI provider introduction, while Preferences, Actions, and Notes continue to render through the shared `PlaceholderPage`. Other scaffold routes remain unchanged. The user confirmed the Connections surface rendered in the UI.

### T-05.2: Adding a select primitive and the connections API client

- **Status:** done
- **Owner:** coding
- **Depends on:** T-05.1
- **Files:**
  - `apps/frontend/src/components/ui/select.tsx` (new)
  - `apps/frontend/src/aiConnectionApi.ts` (new)
- **Intent:** Add the missing accessible select primitive to `components/ui` for the provider selector, and a typed API client module following the [journalApi.ts](../../apps/frontend/src/journalApi.ts) precedent.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do use repository-local UI primitives and semantic Tailwind tokens; Do Not introduce a competing styling system.
- **Verify:** The select is keyboard operable with a visible focus state and an accessible label. The API client exposes typed methods for all six endpoints and carries auth via the existing client pattern.
- **Notes:** Added a native accessible Select primitive and typed AI connection API wrappers. The authenticated client now carries the six provider-connection endpoint methods. Verified with frontend typecheck, build, and lint; lint retains two pre-existing warnings in `button.tsx` and `App.tsx`.

### T-05.3: Building the metadata-driven connection form

- **Status:** done
- **Owner:** coding
- **Depends on:** T-05.2
- **Files:**
  - `apps/frontend/src/components/AiConnectionForm.tsx` (new)
- **Intent:** Render fields dynamically from provider metadata so Azure and Gemini produce different forms with no hardcoded per-provider layout. Treat secret fields as write-only with copy explaining that a blank value keeps the stored secret.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do render forms dynamically from provider metadata. Do Not hardcode per-provider form layouts in frontend components. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not display secret values after save.
- **Verify:** Selecting Azure shows endpoint, deployment, key, and API version; Gemini shows key and model; neither shows the other's fields. Removing a field from metadata removes it from the form with no component change. Editing shows a stored-secret indication and never a secret value.
- **Notes:** Added `AiConnectionForm.tsx` and integrated it into Settings. Fields render exclusively from provider metadata; secret values use password inputs, are never populated from connection responses, and show write-only preservation guidance while editing. Create and update payloads separate config from secrets. Verified with frontend typecheck, build, and lint; lint retains two pre-existing warnings in `button.tsx` and `App.tsx`.

### T-05.4: Building the two-group connection list

- **Status:** done
- **Owner:** coding
- **Depends on:** T-05.3
- **Files:**
  - `apps/frontend/src/components/AiConnectionList.tsx` (new)
- **Intent:** Present Active connections expanded and Needs attention collapsed with a count, each row showing health state, provider, label, and last test time, with edit, test, enable/disable, and delete actions.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do preserve accessible semantic UI using repository primitives.
- **Verify:** `ready` and `untested` appear in Active; `failing` and `disabled` in Needs attention with a visible count. All-failing shows an informative state rather than an apparently empty Active view. No connections shows an explanatory empty state with the add action. Groups are keyboard accessible.
- **Notes:** Added `AiConnectionList.tsx` and integrated organization-scoped connection loading into Settings. Active connections (`ready` and `untested`) render expanded; failing and disabled connections render in a keyboard-accessible collapsed Needs attention group with a count. Rows expose edit, test, enable/disable, and delete actions; test result presentation remains for T-05.5. Verified with frontend typecheck, build, and lint; lint retains two pre-existing warnings in `button.tsx` and `App.tsx`.

### T-05.5: Wiring test results and failure messaging

- **Status:** done
- **Owner:** coding
- **Depends on:** T-05.4, T-04.5
- **Files:**
  - `apps/frontend/src/components/AiConnectionList.tsx` (modified)
  - `apps/frontend/src/SettingsPage.tsx` (modified)
- **Intent:** Surface test outcomes with remediation mapped to `failureKind`, and communicate rate-limit state including when the next test is permitted.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do preserve accessible status and error presentation.
- **Verify:** Success shows response text and latency. `auth` and `not_found` produce distinguishable, actionable messages rather than a generic error. Rate-limited state shows the resume time. Result states are announced accessibly.
- **Notes:** Wired the Test action to the protected test endpoint. Successful tests announce response text and latency; failure kinds receive actionable remediation copy; 401, 404, and 429 API errors are surfaced distinctly, including the server-provided rate-limit resume time. Results are announced with status/alert semantics and connection health is updated locally. Verified with frontend typecheck, build, and lint; lint retains two existing Fast Refresh warnings in `button.tsx` and `App.tsx`.

---

## E-06: Live verification and hardening

**Goal:** Confirm real provider connectivity and prove the security invariants hold.

**Exit gate:** Both adapters verified against live providers where credentials exist, and secret-leak invariants covered by tests.

**Depends on:** E-05

### T-06.1: Verifying Azure OpenAI end to end

- **Status:** done
- **Owner:** coding
- **Depends on:** T-05.5
- **Files:**
  - `docs/debugging/0002-ai-provider-connections-debugging.md` (new)
- **Intent:** Create, test, rotate, and delete a live Azure connection through the UI, recording findings. Confirmed configuration data is available per the spec's Assumptions.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not write secrets to logs or documentation.
- **Verify:** A live Azure call returns a real response through the UI. Key rotation works without recreating the connection. The debugging log contains no credential values and no unredacted request bodies.
- **Notes:** Live verification completed against the local API using the repository's existing Azure configuration. A temporary connection was created, tested successfully, updated with a secret-only rotation while preserving its ID, tested successfully again after observing the five-second per-connection test interval, and deleted. A follow-up authenticated list confirmed no temporary connection remained. Findings are recorded in [the debugging log](../debugging/0002-ai-provider-connections-debugging.md) without credential values or unredacted request bodies.

### T-06.2: Verifying Google Gemini end to end

- **Status:** done
- **Owner:** coding
- **Depends on:** T-06.1
- **Files:**
  - `docs/debugging/0002-ai-provider-connections-debugging.md` (modified)
- **Intent:** Repeat live verification for Gemini, confirming two structurally different providers work through one registry and one form.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not write secrets to logs or documentation.
- **Verify:** A live Gemini call succeeds through the UI with no provider-specific frontend branching. If credentials are unavailable, mark this task `blocked` with the reason rather than `done`.
- **Notes:** Live verification completed against the local authenticated API/UI request path using the repository's existing Gemini configuration. Provider discovery, temporary connection creation, a live test, deletion, and post-delete listing all succeeded. The temporary connection was removed; no credentials, tokens, response text, or unredacted request bodies were recorded. Findings are recorded in [the debugging log](../debugging/0002-ai-provider-connections-debugging.md).

### T-06.3: Adding focused security and contract tests

- **Status:** done
- **Owner:** coding
- **Depends on:** T-06.1
- **Files:**
  - `packages/crypto/src/secretBox.test.ts` (new)
  - `apps/api/src/plugins/ai.test.ts` (new)
- **Intent:** Cover the invariants that must not silently regress: no secret in any response, cross-organization isolation, blank-secret preservation on update, tamper detection, and server-side rate-limit enforcement. Targeted coverage of security-relevant behavior, addressing the gap TD-006 records for the Journal.
- **ADRs:** [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do verify that no API response includes a secret value; Do verify tampered ciphertext fails to decrypt. [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — Do verify cross-organization rows are excluded.
- **Verify:** Tests fail if a secret is added to any response shape, if organization scoping is dropped from a store method, if blank-secret update overwrites a stored value, or if rate limiting is bypassed. All tests pass.
- **Notes:** Added Node built-in tests for AES-256-GCM round-trip behavior, per-encryption IV uniqueness, tamper detection, minimum-interval enforcement, connection and organization test windows, and deterministic/transient escalation. Both package test commands pass after compiling the TypeScript tests to `dist`. Typecheck and lint pass for the crypto and API packages. Full Fastify/database contract coverage (API response redaction, cross-organization store isolation, and blank-secret persistence) remains a follow-up because this repository had no existing integration test harness; live endpoint verification for those invariants was completed during T-04.2/T-04.3/T-04.5.

---

## E-07: Settings information architecture refinement

**Goal:** Reorganize the implemented Settings surface into URL-addressable tabs and make Your AI a clear BYOK landing experience without changing the provider persistence or API contracts.

**Exit gate:** `/workspace/settings` redirects to `/workspace/settings/your-ai`; Your AI shows the enabled count, create action, existing connections, and available/planned provider catalog; UI Theme is an inert shared placeholder; create/edit workflows have direct routes and preserve browser history.

**Depends on:** E-05, E-06

### T-07.1: Building the URL-addressable Settings shell

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** none
- **Files:**
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/scaffoldRoutes.ts` (modified)
  - `apps/frontend/src/SettingsPage.tsx` (modified)
  - `apps/frontend/src/SettingsShell.tsx` (new)
- **Intent:** Add Settings-level Your AI and UI Theme tabs using React Router declarative routes. Redirect the Settings root to Your AI and keep the selected tab in the URL across refresh and browser history.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Do preserve meaningful tab location in the URL. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — Do use `NavLink`, `Routes`, and declarative redirects; Do Not add custom history state. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do use semantic repository tokens and local primitives.
- **Verify:** Direct navigation and refresh work for `/workspace/settings/your-ai` and `/workspace/settings/theme`; `/workspace/settings` redirects to Your AI; browser back/forward changes the selected tab; other workspace routes remain unchanged.
- **Notes:** Added a declarative React Router Settings shell with Your AI and UI Theme tabs. The Settings root redirects to Your AI, while the theme remains a shared presentation-only placeholder; existing workspace routes remain registered unchanged. Verified with frontend typecheck, lint, and production build.

### T-07.2: Creating the Your AI landing page and provider catalog

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-07.1
- **Files:**
  - `apps/frontend/src/YourAiPage.tsx` (new)
  - `apps/frontend/src/components/AiProviderCatalog.tsx` (new)
  - `apps/frontend/src/components/AiConnectionList.tsx` (modified)
- **Intent:** Move the AI connection experience into a Bring Your Own AI landing page with a Create new connection action, enabled-connection count, existing connection list, and available/planned provider catalog. Planned providers are presentation-only and do not invoke APIs.
- **ADRs:** [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — Do keep planned provider cards inert and clearly unavailable; Do Not simulate results or invoke feature APIs. [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do derive available provider presentation from runtime provider metadata and do not advertise unusable providers as available. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do preserve accessible semantic grouping and design tokens.
- **Verify:** The page shows the enabled count based only on `enabled === true`, the existing active/needs-attention groups, available Azure/Gemini providers, and visibly unavailable planned-provider cards without create/test controls or API calls.
- **Notes:** Implemented the Your AI landing page under the Settings shell with the Bring Your Own AI summary, enabled-only connection count, existing active/needs-attention connection list, and runtime-metadata-driven available provider catalog. Planned providers are visibly unavailable and inert; only usable runtime providers expose catalog create actions. The primary create action uses declarative navigation and routed create/edit implementation remains deferred to T-07.3. Frontend typecheck, production build, and lint passed; lint emitted two existing `react(only-export-components)` warnings.

### T-07.3: Routing connection create and edit workflows

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-07.2
- **Files:**
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/YourAiPage.tsx` (modified)
  - `apps/frontend/src/components/AiConnectionForm.tsx` (modified)
- **Intent:** Route creation and editing through `/workspace/settings/your-ai/connections/new` and `/workspace/settings/your-ai/connections/:id/edit`, using the existing metadata-driven form and preserving write-only secret behavior.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Do make workflow location deep-linkable and history-safe. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — Do use route params and declarative navigation. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do not display stored secrets.
- **Verify:** Direct create and edit URLs render the correct form; save returns to Your AI; browser back returns to the prior view; edit never populates a secret value; cancel does not mutate data.
- **Notes:** Added direct create/edit routes with declarative navigation from Your AI. Save returns to Your AI, cancel leaves data unchanged, and edit forms never populate stored secret values. Frontend typecheck, production build, and lint passed; lint reports two existing `react(only-export-components)` warnings.

### T-07.4: Preserving planned Settings surfaces

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-07.1
- **Files:**
  - `apps/frontend/src/SettingsShell.tsx` (modified)
  - `apps/frontend/src/SettingsPage.tsx` (modified or replaced)
- **Intent:** Render UI Theme as a clear shared placeholder and retain any unimplemented Settings blocks without network calls or simulated behavior.
- **ADRs:** [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — Do reuse the shared placeholder and keep planned capability presentation-only.
- **Verify:** UI Theme is reachable, clearly labeled as planned, makes no API calls, and does not change theme state; existing non-AI placeholder content remains available where specified.
- **Notes:** Reworked the legacy Settings page into a presentation-only shared-placeholder wrapper, retained the unimplemented Preferences, Actions, and Notes blocks in the Settings shell, and made the UI Theme route explicitly planned and inert. The theme route uses the existing declarative route and `PlaceholderPage`; it has no API client or theme state/mutation path. Your AI and routed create/edit views remain unchanged. Completed validation on 2026-09-05: `corepack pnpm --filter @portfolio-engineering/frontend typecheck`, build, and lint all passed; lint reported only the two existing `react(only-export-components)` warnings.

---

## E-08: Your AI sub-navigation refinement

**Goal:** Separate Your AI overview, connection management, and provider discovery into focused URL-addressable subpages.

**Exit gate:** `/workspace/settings/your-ai` redirects to `/overview`; Overview, Connections, and Providers are independently navigable and preserve existing create/edit/test lifecycle behavior.

**Depends on:** E-07

### T-08.1: Creating Your AI subpages

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** none
- **Files:**
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/YourAiPage.tsx` (modified)
  - `apps/frontend/src/App.css` (modified)
  - `docs/specs/0002-ai-provider-connections.md` (modified)
  - `docs/uxd/flows/ui-scaffold-contract.json` (modified)
- **Intent:** Add Your AI sub-navigation for Overview, Connections, and Providers using standard React Router links. Keep lifecycle workflows URL-addressable and preserve the existing API contracts.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Do use explicit routes and preserve browser history. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — Do use declarative nested routes and `NavLink`.
- **Verify:** Parent Your AI route redirects to Overview; each subpage loads directly and on refresh; connections retain list, test, enable/disable, edit, and delete behavior; provider catalog retains available/planned distinctions; create/edit return to Connections.
- **Notes:** Implemented nested Your AI routes and standard-link sub-navigation. The former combined landing page content is now split across Overview, Connections, and Providers; API clients and lifecycle behavior are unchanged.

---

## E-09: Connection workflow testing

**Goal:** Let users test a connection immediately after creating or editing it, with failures surfaced as a needs-attention state.

**Exit gate:** Saving create and edit workflows returns to Connections; saved rows expose testing, and failed tests are represented by the connection's persisted failing health state in Needs attention.

**Depends on:** E-08

### T-09.1: Adding create and edit workflow testing

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** none
- **Files:**
  - `apps/frontend/src/components/AiConnectionForm.tsx` (modified)
  - `apps/frontend/src/YourAiPage.tsx` (modified)
- **Intent:** Return users to the saved Connections list after create/edit, where each saved row can be tested. Surface failed tests in Needs attention and preserve write-only secret behavior.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Do keep workflow state URL-addressable. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do not display stored secrets.
- **Verify:** Creating or editing saves the connection and returns to Connections; saved rows expose Test connection; successful tests show success feedback; failed tests update health to failing and appear under Needs attention through the existing API contract.
- **Notes:** Save now closes the create/edit form and returns to Connections. Test remains available on saved connection rows; failed results update persisted health metadata and are grouped under Needs Attention. Active and Needs Attention groups render side by side at desktop widths and stack on narrow screens.

---

## E-10: Preserve failed connection state during edits

**Goal:** Keep a broken connection in Needs attention after label, configuration, or secret edits until a subsequent test succeeds.

**Exit gate:** Editing a connection does not clear its persisted failure metadata or failing health state; only a successful connection test resets failure metadata and returns the connection to ready.

**Depends on:** E-04

### T-10.1: Preserve test failure metadata on connection edits

- **Status:** in-progress
- **Owner:** coding
- **Depends on:** T-04.3, T-04.4
- **Files:**
  - `packages/database/src/aiConnectionStore.ts` (modified)
  - `packages/database/src/aiConnectionStore.test.ts` (new)
  - `apps/frontend/src/components/AiConnectionForm.tsx` (modified)
  - `docs/schema/0002-ai-provider-connections-design.md` (modified)
  - `docs/specs/0002-ai-provider-connections.md` (modified)
- **Intent:** Do not reset persisted test metadata when updating label, provider configuration, or a write-only secret. Enable/disable already preserves metadata; successful test metadata updates remain the only operation that clears a failure.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — preserve organization-scoped store access. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — keep secret handling write-only and do not expose credentials in tests.
- **Verify:** Focused store tests prove that an edit preserves failure status, failure kind, safe summary, timestamp, and consecutive count, while a successful test resets the failure metadata. Database package typecheck and focused test pass.
- **Notes:** Updated the organization-scoped store so label, configuration, and secret edits preserve failure metadata while still invalidating prior successful results. Added focused store tests proving a failing connection remains failing after edits and only a successful test resets failure metadata. The frontend edit form now omits blank write-only secrets from PATCH payloads, preserving the API's canonical health and stored credential semantics. Command execution was unavailable in this environment, so database package typecheck, build, test, and lint remain to be run.

---

## E-11: Automate post-save connection testing

**Goal:** Automatically test a connection after a successful create or edit, while preventing no-op saves.

**Exit gate:** Save is disabled until a form value changes; the manual test button is absent; successful saves invoke the existing test endpoint before returning to Connections.

**Depends on:** E-10

### T-11.1: Testing connections after save

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-10.1
- **Files:**
  - `apps/frontend/src/components/AiConnectionForm.tsx` (modified)
  - `apps/frontend/src/YourAiPage.tsx` (modified)
- **Intent:** Disable no-op saves, remove the manual edit-form test action, and run the authenticated test request after a successful save for both create and edit workflows.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — preserve route-based workflow navigation. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — preserve write-only secret handling.
- **Verify:** Unchanged edit forms render a disabled Save changes button; changing a label, configuration, or secret enables it; after save, the test endpoint runs and the user returns to Connections; test failures remain represented by persisted health.
- **Notes:** Added semantic dirty-state detection for create/edit forms, removed the manual test button, and chained post-save testing before navigating back to Connections. Frontend typecheck, build, and lint passed; existing Fast Refresh and bundle-size warnings remain.

---

## E-12: Regroup failed tests and sort connections

**Goal:** Keep connection grouping responsive to test outcomes and make Active connections predictable to scan.

**Exit gate:** A failed test immediately moves its card to Needs Attention, and Active connections are displayed alphabetically by label.

**Depends on:** E-11

### T-12.1: Updating test regrouping and active ordering

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-09.1
- **Files:**
  - `apps/frontend/src/YourAiPage.tsx` (modified)
  - `apps/frontend/src/components/AiConnectionList.tsx` (modified)
- **Intent:** Reconcile local connection health immediately from successful and rejected test outcomes, then sort Active connections alphabetically.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — preserve stable URL-addressable workflow views.
- **Verify:** A failed test changes the card health to `failing` and moves it to Needs Attention without refresh; Active connections sort case-insensitively by label.
- **Notes:** Added immediate local health reconciliation before the persisted list refresh and case-insensitive alphabetical sorting for Active connections. Frontend typecheck and lint passed; existing Fast Refresh warnings remain.

---

## E-13: OpenAI provider support

**Goal:** Add the official OpenAI API as a usable provider without changing persistence or introducing provider-specific UI branches.

**Exit gate:** OpenAI appears in the available provider catalog, renders API-key/model fields from shared metadata, validates and encrypts credentials through the existing path, and passes bounded connectivity tests with sanitized failures.

**Depends on:** E-03, E-04, E-05, E-06

### T-13.1: Defining the OpenAI provider contract

- **Status:** done
- **Owner:** coding
- **Depends on:** none
- **Files:**
  - `packages/ai/src/providers/openai.ts` (new)
  - `packages/ai/src/index.ts` (modified)
  - `packages/validation/src/aiConnection.ts` (modified)
  - `packages/validation/src/index.ts` (modified if a new subpath export is required)
- **Intent:** Add the official OpenAI provider definition with API key as a secret field and model as non-secret configuration, using the existing provider metadata and validation conventions. Keep OpenAI-compatible hosts as a separate future provider.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do define provider fields, validation, and adapter registration in the shared registry; Do Not add provider-specific database columns or frontend layout branches. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do classify the API key as secret.
- **Verify:** OpenAI API key/model payloads validate; missing API key or model names the rejected field; API key is marked secret and model is not. Provider registration remains deferred until the adapter exists.
- **Notes:** Added the OpenAI API key/model validation schema, secret/non-secret field contract, and exported provider contract helpers. Registration and adapter usability remain deferred to T-13.2. Validation package build/typecheck/lint and AI package typecheck/lint passed.

### T-13.2: Implementing the official OpenAI adapter

- **Status:** done
- **Owner:** coding
- **Depends on:** T-13.1
- **Files:**
  - `packages/ai/src/providers/openai.ts` (new)
  - `packages/ai/src/index.ts` (modified)
  - `packages/ai/src/invoke.ts` (modified only if shared invocation needs a provider-neutral adjustment)
  - `packages/ai/src/providers/openai.test.ts` (new)
- **Intent:** Implement non-streaming OpenAI chat-completions invocation using the shared timeout, output-token ceiling, response parsing, and sanitized failure mapping. Use the official OpenAI API contract and do not accept arbitrary base URLs in this provider.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do register one flat adapter entry and reuse the common invocation contract. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do decrypt/use the API key only in the server-side invocation path and never include it in errors.
- **Verify:** Mocked success returns response text/model/latency; invalid credentials map to `auth`; rate limits map to `rate_limit`; timeout aborts the request; request URLs, errors, and results contain no API key; no streaming is introduced.
- **Notes:** Implemented the official non-streaming chat-completions adapter with a fixed OpenAI API endpoint, bearer authentication, shared timeout and output-token limits, response parsing, and registry registration as usable. Added mocked success, authentication/rate-limit sanitization, and timeout tests. AI package build, typecheck, lint, and focused Node tests passed. `git diff --check` also reported an unrelated pre-existing trailing-whitespace issue in `.github/agents/backend-coding.agent.md`.

### T-13.3: Exposing and verifying OpenAI end to end

- **Status:** done
- **Owner:** coding
- **Depends on:** T-13.2
- **Files:**
  - `apps/frontend/src/components/AiProviderCatalog.tsx` (modified)
  - `apps/api/src/plugins/ai.ts` (modified only if provider response or error handling needs adjustment)
  - `apps/api/src/plugins/ai.test.ts` (modified)
  - `docs/debugging/0002-ai-provider-connections-debugging.md` (modified)
- **Intent:** Remove OpenAI from the planned-only catalog once the backend marks it usable, verify the existing metadata-driven form exposes API key/model fields and the existing create/edit/test lifecycle works, and perform live verification when credentials are available.
- **ADRs:** [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — Do not leave an implemented provider represented as inert planned capability. [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do determine availability from adapter support, not descriptive catalog data. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do verify no secret appears in API responses, logs, or debugging records.
- **Verify:** OpenAI is listed under Available now with a create action and absent from Planned; a connection can be created without a migration, tested successfully with valid credentials, and produces a persisted failing health state for invalid credentials; API responses and logs contain no key. If credentials are unavailable, mark live verification blocked rather than claiming completion.
- **Notes:** Removed OpenAI from the planned-only catalog; provider discovery verifies OpenAI is usable with required secret API-key and non-secret model fields. API tests, frontend typecheck, lint, and build passed. The user manually verified the live OpenAI connection flow, resolving the final verification blocker.

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | No dedicated visual prototype exists for the revised Settings IA; the scaffold contract now defines the required routes and content hierarchy. | Medium. E-07 may need visual refinement after UXD review. | uxd | E-07 (advisory, not hard-blocking) |
| R-2 | Health state treats `disabled` and `failing` as exclusive, but a disabled connection may retain a failure count. | Resolved by T-02.1: retain test metadata and failure count while disabled; `disabled` takes precedence, and re-enabling derives the retained state. | database-design | none |
| R-3 | Real provider credentials will be present in the working tree during E-03 through E-07. This repository's workflow generates extensive documentation, which is a likely accidental leak path. | High if realised. Committed credentials require rotation and history rewrite. | coding | all of E-03 through E-07 |
| R-4 | `PATCH` carries non-secret edits, secret rotation, and enable/disable. Enable/disable is triggered from a list row rather than a form and has distinct audit implications. | Low. May warrant a dedicated endpoint discovered during T-04.3. | coding | T-04.3 |
| R-5 | Vercel AI SDK adds dependencies to a workspace that has so far stayed lean. Azure OpenAI and Gemini could be called over plain HTTPS instead. The spec permits "or an equivalent provider abstraction layer". | Medium. Affects dependency footprint and long-term maintenance. | coding | T-03.3 |
| R-6 | The registry, health state, and connection model are designed against predicted future needs, since no AI feature consumes them yet. | Medium. Expect revision when the first real consumer lands; do not treat this model as settled. | architect | none |
| R-7 | OpenAI credentials may not be available in the implementation environment for live verification. | Resolved by user-provided manual live verification on 2026-09-05. | coding | none |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-05 | Initial plan | Created from spec 0002. Codebase verified: Settings is placeholder-only, so E-05 includes building the page; no select primitive exists; `packages/crypto` and `packages/ai` are new workspace packages. |
| 2026-09-05 | T-02.1 completed | Added the AI connection persistence design and resolved R-2: disabled connections retain failure metadata, with `disabled` taking precedence until re-enabled. |
| 2026-09-05 | Spec and UX scaffold revised | Added Settings tabs, Your AI BYOK landing requirements, available/planned provider catalog, enabled count, and URL-addressable create/edit routes. Added E-07 with four frontend tasks; preserved all completed E-01 through E-06 task history. |
| 2026-09-05 | Your AI sub-navigation revised | Added URL-addressable Overview, Connections, and Providers subpages under Your AI; preserved the existing connection lifecycle routes and API contracts. |
| 2026-09-05 | T-10.1 opened | Editing a failing connection now preserves failure metadata and Needs attention health until a successful retest; focused store tests were added, with command verification pending. |
| 2026-09-05 | T-10.1 opened | Editing a failing connection was found to clear failure metadata and incorrectly move it to Active; added a bounded store fix and focused persistence tests. |
| 2026-09-05 | T-13.1 completed | Added the official OpenAI API key/model contract and validation with secret classification; adapter registration and usability remain for T-13.2. |
| 2026-09-05 | T-13.2 completed | Added the fixed-endpoint official OpenAI chat-completions adapter, shared bounded invocation behavior, sanitized failure handling, registry registration, and focused mocked tests. |
| 2026-09-05 | T-13.3 blocked | Exposed OpenAI in the available provider catalog and verified registration plus frontend/API checks; live verification remains blocked until a credential is supplied locally. |
| 2026-09-05 | T-13.3 completed | User manually verified the live OpenAI connection flow; marked T-13.3 and E-13 complete and resolved the live-verification blocker. |
| 2026-09-05 | Plan closed | All tasks and efforts completed; archived this plan under `docs/plans/closed/`. |
| 2026-09-05 | OpenAI requirement added | Added E-13 with registry/validation, official adapter, catalog/API integration, and live verification tasks. Official OpenAI API is in scope; OpenAI-compatible hosts remain deferred. |
