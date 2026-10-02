# Plan 0008: Anthropic AI Provider

- Status: `completed`
- Date: 2026-09-24
- Spec: [0008-anthropic-ai-provider](../specs/0008-anthropic-ai-provider.md)
- Audience: [backend-coding, frontend-coding, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: E-03
- Completed efforts: E-01, E-02
- Blocked tasks: none
- Next recommended task: none
- Last updated: 2026-09-25

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Anthropic contract and provider definition | 2 | 2 | done |
| E-02 | Anthropic adapter and streaming tests | 2 | 2 | done |
| E-03 | Catalog exposure and regression verification | 4 | 4 | done |

## Summary

Add Anthropic as a usable `anthropic` entry in the existing flat provider registry. The implementation reuses the current provider-defined API-key/model schema, encrypted connection payloads, generic connection-test route, shared invocation helpers, provider-neutral streaming events, metadata-driven form, and Your AI catalog.

The plan deliberately excludes persistence, routing, orchestration, model catalogs, new UI architecture, and Anthropic-specific product behavior. The first task must verify the current official Anthropic Messages API endpoint, required authentication/version headers, request/response shape, and streaming event format before adapter code is written.

## Inputs

- Spec readiness at planning time: `Ready for planning`; [Spec 0008](../specs/0008-anthropic-ai-provider.md) records no unresolved product decision blocking planning.
- Governing specification: [Spec 0002](../specs/0002-ai-provider-connections.md), especially its provider registry, encrypted secret, connection-test, failure vocabulary, and streaming requirements.
- ADRs reviewed: [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md), and [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md). [ADR 0001](../ADRs/0001-organization-aware-data-access.md) remains inherited through the unchanged Spec 0002 connection path but does not require a plan task because no persistence or query code changes.
- UX artifacts used: [ui-scaffold-contract.json](../uxd/flows/ui-scaffold-contract.json) and the implemented Your AI workflow in [YourAiPage.tsx](../../apps/frontend/src/YourAiPage.tsx). No new UX artifact is required; the existing metadata-driven form and catalog are preserved.
- Existing implementation plan: closed [Plan 0002](./closed/0002-ai-provider-connections.md), including its completed OpenAI provider effort and established adapter/test conventions.
- Existing provider patterns: [openai.ts](../../packages/ai/src/providers/openai.ts), [googleGemini.ts](../../packages/ai/src/providers/googleGemini.ts), [azureOpenAi.ts](../../packages/ai/src/providers/azureOpenAi.ts), [invoke.ts](../../packages/ai/src/invoke.ts), and [stream.ts](../../packages/ai/src/stream.ts).
- Validation and UI patterns: [aiConnection.ts](../../packages/validation/src/aiConnection.ts), [AiConnectionForm.tsx](../../apps/frontend/src/components/AiConnectionForm.tsx), and [AiProviderCatalog.tsx](../../apps/frontend/src/components/AiProviderCatalog.tsx).
- Schema reference: [schema/current.md](../schema/current.md) was reviewed for scope confirmation; no schema, migration, or store change is planned.
- Intersecting tech debt: TD-007 and TD-008 in [checklist.md](../tech-debt/checklist.md) identify broader frontend and route lifecycle coverage gaps. This plan adds focused provider/catalog coverage only and does not expand into a general test-harness project.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) | Anthropic is an addition to the provider registry and dynamic connection form. | E-01, E-02, E-03 |
| [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) | The Anthropic API key is recoverable provider credential material. | E-01, E-02, E-03 |
| [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) | An implemented provider must move from the inert planned catalog to the available catalog. | E-03 |

ADR 0001, routing ADRs, UI architecture ADRs, and runtime-content ADR 0009 do not introduce new work here: organization scoping, routes, UI primitives, and bundled functional metadata are all reused unchanged from Spec 0002.

## Approach

