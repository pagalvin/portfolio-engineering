# Plan 0003: Journal Entry AI Analysis

- Status: `closed`
- Date: 2026-09-05
- Spec: [0003-journal-entry-ai-analysis](../../specs/0003-journal-entry-ai-analysis.md)
- Audience: [backend-coding, frontend-coding, database-design, uxd, governance, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: E-06
- Completed efforts: E-01, E-02, E-03, E-04, E-05, E-06
- Blocked tasks: none
- Next recommended task: none; feature closed out
- Last updated: 2026-09-05

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | UXD handoff | 1 | 1 | done |
| E-02 | Shared contracts and scoped lookup | 2 | 2 | done |
| E-03 | Provider-neutral streaming foundation | 3 | 3 | done |
| E-04 | Protected Journal analysis API | 3 | 3 | done |
| E-05 | Journal Day analysis UI | 4 | 4 | done |
| E-06 | End-to-end verification and closeout readiness | 2 | 2 | done |

## Summary

Deliver the first product-facing AI workflow: a Journal Day-view **Analyze with AI** panel that streams Markdown analysis for one saved Journal entry through one ready BYOK AI connection. The plan keeps persistence unchanged, adds a provider-neutral streaming path to the AI package, exposes a protected workflow-specific API, and integrates a transient accessible frontend panel.

## Inputs

- Spec readiness at planning time: `Ready for planning`, with no blocking open questions.
- ADRs reviewed: [0001](../../ADRs/0001-organization-aware-data-access.md), [0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [0010](../../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md), [0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md).
- UX artifacts used: [0001-portfolio-journal](../../uxd/flows/0001-portfolio-journal.md), [ui-scaffold-contract.json](../../uxd/flows/ui-scaffold-contract.json), and [0003-journal-entry-ai-analysis](../../uxd/flows/0003-journal-entry-ai-analysis.md).
- Schema reference: [current.md](../../schema/current.md). No schema migration is planned; this feature reads existing `journal_entries` and `ai_connections`.
- Intersecting tech debt: TD-006 (Journal frontend route/export/Markdown-view coverage), TD-007 (AI connection frontend coverage), TD-008 (AI connection API lifecycle coverage). This plan adds focused API/AI package tests where existing runners support them and relies on documented manual frontend verification because no component test runner exists.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) | The API reads organization-owned Journal entries and organization-owned AI connections. | E-02, E-04 |
| [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | The feature links from Journal to existing Settings routes and must not misuse URL state for transient analysis state. | E-01, E-05 |
| [ADR 0003](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) | Existing future Journal capabilities remain placeholders; this feature replaces only the actual analysis slice. | E-01, E-05 |
| [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) | Any route-safe Settings link must use React Router declarative navigation. | E-01, E-05 |
| [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | The Day-view analysis panel adds React UI, interaction states, responsive layout, and accessible controls. | E-01, E-05 |
| [ADR 0010](../../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) | Streaming must extend existing provider definitions/adapters without provider-specific database or route dispatch sprawl. | E-03, E-04 |
| [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) | The analysis API decrypts stored provider credentials to call providers and must never emit secrets. | E-04 |

## Approach

**Codebase findings that shape this plan.**

- Protected routes are registered in [protected.ts](../../../apps/api/src/plugins/protected.ts); Journal routes and AI connection routes already sit behind JWT verification and current-user reloading.
- Journal API logic currently lives in [journal.ts](../../../apps/api/src/plugins/journal.ts). To avoid bloating that file further, the analysis endpoint should live in a new [journalAnalysis.ts](../../../apps/api/src/plugins/journalAnalysis.ts) plugin and be registered from [protected.ts](../../../apps/api/src/plugins/protected.ts).
- [journalStore.ts](../../../packages/database/src/journalStore.ts) can read by date/range/page but has no scoped `getEntryById`; add a direct `organizationId` + `userId` + `entryId` lookup rather than querying Prisma from the API route.
- [aiConnectionStore.ts](../../../packages/database/src/aiConnectionStore.ts) already supports scoped `findById` and `decryptSecretForInvocation`; reuse those methods.
- [ai.ts](../../../apps/api/src/plugins/ai.ts) contains existing provider metadata shaping, health derivation, safe error logging, and test invocation logic. Extract or duplicate only small route-local helpers where necessary; do not log secrets, prompts, or Journal content.
- [aiTestLimits.ts](../../../apps/api/src/lib/aiTestLimits.ts) is an in-memory limiter precedent. Journal analysis needs a separate limiter in [journalAnalysisLimits.ts](../../../apps/api/src/lib/journalAnalysisLimits.ts), not reuse of the test limiter.
- [invoke.ts](../../../packages/ai/src/invoke.ts) is non-streaming and caps test output. Add a parallel streaming helper rather than changing the test path semantics.
- Provider modules [azureOpenAi.ts](../../../packages/ai/src/providers/azureOpenAi.ts), [googleGemini.ts](../../../packages/ai/src/providers/googleGemini.ts), and [openai.ts](../../../packages/ai/src/providers/openai.ts) currently expose `generateText`. Add a common `streamText` adapter method for this feature.
- The frontend authenticated client [apiClient.ts](../../../apps/frontend/src/apiClient.ts) assumes JSON responses. Add a streaming-specific method instead of forcing streaming through the JSON helper.
- The Day view component is inside [JournalPage.tsx](../../../apps/frontend/src/JournalPage.tsx) as `JournalDayView`; move analysis UI into a new component to keep the page maintainable.
- Existing primitives include [button.tsx](../../../apps/frontend/src/components/ui/button.tsx), [select.tsx](../../../apps/frontend/src/components/ui/select.tsx), [alert.tsx](../../../apps/frontend/src/components/ui/alert.tsx), [card.tsx](../../../apps/frontend/src/components/ui/card.tsx), and [MarkdownViewer.tsx](../../../apps/frontend/src/components/MarkdownViewer.tsx).

**Streaming contract choice.** Use a fetch-compatible, SSE-formatted stream over `POST /api/journal/entries/:entryId/analyze`. The stream should support typed events: `chunk`, `done`, and `error`. This keeps Authorization-header based auth intact and allows the frontend to preserve partial output while showing separate mid-stream errors.

**No schema migration.** The only database-layer change is a scoped Journal lookup helper. Do not add tables or persisted analysis records.

## Non-goals

- No saved analysis results, localStorage persistence, history, chat, follow-up questions, personas, prompt editing, multi-entry analysis, portfolio context, new providers, or route-level analysis location.
- No Vercel AI SDK or other streaming SDK dependency in this plan. If a future refinement wants one, replan explicitly.
- No broad frontend test-runner introduction. Use existing typecheck/build/lint and manual verification unless a runner already exists.

---

## E-01: UXD handoff

**Goal:** Create a UXD artifact that pins placement, states, focus behavior, responsive behavior, and copy for the Day-view analysis panel.

**Exit gate:** UXD artifact exists and resolves panel placement, state transitions, focus targets, no-ready-connection path, and mobile/tablet/desktop behavior. Frontend work may begin after this gate.

**Depends on:** none

### T-01.1: Designing the Journal analysis Day-view workflow

- **Status:** done
- **Owner:** uxd
- **Depends on:** none
- **Files:**
  - `docs/uxd/flows/0003-journal-entry-ai-analysis.md` (new)
  - `docs/uxd/flows/ui-scaffold-contract.json` (modified if UXD decides the machine-readable Journal contract should mention the analysis panel)
- **Intent:** Define the Day-view analysis panel placement and interaction model without expanding scope beyond the spec. Include state table coverage for idle, no ready connection, unsaved edits, connecting, streaming, stopped, complete, pre-stream error, and mid-stream error.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Do store meaningful location context in URL state, but the spec classifies selected connection/stream output as transient component state; Do Not hide core workflow location in component state. [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — Do use `Link`, `NavLink`, and navigation hooks for route-safe Settings navigation; Do Not add custom History API logic. [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do preserve keyboard interaction, visible focus, semantic HTML, labels, status messaging, contrast, and responsive behavior. [ADR 0003](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — Do keep future capabilities such as personas/context injection clearly planned if visible; Do Not label unavailable capabilities as active.
- **Verify:** The UXD artifact names the analysis panel placement, focus behavior, accessible announcements, responsive layout, exact user-facing copy or copy ranges, and all spec states. It does not introduce saved output, chat, personas, range analysis, or new routes.
- **Notes:** UXD flow artifact created at [0003-journal-entry-ai-analysis](../../uxd/flows/0003-journal-entry-ai-analysis.md). It defines inline Day-view placement below the Journal entry card, transient component-owned analysis state, ready-connection sorting/preselection behavior, stop/retry behavior, Markdown output boundaries, focus/status announcement requirements, responsive behavior, microcopy, API-facing UX contract, and planned-feature placeholder boundaries. Updated [ui-scaffold-contract.json](../../uxd/flows/ui-scaffold-contract.json) to include transient Journal analysis state and replace stale AI-summary wording.

---

## E-02: Shared contracts and scoped lookup

**Goal:** Add the typed request/stream contracts and the database-store lookup needed by the API without adding persistence.

**Exit gate:** Shared request/stream types and validation schema are exported, and the database package exposes a scoped `getEntryById` helper that enforces `organizationId` and `userId`.

**Depends on:** E-01

### T-02.1: Adding shared Journal analysis request and stream contracts

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.1
- **Files:**
  - `packages/shared-types/src/journalAnalysis.ts` (new)
  - `packages/shared-types/src/index.ts` (modified)
  - `packages/shared-types/package.json` (modified)
  - `packages/validation/src/journalAnalysis.ts` (new)
  - `packages/validation/src/index.ts` (modified)
  - `packages/validation/package.json` (modified)
- **Intent:** Define `JournalAnalysisRequest` with only `connectionId`, plus stream event types for `chunk`, `done`, and `error`. Add a Zod request schema that rejects organization/user scope in client input by allowing only the connection id body.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do read `organizationId` from verified auth context; Do Not infer tenant scope from request body, query params, or headers. This task prevents client-supplied org/user scope from entering the contract.
- **Verify:** `@portfolio-engineering/shared-types/journalAnalysis` and `@portfolio-engineering/validation/journalAnalysis` imports resolve after build. Validation accepts `{ connectionId: string }` and rejects missing/blank/non-string input. No request type includes `organizationId`, `userId`, prompt text, or Journal content.
- **Notes:** Added shared source-only types at [journalAnalysis.ts](../../../packages/shared-types/src/journalAnalysis.ts) and exported `@portfolio-engineering/shared-types/journalAnalysis`. Added strict Zod request validation and stream event schemas at [journalAnalysis.ts](../../../packages/validation/src/journalAnalysis.ts), exported from the package root and `@portfolio-engineering/validation/journalAnalysis`. Request validation accepts only a non-blank `connectionId` and rejects client-supplied organization scope, prompt text, Journal content, and non-string/missing/blank ids. Verified with `corepack pnpm --filter @portfolio-engineering/validation typecheck`, `corepack pnpm --filter @portfolio-engineering/validation lint`, a consumer-context shared-types subpath import check through `@portfolio-engineering/frontend`, a validation schema behavior check through `@portfolio-engineering/validation`, `corepack pnpm -r --filter ./packages/* --if-present build`, and `corepack pnpm --filter @portfolio-engineering/api typecheck`. An initial API typecheck before package build failed because workspace build outputs for existing package dependencies were unavailable after dependency restore; after building packages, API typecheck passed.

### T-02.2: Adding scoped Journal entry lookup by id

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/src/journalStore.ts` (modified)
  - `packages/database/src/index.ts` (modified only if exports need adjustment)
- **Intent:** Add `JournalStore.getEntryById({ organizationId, userId, entryId })` so the analysis API can fetch exactly one saved Journal entry through the store boundary.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do filter every organization-owned read by `organizationId`; Do treat missing organization scope as an error; Do Not rely only on parent joins or indirect ownership to enforce tenant scope.
- **Verify:** The helper requires `organizationId`, `userId`, and `entryId`; returns `null` for another user or organization; does not expose unscoped Prisma access. `corepack pnpm --filter @portfolio-engineering/database typecheck` passes.
- **Notes:** Added `JournalStore.getEntryById({ organizationId, userId, entryId })` to [journalStore.ts](../../../packages/database/src/journalStore.ts). The implementation performs a single scoped `findFirst` filtered by entry id, organization id, and user id, returning `null` when the entry is missing or belongs to another user/organization. No schema or migration change was needed because `journal_entries` already has direct `id`, `organizationId`, and `userId` fields. Verified with `corepack pnpm --filter @portfolio-engineering/database typecheck`.

---

## E-03: Provider-neutral streaming foundation

**Goal:** Extend the AI package with a reusable streaming-text contract and provider implementations for current usable providers.

**Exit gate:** OpenAI, Azure OpenAI, and Google Gemini adapters expose `streamText`, tests cover request shape/chunk parsing/failure sanitization for at least the OpenAI path plus shared stream helper behavior, and existing non-streaming connection tests still work.

**Depends on:** E-02

### T-03.1: Adding stream types and invocation helper

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.1
- **Files:**
  - `packages/ai/src/types.ts` (modified)
  - `packages/ai/src/invoke.ts` (modified)
  - `packages/ai/src/stream.ts` (new if separating streaming from non-streaming invocation is clearer)
  - `packages/ai/src/index.ts` (modified)
  - `packages/ai/package.json` (modified only if a new subpath export is needed)
- **Intent:** Add provider-neutral streaming types and a helper that performs POST requests, applies existing provider defaults, supports caller abort signals, classifies safe failures, and normalizes provider chunks into an async iterable of text or typed stream events.
- **ADRs:** [ADR 0010](../../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do define supported provider behavior through shared provider definitions; Do keep the registry a single dispatcher. Do Not create nested dispatchers or provider-specific database shapes. [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not log or emit secret values when provider requests fail.
- **Verify:** The helper can stream chunks from a mocked `fetch` response, maps non-2xx statuses to safe failure kinds, aborts on caller signal, and does not include API keys in thrown or returned error payloads.
- **Notes:** Added provider-neutral stream event types to [types.ts](../../../packages/ai/src/types.ts), exported safe failure classifiers from [invoke.ts](../../../packages/ai/src/invoke.ts), and added [stream.ts](../../../packages/ai/src/stream.ts) with `invokeStreamingGeneration`. The helper posts JSON with existing timeout/output-token defaults, composes caller abort signals with the timeout signal, reads SSE-style response bodies as an async iterable of `chunk`/`done`/`error` events, maps non-2xx responses and fetch failures to safe failure kinds, and never includes API keys or provider response bodies in returned error events. Added package root and `@portfolio-engineering/ai/stream` exports. Verified with `corepack pnpm --filter @portfolio-engineering/ai typecheck`, `corepack pnpm --filter @portfolio-engineering/ai lint`, `corepack pnpm --filter @portfolio-engineering/ai build`, a mocked-fetch streaming/status/abort/secret-safety check through the built `@portfolio-engineering/ai/stream` subpath, and `node --test packages\ai\dist\providers\openai.test.js`.

### T-03.2: Implementing streaming on provider adapters

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-03.1
- **Files:**
  - `packages/ai/src/providers/openai.ts` (modified)
  - `packages/ai/src/providers/azureOpenAi.ts` (modified)
  - `packages/ai/src/providers/googleGemini.ts` (modified)
  - `packages/ai/src/types.ts` (modified if adapter interfaces live there)
- **Intent:** Add `streamText` to all currently usable providers without changing their `generateText` connection-test behavior. Build provider request bodies with streaming enabled and translate provider-specific streaming payloads to normalized text chunks.
- **ADRs:** [ADR 0010](../../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do add provider support through provider entries/adapters; Do Not add provider-specific route branches outside the registry pattern. [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do decrypt/use credentials only in server-side invocation paths and never return/log secrets.
- **Verify:** OpenAI, Azure OpenAI, and Gemini adapters still pass existing `generateText` tests and expose `streamText`. Mocked streaming responses yield expected text chunks. Request bodies use streaming mode and continue to apply existing provider defaults.
- **Notes:** Added `streamText` to the OpenAI, Azure OpenAI, and Google Gemini adapters. OpenAI and Azure use chat-completions streaming request bodies with `stream: true` and parse `choices[0].delta.content` chunks, with `finish_reason` treated as completion. Gemini uses the existing generate-content API family with `:streamGenerateContent?alt=sse`, parses `candidates[0].content.parts[].text`, and also tolerates current Interactions-style `step.delta` text events. Existing `generateText` request bodies were left unchanged. Verified with `corepack pnpm --filter @portfolio-engineering/ai typecheck`, `corepack pnpm --filter @portfolio-engineering/ai lint`, `corepack pnpm --filter @portfolio-engineering/ai build`, a mocked provider-adapter streaming check for OpenAI/Azure/Gemini request bodies and yielded chunks, and `node --test packages\ai\dist\providers\openai.test.js`.

### T-03.3: Testing AI streaming behavior

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-03.2
- **Files:**
  - `packages/ai/src/stream.test.ts` (new)
  - `packages/ai/src/providers/openai.test.ts` (modified)
  - `packages/ai/src/providers/azureOpenAi.test.ts` (new if practical)
  - `packages/ai/src/providers/googleGemini.test.ts` (new if practical)
  - `packages/ai/package.json` (modified if an existing test script needs to include new node tests)
- **Intent:** Add focused tests for stream parsing, abort handling, safe failure classification, and preservation of the non-streaming test path.
- **ADRs:** [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not expose credentials through errors, responses, logs, or fixtures. Test fixtures must use fake keys only.
- **Verify:** The smallest existing package test command or package build/typecheck exercises the new tests. If the package lacks a test script, add only a package-local script using Node's existing test runner and document the command in task notes.
- **Notes:** Added a package-local `test` script in [package.json](../../../packages/ai/package.json) using Node's built-in test runner after package build. Added focused stream helper coverage in [stream.test.ts](../../../packages/ai/src/stream.test.ts) for SSE chunk parsing, output-token default application, non-2xx safe failure mapping, caller abort handling, and secret/prompt/body exclusion from returned errors. Extended [openai.test.ts](../../../packages/ai/src/providers/openai.test.ts) with streaming chat-completion coverage while preserving existing `generateText` tests. Added [azureOpenAi.test.ts](../../../packages/ai/src/providers/azureOpenAi.test.ts) for Azure streaming request bodies/chunks including v1-compatible `max_completion_tokens`, and [googleGemini.test.ts](../../../packages/ai/src/providers/googleGemini.test.ts) for `streamGenerateContent` and Interactions-style text deltas. Verified with `corepack pnpm --filter @portfolio-engineering/ai typecheck`, `corepack pnpm --filter @portfolio-engineering/ai lint`, and `corepack pnpm --filter @portfolio-engineering/ai test` (11 passing tests).

---

## E-04: Protected Journal analysis API

**Goal:** Add the protected workflow-specific streaming endpoint with scoped Journal/connection validation, server-owned prompt construction, and separate rate limiting.

**Exit gate:** `POST /api/journal/entries/:entryId/analyze` validates input, enforces readiness and rate limits before provider contact, streams typed events, aborts provider calls on disconnect/cancel, and never logs sensitive payloads.

**Depends on:** E-03

### T-04.1: Adding Journal analysis rate limiting

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.1
- **Files:**
  - `apps/api/src/lib/journalAnalysisLimits.ts` (new)
  - `apps/api/src/plugins/journalAnalysis.test.ts` (new or modified if tests are grouped with route tests)
- **Intent:** Implement an in-memory limiter separate from `aiTestLimits`: 3 seconds between starts for the same organization/user/entry/connection and 10 analysis starts per organization per minute. Expose deterministic reset/test helpers matching the existing limiter pattern.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do read organization scope from verified auth context; Do Not infer tenant scope from request body. Limiter keys must be built from authenticated context plus validated route/body ids.
- **Verify:** Tests cover allowed first attempt, same-key minimum interval rejection, organization-per-minute rejection, and independent organizations not blocking one another.
- **Notes:** Added separate in-memory Journal analysis limiter at [journalAnalysisLimits.ts](../../../apps/api/src/lib/journalAnalysisLimits.ts), with a 3-second minimum interval keyed by authenticated organization/user/entry/connection ids and a 10-starts-per-organization-per-minute window. Exposed `reserveJournalAnalysisSlot` and `resetJournalAnalysisLimitState` test helper. Added limiter coverage in [journalAnalysis.test.ts](../../../apps/api/src/plugins/journalAnalysis.test.ts) for allowed first start, same-key minimum interval rejection, scoped-key independence, per-organization window rejection, and independent organizations. Updated [package.json](../../../apps/api/package.json) so the API test script runs the new test file. Verified with `corepack pnpm --filter @portfolio-engineering/api typecheck`, `corepack pnpm --filter @portfolio-engineering/api lint`, and `corepack pnpm --filter @portfolio-engineering/api test` (9 passing tests).

### T-04.2: Implementing the protected streaming endpoint

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.2, T-03.2, T-04.1
- **Files:**
  - `apps/api/src/plugins/journalAnalysis.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified)
  - `apps/api/src/plugins/ai.ts` (modified only if safe shared helpers are extracted)
  - `packages/validation/src/journalAnalysis.ts` (modified only if route validation discoveries require schema refinement)
- **Intent:** Add `POST /api/journal/entries/:entryId/analyze` as a protected streaming route. Validate body, load the scoped Journal entry, load and readiness-check the scoped AI connection, reserve a Journal-analysis limit slot before provider contact, decrypt credentials, build the fixed financial-analyst prompt, and stream SSE-formatted `chunk`/`done`/`error` events.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do derive `organizationId` from verified auth context and filter every read by it; Do Not infer tenant scope from body/query/header. [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do decrypt only in server-side execution paths about to call a provider; Do Not return, log, or otherwise emit secrets. [ADR 0010](../../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) — Do use the shared provider registry/adapter; Do Not create provider-specific credential handling in the route.
- **Verify:** Manual or automated requests return 400 for invalid body, 404 for missing/cross-user entry, 404 or 400 for missing/not-ready connection without provider contact, 429 for limiter rejection, and an SSE stream for valid requests. Aborting the client request aborts the provider request. Logs contain ids/status only, not Journal content, prompts, provider chunks, raw provider errors, access tokens, or credentials.
- **Notes:** Added protected `POST /api/journal/entries/:entryId/analyze` in [journalAnalysis.ts](../../../apps/api/src/plugins/journalAnalysis.ts) and registered it from [protected.ts](../../../apps/api/src/plugins/protected.ts). The route validates strict params/body schemas, derives organization/user scope from verified auth context, loads the scoped Journal entry and AI connection via stores, requires an enabled/last-success/usable provider connection, reserves the Journal-analysis limiter before provider contact, decrypts credentials only server-side, builds the fixed financial-analyst prompt from saved Journal content, and streams SSE `chunk`/`done`/`error` envelopes. Added `journalAnalysisParamsSchema` in [journalAnalysis.ts](../../../packages/validation/src/journalAnalysis.ts). Client disconnects abort the provider signal, and logs include only safe error names plus provider/connection ids, not prompts, Journal content, chunks, raw provider errors, access tokens, or credentials. Verified with `corepack pnpm --filter @portfolio-engineering/api typecheck`, `corepack pnpm --filter @portfolio-engineering/api lint`, `corepack pnpm --filter @portfolio-engineering/validation typecheck`, and `corepack pnpm --filter @portfolio-engineering/api test` (9 passing tests). Focused injected route tests for the exact 400/404/429/SSE/abort cases remain the next planned task, T-04.3.

### T-04.3: Testing API authorization, readiness, and stream envelopes

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-04.2
- **Files:**
  - `apps/api/src/plugins/journalAnalysis.test.ts` (new)
  - `apps/api/src/plugins/ai.test.ts` (modified only if shared limiter/helper tests belong there)
  - `apps/api/package.json` (modified if the existing `test` script needs to include the new compiled test file)
- **Intent:** Add focused tests using existing Node test tooling for limiter behavior, pre-stream validation/readiness decisions, and SSE event envelope formatting with mocked provider streaming.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do verify cross-org/cross-user rows are excluded. [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not include secrets, prompts, or Journal content in logged/test-visible error payloads.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/api test` or the smallest updated equivalent passes and includes the new analysis tests. Tests prove provider invocation is not called for invalid, unauthorized, not-ready, or rate-limited requests.
- **Notes:** Added dependency-injected route test seams in [journalAnalysis.ts](../../../apps/api/src/plugins/journalAnalysis.ts) without changing the default protected route registration. Extended [journalAnalysis.test.ts](../../../apps/api/src/plugins/journalAnalysis.test.ts) from limiter-only coverage to focused route tests for invalid strict bodies, missing/cross-user Journal entries with authenticated scope, missing scoped AI connections, not-ready connections before limiter/provider contact, rate-limit rejection before credential decryption/provider invocation, valid SSE `chunk`/`done` envelopes, safe provider `error` envelopes, thrown stream failure sanitization, and client abort propagation to the provider `AbortSignal`. Tightened the route cancellation hook to abort on request `aborted`/`close` and response `close`. Verified with `corepack pnpm --filter @portfolio-engineering/api typecheck`, `corepack pnpm --filter @portfolio-engineering/api test` (18 passing tests), and `corepack pnpm --filter @portfolio-engineering/api lint`.

---

## E-05: Journal Day analysis UI

**Goal:** Add a transient, accessible analysis panel to the Journal Day view that consumes the streaming endpoint and follows the UXD state model.

**Exit gate:** The Day view can load ready connections, preselect/sort them, start/stop/retry streaming analysis, preserve partial output, render Markdown, and surface safe states without changing Journal routes or persistence.

**Depends on:** E-04 and E-01

### T-05.1: Adding frontend streaming API helpers

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-02.1, T-04.2
- **Files:**
  - `apps/frontend/src/apiClient.ts` (modified)
  - `apps/frontend/src/journalAnalysisApi.ts` (new)
  - `apps/frontend/src/aiConnectionApi.ts` (modified only if ready-connection helper types are centralized)
- **Intent:** Add a streaming-specific authenticated client method for `POST /api/journal/entries/:entryId/analyze` using `fetch`, bearer auth, and caller-provided `AbortSignal`. Parse SSE-formatted events into typed callbacks or an async iterable for the UI.
- **ADRs:** [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — Continue using component-level data loading; Do Not adopt router-owned data APIs without a new ADR. [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not expose credentials in frontend payloads; the request body must contain only `connectionId`.
- **Verify:** The helper sends only `connectionId`, handles `chunk`/`done`/`error` events, propagates safe pre-stream HTTP errors, supports abort, and does not route streaming through the JSON-only `request` helper.
- **Notes:** Added authenticated streaming support in [apiClient.ts](../../../apps/frontend/src/apiClient.ts) for `POST /api/journal/entries/:entryId/analyze` using `fetch`, bearer auth, credentials, caller-provided `AbortSignal`, and an incremental SSE frame parser for typed `chunk`/`done`/`error` events. The request body is built as `{ connectionId }` only and pre-stream HTTP failures are surfaced as `ApiError` without routing through the JSON-only `request` helper. Added [journalAnalysisApi.ts](../../../apps/frontend/src/journalAnalysisApi.ts) as the typed frontend wrapper. Verified with `corepack pnpm --filter @portfolio-engineering/frontend typecheck`.

### T-05.2: Building the Journal analysis panel component

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-01.1, T-05.1
- **Files:**
  - `apps/frontend/src/components/JournalAnalysisPanel.tsx` (new)
  - `apps/frontend/src/components/MarkdownViewer.tsx` (modified only if an empty-message or aria-label extension is needed)
  - `apps/frontend/src/components/ui/select.tsx` (modified only if accessibility/label behavior needs adjustment)
- **Intent:** Build the analysis panel with the spec/UXD states, alphabetical ready connection dropdown, empty panel plus disclaimer, streamed Markdown output, **Stop generating**, retry, safe errors, and polite status announcements.
- **ADRs:** [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do prefer shadcn/ui primitives and Tailwind utility composition; Do preserve keyboard interaction, visible focus, semantic HTML, labels, status messaging, contrast, and responsive behavior. [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not display secrets or raw provider payloads.
- **Verify:** With mocked props/client behavior, the component preselects the alphabetically first ready connection, hides non-ready connections, disables retry/start while streaming, preserves partial output after stop or mid-stream error, renders accumulated output through the safe Markdown viewer, and announces state changes without announcing every chunk.
- **Notes:** Added [JournalAnalysisPanel.tsx](../../../apps/frontend/src/components/JournalAnalysisPanel.tsx) with ready-connection loading, ready-only filtering, alphabetical label sorting with provider display-name tie-breaker, first ready connection preselection, connection load/no-ready states, one-time streaming start/stop/retry, partial-output preservation, safe pre-stream and mid-stream errors, Markdown rendering, disclaimer copy, and coarse polite status announcements that do not announce each chunk. Extended [MarkdownViewer.tsx](../../../apps/frontend/src/components/MarkdownViewer.tsx) with an optional `emptyMessage` prop for feature-specific empty output copy. Verified with `corepack pnpm --filter @portfolio-engineering/frontend typecheck`.

### T-05.3: Integrating analysis into the Journal Day view

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-05.2
- **Files:**
  - `apps/frontend/src/JournalPage.tsx` (modified)
  - `apps/frontend/src/journalApi.ts` (modified only if analysis helpers are re-exported from existing Journal API boundaries)
- **Intent:** Add **Analyze with AI** and the analysis panel to `JournalDayView` for saved Day entries only. Pass entry id, saved content status, current unsaved-edit state, API client, and Settings navigation callback without adding Week/Month/All row entry points.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Do keep major view location in URL; analysis state is transient and must not be forced into URL state. [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — Do use navigation hooks for route-safe Settings actions; Do Not use custom History API logic. [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do preserve accessible responsive behavior.
- **Verify:** The Day view shows analysis only for a saved entry, communicates when unsaved edits mean the saved version is analyzed, links to `/workspace/settings/your-ai/connections` when no ready connection exists, does not add analysis controls to Week/Month/All rows, and does not change the Journal URL for analysis state.
- **Notes:** Integrated [JournalAnalysisPanel.tsx](../../../apps/frontend/src/components/JournalAnalysisPanel.tsx) into the Day-only `JournalDayView` in [JournalPage.tsx](../../../apps/frontend/src/JournalPage.tsx). Added the **Analyze with AI** action to the saved-entry action row, disabled it when no saved entry exists, focused the analysis heading when opened, passed the saved entry id, authenticated API client, unsaved-edit state, and route-safe Settings navigation callback, and placed the panel below the Journal entry card and above planned-feature placeholders. Week, Month, and All views remain unchanged and no analysis state is written to the Journal URL. Verified with `corepack pnpm --filter @portfolio-engineering/frontend typecheck`.

### T-05.4: Polishing frontend accessibility and responsive behavior

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-05.3
- **Files:**
  - `apps/frontend/src/components/JournalAnalysisPanel.tsx` (modified)
  - `apps/frontend/src/JournalPage.tsx` (modified)
  - `apps/frontend/src/App.css` (modified only if existing non-migrated layout classes require a narrow adjustment)
- **Intent:** Verify and adjust keyboard order, focus targets, aria-live status, error roles, mobile stacking, 200% zoom behavior, and no-horizontal-scroll behavior. Prefer Tailwind classes and existing semantic tokens; avoid broad style rewrites.
- **ADRs:** [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Do use semantic tokens and preserve accessibility; Do Not add arbitrary literal colors or broad style-only rewrites. [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — Do not add custom routing state while polishing UI behavior.
- **Verify:** Keyboard-only operation reaches every control with visible focus; screen-reader status text changes at start/streaming/stopped/complete/failure without announcing every chunk; mobile/tablet/desktop layouts are readable and controls remain reachable.
- **Notes:** Polished [JournalAnalysisPanel.tsx](../../../apps/frontend/src/components/JournalAnalysisPanel.tsx) and [MarkdownViewer.tsx](../../../apps/frontend/src/components/MarkdownViewer.tsx) for accessible labels, coarse `aria-live` status, error association with the analysis controls, stale-output copy when unsaved edits follow generated output, loading-error status text, mobile-first wrapping controls, and long Markdown content overflow/wrapping. Verified keyboard-reachable controls by DOM order/code inspection: **Analyze with AI** opens/focuses the panel heading, the visible `AI connection` select precedes **Start analysis**/**Retry analysis** and **Stop generating**, settings/retry buttons are reachable from their alert states, and the Markdown output is a labeled region that is not an assertive live region. `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed. `corepack pnpm --filter @portfolio-engineering/frontend lint` passed with two pre-existing `react(only-export-components)` warnings in [button.tsx](../../../apps/frontend/src/components/ui/button.tsx) and [App.tsx](../../../apps/frontend/src/App.tsx), unrelated to this task.

---

## E-06: End-to-end verification and closeout readiness

**Goal:** Prove the integrated feature works through build/typecheck/lint and a local runtime flow, then prepare documentation for closeout.

**Exit gate:** Targeted verification commands pass, manual runtime verification is recorded without secrets, and remaining follow-up debt is captured.

**Depends on:** E-05

### T-06.1: Running targeted verification

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.3, T-04.3, T-05.4
- **Files:**
  - `docs/debugging/0003-journal-entry-ai-analysis-debugging.md` (new if issues occur; otherwise no change)
  - `docs/plans/0003-journal-entry-ai-analysis.md` (modified only for task/progress updates)
- **Intent:** Run the smallest existing commands that cover changed packages and apps, escalating only if targeted failures indicate broader risk.
- **ADRs:** [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Do Not record credentials, prompt payloads, access tokens, provider raw responses, or full Journal content in logs/debugging notes.
- **Verify:** At minimum, run package/app typechecks for `@portfolio-engineering/ai`, `@portfolio-engineering/database`, `@portfolio-engineering/validation`, `@portfolio-engineering/api`, and `@portfolio-engineering/frontend`; run package/app lint where changed; run existing API/AI tests updated by this plan; run frontend build if frontend changed. Record commands and results in task notes.
- **Notes:** Ran the targeted verification set across changed packages/apps. Passed: `corepack pnpm --filter @portfolio-engineering/ai typecheck`, `corepack pnpm --filter @portfolio-engineering/database typecheck`, `corepack pnpm --filter @portfolio-engineering/validation typecheck`, `corepack pnpm --filter @portfolio-engineering/api typecheck`, `corepack pnpm --filter @portfolio-engineering/frontend typecheck`, `corepack pnpm --filter @portfolio-engineering/ai lint`, `corepack pnpm --filter @portfolio-engineering/database lint`, `corepack pnpm --filter @portfolio-engineering/validation lint`, `corepack pnpm --filter @portfolio-engineering/api lint`, `corepack pnpm --filter @portfolio-engineering/frontend lint`, `corepack pnpm --filter @portfolio-engineering/ai test`, `corepack pnpm --filter @portfolio-engineering/api test`, and `corepack pnpm --filter @portfolio-engineering/frontend build`. Frontend lint passed with two pre-existing `react(only-export-components)` warnings in [button.tsx](../../../apps/frontend/src/components/ui/button.tsx) and [App.tsx](../../../apps/frontend/src/App.tsx). Frontend build passed with the existing Vite chunk-size warning for the generated `dist/assets/index-*.js` bundle exceeding 500 kB after minification.

### T-06.2: Performing manual streaming workflow verification

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-06.1
- **Files:**
  - `docs/debugging/0003-journal-entry-ai-analysis-debugging.md` (new if issues occur; otherwise no change)
  - `docs/tech-debt/checklist.md` (modified only if uncovered follow-up debt should be captured)
  - `README.md` (modified only during closeout if the feature ships and changelog policy requires it)
- **Intent:** Verify the runtime user flow with a saved Day entry and a ready AI connection: preselection, streaming Markdown, **Stop generating**, partial-output preservation, retry, no-ready-connection guidance if practical, and safe error display.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Verify scoped data access behavior where practical. [ADR 0011](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) — Never record secrets, prompt payloads, access tokens, provider response text, or full Journal content in verification notes.
- **Verify:** Manual verification notes confirm a valid request streams through one ready connection, stop aborts and preserves partial output, retry uses the selected connection, non-ready connections are not selectable, and no analysis output persists after refresh/navigation. Any follow-up debt is added to [checklist.md](../../tech-debt/checklist.md) rather than hidden in chat.
- **Notes:** Partial local runtime verification completed with `corepack pnpm dev` and browser automation. Demo auth worked and a saved Day entry existed/was created. The API reported four AI connections: three ready and one non-ready. The analysis panel preselected the first ready connection and the dropdown showed only the three ready connections. Streaming began; **Stop generating** aborted the request and preserved partial output. Refresh and navigation cleared transient analysis output. A temporary retry blocker occurred when one selected ready connection returned HTTP 400 with the safe message that the selected AI connection could not be prepared; that blocker was logged in [0003-journal-entry-ai-analysis-debugging.md](../../debugging/0003-journal-entry-ai-analysis-debugging.md) without secrets, prompt payloads, provider output, access tokens, or full Journal content, and [TD-009](../../tech-debt/checklist.md) captures follow-up for clearing stale ready state after invocation-time credential preparation failures. Human manual verification on 2026-09-05 confirmed Azure OpenAI and Gemini both fully tested and working, non-ready connections are not selectable, and no additional verification rerun is needed at this time.

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | Provider streaming formats differ, especially Gemini streaming versus OpenAI/Azure chat-completion streams. | Could delay E-03 or produce inconsistent chunk parsing. | backend-coding | T-03.2, T-03.3 |
| R-2 | Existing output-token defaults may produce very short analysis. | Demo value may be limited, but spec intentionally defers custom output policy. | backend-coding | none |
| R-3 | Journal analysis limiter is in-memory by plan, following current test limiter precedent. | Not suitable for multi-process deployments; acceptable for this proof slice but should be revisited before hosted scale. | governance | none |
| R-4 | No frontend component test runner exists. | Accessibility/responsive/stream UI behavior relies on typecheck/build/lint plus manual verification. | governance | none |
| R-5 | Streaming route tests may require more harness work than existing API tests. | Could reduce automated route coverage if not planned carefully. | backend-coding | T-04.3 |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-05 | Initial plan | Created implementation plan from spec 0003. |
