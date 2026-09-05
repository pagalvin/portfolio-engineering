# Lessons Learned

## API & Persistence
- Live verification must use the authenticated session bootstrap and the bearer token returned in the response header.
- Credential rotation can be validated by patching only the secret field and asserting the connection ID remains unchanged.
- Keep persistence metadata out of provider payloads at validation, response, and adapter boundaries.
- Connection grouping must be driven by persisted connection metadata returned by `GET /api/ai/connections`, not by synthetic client-side failures from request errors.

## Security
- Keep provider credentials and request payloads out of logs and debugging documentation.
- Confirm cleanup by listing connections after deletion; do not rely only on a client-side success message.

## React & UI State
- After `POST /api/ai/connections/:id/test` succeeds, reload the persisted connection list before regrouping rows so the UI matches refresh behavior.
- Do not mark a connection as failing on frontend-only errors such as local rate-limit HTTP responses, network failures, or failed refreshes; show the action error without changing persisted health.

## Build & Environment
- The API test limiter enforces a five-second minimum interval between tests for one connection.
- Persist test outcomes at the API boundary, including failures before the provider call begins; UI-local state is not durable.
- Refresh or reconcile UI state after mutations regardless of whether the request resolves with a domain failure or rejects at transport level.
- Treat persisted connection health as independent from edit validity: configuration changes may preserve an observed failure, and only a successful test may clear it.
- Live provider verification requires credentials supplied through local environment configuration; mocked adapter and API contract checks must not be represented as live provider success.

# Debugging Log: AI Provider Connections

## Issue #001: Initial cleanup result was ambiguous

**Date:** 2026-09-05 13:15 (local time)
**Status:** resolved
**Environment:** runtime
**Severity:** minor

### Error
The verification harness reported cleanup failure after the live flow, although the delete endpoint subsequently returned HTTP 200.

### Context
- **File(s):** `docs/debugging/0002-ai-provider-connections-debugging.md`
- **Trigger:** The first scripted flow attempted a second test immediately and then cleaned up in a `finally` block.
- **Recent changes:** None; this was a live verification harness behavior.
- **Reproduction steps:** Run the authenticated create/test/rotate/test/delete sequence without spacing test requests by the configured minimum interval.

### Root Cause
The harness did not preserve a reliable redacted status for the cleanup request after an intermediate request failure. A follow-up authenticated list confirmed one temporary connection, and an explicit delete returned HTTP 200.

### Related ADRs
- ADR-0011: No credentials or unredacted request bodies were recorded.

### Resolution
Repeated the flow with six-second intervals between tests. Create, first live test, same-ID secret update, and second live test each succeeded. A follow-up list confirmed the temporary connection was removed after an explicit delete.

### Lessons Learned
- Pattern to watch for: the minimum test interval is five seconds per connection.
- Avoid: treating a harness-level cleanup report as authoritative without verifying persisted state.
- Best practice: confirm deletion with a subsequent authenticated list.

### Follow-up
- [ ] Add test coverage for this scenario
- [ ] Update documentation
- [x] Flag for code review
- [ ] Related issue: none

## Live Verification Record: T-06.1

**Date:** 2026-09-05
**Status:** resolved
**Environment:** runtime
**Severity:** major

### Checks
- Local Postgres was running and migrations were already applied.
- API health check returned HTTP 200.
- Development authenticated session returned HTTP 200 and an access token header; the token value was not logged.
- Provider discovery returned two usable providers, including Azure OpenAI.
- Temporary Azure connection creation returned HTTP 201.
- First live Azure test returned HTTP 200 with `status=success` and a latency value.
- Secret-only rotation returned HTTP 200 and preserved the same connection ID.
- Second live Azure test returned HTTP 200 with `status=success`.
- Follow-up authenticated list found no temporary `T06.1-live-*` connection after deletion.

### Redaction
No credential values, access tokens, response text, or unredacted request bodies were written to this log.

## Live Verification Record: T-06.2