- Treat the registry entry as the single source of Anthropic provider knowledge. The definition owns `id`, display name, the required secret `apiKey` field, the required non-secret `model` field, usability, and adapter factory.
- Follow the OpenAI/Gemini/Azure adapter shape: use shared `invokeGeneration` for bounded non-streaming tests and `invokeStreamingGeneration` for provider-neutral `StreamTextEvent` output. Do not add a second dispatcher or a new transport abstraction.
- Verify official Anthropic documentation/current API behavior before implementation. Record the verified endpoint, required headers/API version, Messages request body, response text-block shape, and SSE event names in the executing task notes and encode only those facts in tests. If the verification implies a user-facing choice such as a custom endpoint or model catalog, stop and raise it in `Risks and open items` rather than expanding the schema.
- Add only the provider validation schema needed by the existing API plugin's provider payload validation. Do not alter the connection model, crypto package, store, route surface, rate-limit policy, or health-state logic.
- Remove only the `anthropic` planned catalog entry. The existing provider endpoint remains the authority for available providers; no frontend provider-specific JSX branch is allowed.
- Keep all test credentials synthetic. Mock `fetch` as existing provider tests do and assert that request headers, response objects, stream events, and failures do not expose the key or prompt.

## Non-goals

- Any Prisma schema, migration, store, or encrypted-payload format change.
- New API routes, frontend routes, settings pages, form architecture, or streaming UI.
- Model discovery, defaults, recommendations, aliases, orchestration, or model profiles.
- Anthropic tools, vision, files, batches, caching, citations, prompt systems, or other vendor-specific features.
- OpenAI-compatible hosts or any other planned provider.
- General remediation of TD-007 or TD-008.

---

## E-01: Anthropic contract and provider definition

**Goal:** Confirm the official provider contract and add the shared validation/registry definition without changing persistence or UI architecture.

**Exit gate:** The current official endpoint, authentication/version headers, Messages request/response shape, and streaming event format are recorded in task notes; the validation schema and registry metadata compile and classify secrets correctly.

**Depends on:** none

### T-01.1: Verifying the official Anthropic API contract

- **Status:** blocked
- **Owner:** backend-coding
- **Depends on:** none
- **Files:**
  - `packages/ai/src/providers/anthropic.ts` (new; implementation target)
  - `packages/ai/src/providers/anthropic.test.ts` (new; fixture target)
  - `packages/ai/src/types.ts` (modified only if verification proves the existing provider-neutral contract is insufficient; otherwise unchanged)