**Date:** 2026-09-05
**Status:** resolved
**Environment:** runtime
**Severity:** major

### Checks
- Authenticated development session bootstrap returned HTTP 200 with an access-token header; the token value was not logged.
- Provider discovery returned HTTP 200 and reported Google Gemini as usable.
- Local Gemini key and model configuration were present; values were not logged.
- Temporary Gemini connection creation returned HTTP 201.
- Live Gemini test through the UI request shape returned HTTP 200 with `status=success`.
- Temporary connection deletion returned HTTP 200.
- Follow-up authenticated connection listing returned HTTP 200 and contained no temporary T06.2 connection.

### Redaction
No credential values, access tokens, response text, failure payloads, or unredacted request bodies were written to this log.

## Live Verification Record: T-13.3

**Date:** 2026-09-05
**Status:** resolved
**Environment:** build / test / runtime
**Severity:** major

### Checks

- OpenAI was removed from the planned-only provider catalog.
- API provider registration tests confirmed OpenAI is usable and exposes required API-key/model metadata with correct secret classification.
- API tests passed.
- Frontend typecheck, lint, and build passed.
- User manually verified the live OpenAI connection flow.

### Redaction

No credential values, access tokens, response text, or unredacted request bodies were written to this log.

### Follow-up

- [x] Supply an OpenAI credential through local environment configuration.
- [x] Run authenticated live verification.
- [x] Record live verification without logging the credential.

## Issue #002: Existing connection deletion lacked confirmation and resilient UI handling

- Date: 2026-09-05
- Status: blocked
- Environment: frontend
- Severity: major
- Reported behavior: Deleting an existing AI connection from the Your AI list did not provide a confirmation prompt and was reported as not working.
- Evidence and reproduction: The list's Delete button called `onDelete` immediately. The callback invoked `DELETE /api/ai/connections/:id` through the authenticated API client, then removed the row only on success; failures were placed in the page load-error state, which could hide the list. The API route already used the verified request user's `organizationId` when deleting.
- Affected areas: `apps/frontend/src/components/AiConnectionList.tsx`, `apps/frontend/src/YourAiPage.tsx`; existing API client and `apps/api/src/plugins/ai.ts` delete path reviewed.
- Contract and ADR review: Spec 0002 requires deletion in the connection-management UI. Revised E-07 routes keep Your AI at `/workspace/settings/your-ai`; no new route or API contract was needed. ADR 0001 is preserved because the current DELETE endpoint scopes by verified organization context. ADRs 0002/0004 are unaffected because confirmation is ephemeral UI state. ADR 0005 is followed with the existing Dialog and Button primitives.
- Root cause: The destructive row action had no confirmation state, and its error path reused `loadError`, coupling a mutation failure to initial page loading and making the existing list appear unavailable.
- Resolution: Added a controlled Radix/shadcn confirmation dialog with an accessible title, description, Cancel action, Escape/outside-close behavior, and explicit Delete connection confirmation. Mutation now starts only after confirmation, preserves the existing organization-scoped endpoint, removes the row after success, and reports deletion errors without discarding the loaded list.
- Verification: Static trace confirms the confirmed action calls the existing authenticated `deleteAiConnection` method (`DELETE /api/ai/connections/:id`), whose API route passes `request.user.organizationId` to the store. Frontend typecheck/build/lint could not be executed in this environment because command execution was unavailable; no automated validation result is claimed.
- Follow-up: No spec or plan gap identified; completed E-07 task history was not changed.

## Issue #003: Delete request rejected as an empty JSON body

- Date: 2026-09-05
- Status: resolved
- Environment: API / frontend
- Severity: major
- Reported behavior: Deleting an AI connection returned HTTP 400 with `FST_ERR_CTP_EMPTY_JSON_BODY`.
- Evidence and reproduction: `AuthenticatedApiClient.deleteAiConnection` called the shared request helper without a body. The helper nevertheless sent `Content-Type: application/json`; Fastify's JSON parser rejected the empty request before the AI DELETE route executed.
- Affected areas: `apps/frontend/src/apiClient.ts`; `apps/frontend/src/aiConnectionApi.ts`; `apps/api/src/plugins/ai.ts`; Fastify configuration in `apps/api/src/app.ts`.
- Contract and ADR review: Spec 0002 requires deleting an organization-owned connection. The route already scopes deletion to `request.user.organizationId`, preserving ADR 0001. ADRs 0010 and 0011 are unaffected because no provider payload or secret handling changes. The correction preserves the existing shared API-client contract for JSON requests.
- Root cause: The shared request helper unconditionally set `Content-Type: application/json` even when `body` was `undefined`. Fastify treats an empty request with that media type as an invalid empty JSON document and returns `FST_ERR_CTP_EMPTY_JSON_BODY` before route handling.
- Resolution: The request helper now adds `Content-Type` only when a body is supplied and serializes supplied bodies based on `undefined` rather than truthiness. DELETE requests therefore send no JSON media type or body, while POST/PATCH/PUT requests retain their JSON headers and payloads.
- Verification: Static review confirms body-bearing requests still receive JSON serialization and `Content-Type`, while bodyless requests omit both. Frontend/API typecheck, build, lint, and tests could not be executed in this session because shell command execution was unavailable; no automated pass is claimed.
- Follow-up: No spec or plan gap identified.

## Issue #004: PATCH rejected persisted schema version as a provider field

- Date: 2026-09-05
- Status: blocked
- Environment: API / frontend
- Severity: major
- Reported behavior: Saving an existing AI connection returned `VALIDATION_ERROR` with `config.schemaVersion: unknown provider field`.
- Evidence and reproduction: A persisted connection config contains the internal `schemaVersion` marker. The PATCH route merged that persisted object with the submitted provider config before calling provider validation, so `schemaVersion` was checked as though it were a provider-defined field.
- Affected areas: `apps/api/src/plugins/ai.ts`; PATCH validation, connection responses, and provider test adapter construction.
- Contract and ADR review: Spec 0002 requires editable non-secret fields and provider-specific backend validation. ADR 0010 requires validation from provider-defined registry fields while allowing versioned JSON payloads; ADR 0011 secret write-only behavior remains unchanged. ADR 0001 organization scoping remains derived from `request.user.organizationId`.
- Root cause: Internal persistence metadata was stored alongside provider config, but the update validator and adapter invocation treated the entire stored JSON object as provider payload.
- Resolution: Added a single API-side projection that removes `schemaVersion` before provider validation, response serialization, and adapter construction. Stored config and secret payloads still retain schema version metadata, while only provider-defined fields participate in validation and invocation.
- Verification: Command execution was unavailable in this environment, so API/frontend typecheck, build, lint, and focused test passes could not be claimed. Static review confirms the persisted marker is removed before validation, response serialization, and adapter invocation.
- Follow-up: No spec or plan gap identified. Run the workspace validation commands when shell execution is available, then change this entry to resolved if they pass.

### 005: Failed test state was not durable for invocation errors

- Date: 2026-09-05
- Status: resolved
- Environment: API / frontend
- Severity: major
- Reported behavior: A failed connection test moved the card to Needs attention, but refreshing the page returned it to Active connections.
- Evidence and reproduction: The test route persisted metadata only after adapter construction and generation returned a `TestResult`. Decryption, stored-payload validation, or adapter setup failures escaped before `updateTestMetadata`; the frontend also refreshed the list only when the test request resolved.
- Affected areas: `apps/api/src/plugins/ai.ts`; `apps/frontend/src/YourAiPage.tsx`; connection health mapping and persisted test metadata.
- Contract and ADR review: Spec 0002 requires the latest test outcome, safe error summary, timestamp, and failure count to persist and drive `failing` health after refresh. ADR 0001 remains satisfied because all reads and writes use the verified organization scope. ADRs 0010 and 0011 remain satisfied because provider payloads stay registry-defined and secrets remain server-only.
- Root cause: Test invocation setup errors were not converted into a persisted safe failure result, and the UI had no refresh fallback when the test request rejected.
- Resolution: Wrapped server-side invocation setup and execution in a redacted failure boundary, persisted the resulting failure metadata, and refreshed the connection list after both resolved and rejected test requests.
- Verification: Static trace confirms every invocation failure path reaches `updateTestMetadata` with a safe failure result and that the frontend reloads persisted connections on either test outcome. Automated validation was not run in this session.
- Follow-up: Run the API/frontend typecheck and focused test commands when shell execution is available.