- **Intent:** Before writing adapter code, verify current official Anthropic documentation/API behavior for the Messages endpoint, required authentication and API-version headers, request fields needed for a minimal text call, response content-block parsing, and SSE event names/order for streaming. Compare the result with the existing `invokeGeneration` and `invokeStreamingGeneration` contracts.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — keep one flat provider entry and do not create provider-specific dispatch. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — keep credentials server-side and never place key material in fixtures or notes.
- **Verify:** Task notes identify the verified official endpoint, exact required headers/version, request body, response text extraction path, representative stream event fixtures, and any incompatibility with existing shared contracts. No unresolved product decision is silently guessed; any such decision is recorded as a blocker.
- **Notes:** Verified 2026-09-24 against the official Anthropic API documentation: [Messages API](https://docs.anthropic.com/en/api/messages), [streaming messages](https://docs.anthropic.com/en/api/messages-streaming), and [errors](https://docs.anthropic.com/en/api/errors).
  - **Endpoint:** `POST https://api.anthropic.com/v1/messages`. The approved fixed-endpoint provider shape is sufficient; no user-configurable base URL is required.
  - **Authentication/version headers:** `x-api-key: <API key>` and `anthropic-version: 2023-06-01`; requests also send `Content-Type: application/json`. `anthropic-version: 2023-06-01` is the current required API-version value documented for the Messages API. The API key remains adapter-owned and must never be returned or logged.
  - **Minimal non-streaming request:** `{ model, max_tokens, messages: [{ role: "user", content: prompt }], stream: false }`. The Messages API requires `model`, `max_tokens`, and `messages`; the existing fixed connection-test prompt can be sent as one user message. No system prompt, tools, temperature, or model catalog is required.
  - **Non-streaming response:** a successful response is a message object with `model` and `content`; `content` is an ordered array of content blocks. Text blocks have `{ type: "text", text: "..." }`. The adapter shall concatenate text from `type === "text"` blocks and return the response `model` as `modelUsed` when present. Non-text blocks do not add product behavior and are ignored for text extraction.
  - **Streaming request and event order:** set `stream: true` on the same Messages request. Anthropic emits SSE events including `message_start`, `content_block_start`, `ping`, `content_block_delta`, `content_block_stop`, `message_delta`, and `message_stop`; `error` may be emitted for an in-stream failure. Text is delivered in `content_block_delta` events whose `delta` is `{ type: "text_delta", text: "..." }`, generally within a `content_block_start`/`content_block_stop` pair. A normal response completes with `message_delta` followed by `message_stop`. Representative frames for tests are:
    - `event: message_start` / `data: {"type":"message_start","message":{"type":"message","id":"msg_test","role":"assistant","content":[],"model":"claude-test","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":0}}}`
    - `event: content_block_start` / `data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`
    - `event: content_block_delta` / `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}`
    - `event: content_block_stop` / `data: {"type":"content_block_stop","index":0}`
    - `event: message_delta` / `data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}`
    - `event: message_stop` / `data: {"type":"message_stop"}`
  - **Provider-neutral streaming fit:** the existing SSE reader currently passes each `data:` payload to the adapter parser and does not require provider-specific event names. The Anthropic parser can emit `chunk` for `text_delta`, `done` for `message_stop`, and a safe `error` for an `error` event or malformed JSON. No `StreamTextEvent` change, new route, or streaming UI is required.
  - **Errors:** non-2xx responses use an error envelope such as `{ "type": "error", "error": { "type": "authentication_error", "message": "..." } }`; relevant documented error types include `invalid_request_error`, `authentication_error`, `permission_error`, `not_found_error`, `rate_limit_error`, `api_error`, and `overloaded_error`. The shared HTTP status mapping can normalize 401/403 to `auth`, 404 to `not_found`, 429 to `rate_limit`, 400/422 to `bad_request`, and 5xx to `provider_error` without passing through the provider body. In-stream `error` events must likewise use the safe normalized message rather than the raw Anthropic message.
  - **Compatibility result:** `generateText` maps the response to the existing `TestResult` success/failure union; `streamText` maps to the existing `StreamTextEvent` union. Shared timeout abort, output-token clamping, latency measurement, transport failure mapping, and secret-redaction behavior remain applicable without modification. T-01.1 found no architecture or product-scope incompatibility and introduced no blocker.

### T-01.2: Defining Anthropic validation and registry metadata

- **Status:** blocked
- **Owner:** backend-coding
- **Depends on:** T-01.1
- **Files:**
  - `packages/validation/src/aiConnection.ts` (modified)
  - `packages/validation/src/aiConnection.test.ts` (modified or new, if this package's existing test convention requires a focused schema test)
  - `packages/ai/src/providers/anthropic.ts` (new)
  - `packages/ai/src/index.ts` (modified)
- **Intent:** Add the Anthropic config schema (`apiKey` non-empty string, `model` non-empty string), provider field metadata with correct secret classification, and a flat `anthropic` registry registration. Export only the existing package-level contracts needed by the API and adapter.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — define provider fields, validation, and adapter factory once in the registry; use separated `config`/`secrets` payloads; do not add database columns or frontend branches. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — classify only `apiKey` as secret and preserve the existing encrypted server-side path.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/validation typecheck && corepack pnpm --filter @portfolio-engineering/validation build` passes; `corepack pnpm --filter @portfolio-engineering/ai typecheck` passes; registry metadata reports exactly required secret `apiKey` and non-secret `model`, and no provider-specific persistence files change.
- **Notes:** Added `anthropicConfigSchema` and `AnthropicConfig` in the shared AI-connection validation package. Added the flat `anthropic` provider definition with display metadata and exactly two required fields: secret `apiKey` and non-secret `model`; registered and exported it through the existing AI package entry point. The provider remains `isUsable: false` with an explicit unimplemented adapter-factory guard until T-02.1 supplies the verified Messages adapter, so it is not advertised or accepted as usable prematurely. No persistence, crypto, API route, or frontend files changed. Local verification completed successfully with no errors: `corepack pnpm --filter @portfolio-engineering/validation typecheck`, `corepack pnpm --filter @portfolio-engineering/validation build`, and `corepack pnpm --filter @portfolio-engineering/ai typecheck`. T-02.1 is now unblocked.

---

## E-02: Anthropic adapter and streaming tests

**Goal:** Implement official Anthropic Messages invocation through the existing bounded, safe, provider-neutral helpers.

**Exit gate:** Mocked non-streaming and streaming tests pass for success and representative failure paths, including timeout/abort and redaction; the adapter exposes no custom endpoint or provider-specific result type.

**Depends on:** E-01

### T-02.1: Implementing the Anthropic Messages adapter

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.2
- **Files:**
  - `packages/ai/src/providers/anthropic.ts` (modified)
  - `packages/ai/src/index.ts` (modified if exports need completion)
  - `packages/ai/src/invoke.ts` (modified only if a genuinely provider-neutral helper correction is required)
  - `packages/ai/src/stream.ts` (modified only if a genuinely provider-neutral SSE/helper correction is required)
- **Intent:** Implement `createAnthropicAdapter` with `generateText` and `streamText`. Use the verified official endpoint and headers, send the fixed test prompt as a minimal user message, apply shared timeout/abort and token ceilings, parse text blocks and returned model, and map failures to the existing `FailureKind`/safe-message contract.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — register one flat adapter and reuse common invocation contracts. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — use the key only in server-side request headers and never emit it through errors, results, logs, or fixtures.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/ai typecheck` passes; the implementation has no configurable base URL, no model catalog, no new route, and no change to `packages/database` or `packages/crypto`.
- **Notes:** Implemented `createAnthropicAdapter` with both `generateText` and provider-neutral `streamText` using the verified `POST https://api.anthropic.com/v1/messages` contract, `x-api-key`, and `anthropic-version: 2023-06-01`. Non-streaming responses concatenate text content blocks and preserve the returned model; streaming maps `text_delta` to chunks and `message_stop` to completion, with Anthropic in-stream errors normalized to the existing safe failure vocabulary. Shared timeout, abort, output-token, latency, HTTP-status, transport-error, and redaction behavior remains provided by `invoke.ts` and `stream.ts`. The provider is now registered as usable through the flat registry. No database, persistence, crypto, route, or frontend files changed. Local verification completed successfully with no errors: `corepack pnpm --filter @portfolio-engineering/ai typecheck`. T-02.1 satisfies its Verify condition and T-02.2 is now unblocked.

### T-02.2: Adding focused adapter and stream regression tests

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.1
- **Files:**
  - `packages/ai/src/providers/anthropic.test.ts` (new)
  - `packages/ai/src/stream.test.ts` (modified only if a shared helper regression is discovered)
  - `packages/ai/package.json` (modified only if the test script must include the new compiled test)
- **Intent:** Mirror the existing OpenAI/Gemini/Azure mocked-fetch tests. Cover exact official request URL/headers/body, response text-block parsing and model, stream chunk/done parsing, authentication, not-found/model, rate-limit, bad-request/server failures, timeout abort, bounded token output, and absence of API key/prompt/raw provider body from results.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — tests must prove the provider-neutral adapter contract. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — tests must prove secret redaction and must use synthetic credentials only.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/ai test` passes, including the new compiled Anthropic test; `corepack pnpm --filter @portfolio-engineering/ai lint` passes; tests assert the exact verified headers and stream fixture behavior without network calls.
- **Notes:** Added focused mocked-fetch coverage in `packages/ai/src/providers/anthropic.test.ts` for exact Messages URL/headers/body, bounded non-streaming and streaming output tokens, text-block/model extraction, Anthropic SSE text deltas and `message_stop`, representative HTTP failures, timeout aborts, in-stream errors, and credential/prompt/provider-body redaction. Added the test file to the existing AI package test script with no new test harness. Verification completed successfully: `corepack pnpm --filter @portfolio-engineering/ai test` passed with 16 tests passed and 0 failed; `corepack pnpm --filter @portfolio-engineering/ai lint` passed with 0 warnings and 0 errors. T-03.1 is now unblocked; T-03.2 remains dependent on T-03.1.

---

## E-03: Catalog exposure and regression verification

**Goal:** Move Anthropic from planned to available through the existing metadata/API path and prove the current connection workflow remains unchanged.

**Exit gate:** Anthropic is discoverable as usable, rendered by the existing form, absent from the planned list, and existing providers/build checks remain green with no new route or persistence change.

**Depends on:** E-02

### T-03.1: Updating and verifying the Your AI provider catalog

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-02.1
- **Files:**
  - `apps/frontend/src/components/AiProviderCatalog.tsx` (modified)
  - `apps/frontend/src/components/AiConnectionForm.tsx` (modified only if a metadata-driven regression is found; expected unchanged)
  - `apps/frontend/src/YourAiPage.tsx` (modified only if provider loading behavior requires a bounded regression fix; expected unchanged)
- **Intent:** Remove only Anthropic from the hard-coded planned-provider list. Verify that the existing generic `provider.fields.map` form path renders Anthropic's `apiKey` and `model` metadata without an Anthropic-specific JSX, route, or component branch. Preserve the existing create/edit routes, post-save test, health grouping, and write-only secret copy. Frontend ownership is limited to catalog removal, generic form-path verification, and frontend lint/build/static checks; provider discovery and registry verification belong to T-03.2.
- **ADRs:** [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — do not leave implemented Anthropic support represented as an inert planned placeholder. [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — availability comes from running adapter support and form fields come from provider metadata; do not add Anthropic-specific JSX.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/frontend typecheck && corepack pnpm --filter @portfolio-engineering/frontend lint && corepack pnpm --filter @portfolio-engineering/frontend build` passes; static review of `AiProviderCatalog.tsx` confirms Anthropic is absent from Planned while the remaining planned providers are unchanged; static review of `AiConnectionForm.tsx` confirms provider fields render through the generic `provider.fields.map` path and would render the registry-provided `apiKey` and `model` metadata without Anthropic-specific JSX, route, or component branching. Provider discovery and exact metadata classification are verified only by backend-owned T-03.2.
- **Notes:** Removed only Anthropic from the hard-coded planned-provider list in `apps/frontend/src/components/AiProviderCatalog.tsx`. Static review confirms the remaining planned providers (`xai`, `openai-compatible`, and `local`) are unchanged. `AiConnectionForm.tsx` remains unchanged and continues to render all provider metadata through the generic `provider.fields.map` path, preserving create/edit behavior, post-save testing, health grouping, and write-only secret handling. Verification completed successfully: `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed; `corepack pnpm --filter @portfolio-engineering/frontend lint` completed with 0 errors and 6 pre-existing unrelated warnings; `corepack pnpm --filter @portfolio-engineering/frontend build` passed with only the existing non-blocking Vite chunk-size warning. T-03.1 is done and T-03.2 is now unblocked.

### T-03.2: Verifying API discovery and provider validation compatibility

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.2, T-03.1
- **Files:**
  - `apps/api/src/plugins/ai.test.ts` (modified only to extend the existing provider-registration assertion)
  - `packages/validation/src/aiConnection.ts` (modified only if a focused Anthropic schema export/test is needed; no route helper extraction)
  - `packages/ai/src/providers/anthropic.test.ts` (covered from T-02.2; modified only if a narrowly scoped assertion is missing)
- **Intent:** Use existing test seams to verify that the registered Anthropic provider is discoverable and has exactly the required field classification, and that the shared validation schema rejects missing or invalid API-key/model values where appropriate. Rely on the focused Anthropic adapter tests from T-02.2 for adapter factory/config rejection, safe failure mapping, bounded invocation behavior, and credential/prompt/raw-body redaction. Do not test private API route helpers, add a Fastify/auth/database fixture, expose private helpers solely for testing, or create a new test harness. Full authenticated create/update/test lifecycle assertions, including blank-secret preservation and persisted safe failures, remain explicitly deferred to TD-008.
- **ADRs:** [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — verify the flat registry metadata and shared provider-defined validation contract without adding route-specific provider knowledge. [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — preserve the existing encrypted, write-only connection path and verify redaction through adapter tests; full persisted secret-rotation/lifecycle coverage remains the explicitly recorded TD-008 follow-up.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/api exec tsx --test src/plugins/ai.test.ts` passes with the focused provider-registration and validation assertions; `corepack pnpm --filter @portfolio-engineering/ai test` passes with Anthropic adapter tests covering factory/config rejection, safe failure mapping, bounded invocation, and credential/prompt/raw-body redaction. The full API command is attempted and any unrelated pre-existing compilation blocker is recorded without repair. No private API helper, authenticated lifecycle fixture, database migration, or new test harness is introduced. Task notes link deferred lifecycle coverage to TD-008.
- **Notes:** Extended the existing API provider-registration test seam in `apps/api/src/plugins/ai.test.ts` to assert Anthropic discovery, `isUsable: true`, and the exact required secret/non-secret field classification. Added focused assertions through the existing validation package export for valid Anthropic configuration and rejection of missing or empty `apiKey`/`model` values. The focused seam passed: `corepack pnpm --filter @portfolio-engineering/api exec tsx --test src/plugins/ai.test.ts` completed with 6 passed and 0 failed. The AI suite passed: `corepack pnpm --filter @portfolio-engineering/ai test` completed with 16 passed and 0 failed. The required full API command, `corepack pnpm --filter @portfolio-engineering/api test`, was attempted but stopped during TypeScript compilation because of pre-existing unrelated `src/lib/helpRefresh.test.ts` errors involving the `HelpContentStore` contract; API tests never executed. `git diff upstream/main -- apps/api/src/lib/helpRefresh.test.ts` and `git diff upstream/main -- packages/database/src/helpContentStore.ts` produced no output, confirming the failing areas are outside this branch's changes. No Help subsystem repair was made. Full authenticated create/update/test lifecycle coverage, including blank-secret preservation and persisted safe failures, remains deferred to TD-008. T-03.3 is now unblocked.

### T-03.3: Running governance compliance review

- **Status:** done
- **Owner:** governance
- **Depends on:** T-03.2
- **Files:**
  - `docs/specs/0008-anthropic-ai-provider.md` (verification reference)
  - `docs/plans/0008-anthropic-ai-provider.md` (read-only review target)
  - `packages/ai/src/providers/anthropic.ts` (review)
  - `packages/validation/src/aiConnection.ts` (review)
  - `apps/frontend/src/components/AiProviderCatalog.tsx` (review)
  - `apps/api/src/plugins/ai.ts` (review)
- **Intent:** Perform the final read-only compliance review against Spec 0008, Spec 0002, ADR 0003, ADR 0010, and ADR 0011. Confirm no database, route, orchestration, model-catalog, new UI architecture, or secret-leakage drift was introduced, and report a governance decision with any findings routed to the owning agent. Governance must not edit the plan or any implementation artifact.
- **ADRs:** [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md), and [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — verify their provider availability, flat registry, dynamic form, encryption, and redaction requirements.
- **Verify:** Governance reports `Ready to execute`/completion-equivalent only when the plan's acceptance criteria, ADR constraints, ownership, scope boundaries, and recorded verification evidence are satisfied; otherwise it reports concrete blocking or non-blocking findings routed to the appropriate agent. No plan status mutation is required from governance.
- **Notes:** Final read-only governance review returned `Ready to execute` with no blocking findings. The full API-suite compilation blocker in unrelated Help code was accepted as a bounded verification limitation because the focused API seam passed 6/6, the AI suite passed 16/16, the failing Help files were unchanged, and lifecycle coverage remains deferred to TD-008. Governance did not modify the plan or implementation.

### T-03.4: Reconciling closeout documentation and plan progress

- **Status:** done
- **Owner:** closeout
- **Depends on:** T-03.3
- **Files:**
  - `docs/plans/closed/0008-anthropic-ai-provider.md` (modified)
  - `docs/specs/0008-anthropic-ai-provider.md` (reviewed; modified only if closeout identifies a directly related documentation correction)
  - `docs/tech-debt/checklist.md` (modified only if an existing TD-008 deferral needs a factual closeout note)
- **Intent:** After governance completes its read-only review, reconcile the plan Progress block, task Notes, and final status using the actual completed work and governance findings. Preserve any accepted TD-008 lifecycle-test deferral and do not claim verification that was not performed.
- **ADRs:** [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md), and [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — closeout must preserve the verified provider availability, flat registry, dynamic form, encryption, and redaction record.
- **Verify:** The plan's Progress block reflects the actual task statuses, governance findings are either resolved or recorded as bounded follow-up, the final plan status is accurate, and no unperformed lifecycle verification is marked complete.
- **Notes:** Closeout reconciliation completed. The plan is complete and archived under `docs/plans/closed/0008-anthropic-ai-provider.md`; the spec is marked implemented; the README changelog, ADR Recommendations, and TD-008 checklist entry record the bounded outcome and lifecycle-test deferral. Verified evidence remains: AI tests 16/16, AI lint 0 warnings/0 errors, focused API seam 6/6, frontend typecheck/build passed, frontend lint 0 errors with 6 unrelated pre-existing warnings, and full API-suite execution blocked only by unrelated Help compilation errors.

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | Anthropic may change or document Messages API headers/version or SSE event details after this plan is written. The adapter must use the current official contract verified in T-01.1, not assumptions copied from another provider. | High. Incorrect headers or event parsing would make the provider unusable or unsafe. | backend-coding | T-01.2, T-02.1, T-02.2 |
| R-2 | The verified Anthropic contract might not fit the current provider-neutral streaming interface without changing that shared contract. | Medium. A contract change could expand scope beyond this bounded provider increment. | backend-coding with governance review | E-02 and downstream tasks |
| R-3 | Existing API/frontend test harness coverage for the full connection lifecycle is limited by TD-007/TD-008. | Medium. Focused mocked and metadata tests are required; broad test-harness work is out of scope. | backend-coding / frontend-coding | T-03.2 verification only |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-24 | Initial plan | Created from [Spec 0008](../specs/0008-anthropic-ai-provider.md), grounded in the closed Spec 0002 implementation and current provider/test architecture. |
| 2026-09-24 | Governance readiness review | Kept governance read-only, narrowed API verification to existing provider/validation coverage with TD-008 lifecycle deferral, added bounded metadata/catalog/form verification, and added closeout-owned Progress reconciliation after governance review. |
| 2026-09-25 | Closeout reconciliation | Recorded final governance approval and verification boundaries, marked all efforts complete, updated durable closeout references, and archived the completed plan. |