## Issue #005: Frontend-only test errors changed connection grouping until refresh

**Date:** 2026-09-05 14:19 (local time)
**Status:** resolved
**Environment:** frontend / API
**Severity:** major

### Error
Failed AI connection tests could move a card to the Needs attention group in the current UI session, while a browser refresh loaded the same connection back in Active.

### Context
- **File(s):** `apps/frontend/src/YourAiPage.tsx`, `apps/frontend/src/components/AiConnectionList.tsx`, `apps/api/src/plugins/ai.ts`
- **Trigger:** Testing a saved connection when the frontend request rejected instead of receiving a persisted provider test result, such as an app-level rate-limit response.
- **Recent changes:** E-09 wired create/edit workflow return to the Connections list and relied on local row mutation after test actions.
- **Reproduction steps:** Start from an Active saved connection, trigger a test request error that does not persist provider test metadata, observe the row move to Needs attention, then refresh and observe the API-provided persisted health still loads as Active.

### Root Cause
`YourAiConnectionsPage` treated every rejected test request as a connection failure and locally overwrote `health`, `lastTestStatus`, `lastTestFailureKind`, and `lastErrorSummary`. Those synthetic failures were not persisted by the backend when the provider was not actually tested, so the next `GET /api/ai/connections` correctly returned the pre-existing health state. The API response also leaked a naming drift by returning `lastTestErrorSummary` while the frontend contract expected `lastErrorSummary`, making persisted failure messaging unreliable after refresh.

### Related ADRs
- ADR-0001: Preserved; persisted health still comes from organization-scoped API reads.
- ADR-0002 / ADR-0004: Preserved; refresh now matches the URL-addressable Connections view state.
- ADR-0010: Preserved; no provider-specific branching or schema changes were introduced.
- ADR-0011: Preserved; no credentials, request bodies, tokens, or provider payloads were logged.

### Resolution
The frontend now records rejected test requests as transient row feedback without changing connection grouping or persisted-health fields. After a successful test endpoint response, it reloads `GET /api/ai/connections` and uses the API-mapped persisted health to regroup rows. The API response mapping now exposes `lastErrorSummary` from the stored `lastTestErrorSummary`, and the list renders persisted failure details when a refreshed row is genuinely failing.

### Lessons Learned
- Pattern to watch for: UI grouping for persisted lifecycle state should be refreshed from the canonical API after mutations that write server metadata.
- Avoid: using synthetic client-side error objects to mutate persisted state fields.
- Best practice: distinguish provider test failures returned by the test endpoint from app/request errors that occur before or after persistence.

### Verification
Static trace confirms provider test responses still render row feedback, successful test endpoint responses trigger a fresh `GET /api/ai/connections`, and rejected test requests no longer mutate `health` or last-test fields. Static trace also confirms API list responses now map the stored `lastTestErrorSummary` to the frontend's `lastErrorSummary` field. Focused API/frontend typecheck and lint commands were attempted, but shell execution was unavailable in this session due agent depth limits; no automated pass is claimed.

### Follow-up
- [ ] Add frontend regression coverage when a component test runner exists.
- [ ] Add API contract coverage for the `lastErrorSummary` response field.
- [x] Flag for code review
- [ ] Related issue: none

## Issue #006: Editing a failing connection cleared Needs attention state

- Date: 2026-09-05
- Status: resolved
- Environment: API / frontend
- Severity: major
- Reported behavior: Editing the label or configuration of a broken connection cleared its failure metadata, causing the connection to move from Needs attention to Active before a successful retest.
- Evidence and reproduction: The connection store's update path reset `lastTestStatus`, failure kind, summary, timestamp, and consecutive failure count whenever an edit was saved. The edit form also sent an empty `secrets` object when no replacement secret was entered, unnecessarily treating a normal edit as secret mutation.
- Affected areas: `packages/database/src/aiConnectionStore.ts`, `packages/database/src/aiConnectionStore.test.ts`, `apps/frontend/src/components/AiConnectionForm.tsx`, `docs/schema/0002-ai-provider-connections-design.md`.
- Contract and ADR review: Spec 0002 requires persisted latest test metadata and a Needs attention state for failures; only a successful test clears failure state. ADR 0001 remains satisfied because store reads and writes require verified organization scope. ADR 0010 remains satisfied because provider payload validation is unchanged. ADR 0011 remains satisfied because secrets remain write-only and blank edit fields preserve the encrypted value.
- Root cause: Edit persistence conflated invalidating a previous successful result with clearing an observed failure. This made an unverified configuration edit look healthy. The frontend also represented an omitted write-only secret as an empty replacement object.
- Resolution: Store updates now preserve failure metadata when the existing record is failing, while still invalidating stale successful metadata after configuration/label/secret edits. `updateTestMetadata` remains the only path that clears failure metadata on success. The edit form omits blank secret fields from PATCH requests.
- Verification: `corepack pnpm --filter @portfolio-engineering/database typecheck` passed with no TypeScript errors. Focused database tests and frontend typecheck could not be executed in this session because of sub-agent depth limits; no automated pass is claimed for those checks. Static review confirms the successful-test path resets failure metadata and edit paths do not write those columns for failing records.
- Follow-up: Run `corepack pnpm --filter @portfolio-engineering/database test` and `corepack pnpm --filter @portfolio-engineering/frontend typecheck` when command execution is available; add frontend regression coverage when a component test runner exists.

## Issue #007: Edit workflow lacked an inline connection test action

- Date: 2026-09-05
- Status: resolved
- Environment: frontend
- Severity: major
- Reported behavior: Editing an existing AI connection offered Save changes and Cancel, but no way to test the connection from the edit workflow.
- Evidence and reproduction: `AiConnectionForm` only submitted create/update requests; testing was available on the Connections list after leaving the edit route. This prevented loading, success, and failure feedback from being shown alongside the edit actions.
- Affected areas: `apps/frontend/src/components/AiConnectionForm.tsx`.
- Contract and ADR review: Spec 0002 requires saved connections to be testable and requires failed test metadata to drive the persisted `failing`/Needs attention state. The existing authenticated `POST /api/ai/connections/:id/test` client method is used, preserving organization-scoped server behavior (ADR 0001), provider-defined contracts (ADR 0010), and write-only secrets (ADR 0011). No route or History API behavior changed (ADRs 0002/0004); controls use the existing Button primitive (ADR 0005).
- Root cause: The edit form had no test action or test-result state; testing was implemented only on connection list rows.
- Resolution: Added an edit-only Test connection button beside Save changes and Cancel. It calls the existing authenticated test API, disables conflicting actions while pending, and renders loading, success, API failure, and returned provider-test failure feedback. The form does not synthesize health state or include secret values. Persisted failure handling remains owned by the API, so a failed provider result continues to load as Needs attention after refresh.
- Verification: Static review confirms the edit action calls `testAiConnection(apiClient, connection.id)`, uses no secret fields in the request, and renders `Testing...`, success status, and failure alerts. Frontend typecheck, lint, and build were requested but could not execute in this environment because command execution is unavailable; no automated pass is claimed.
- Follow-up: Run `corepack pnpm --filter @portfolio-engineering/frontend typecheck`, `lint`, and `build` when shell execution is available; add component regression coverage when a test runner exists.
