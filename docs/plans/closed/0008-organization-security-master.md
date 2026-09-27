# Plan 0008: Organization-Level Security Master

- Status: `done`
- Date: 2026-09-26
- Spec: [0008-organization-security-master](../specs/0008-organization-security-master.md)
- Audience: [coding-agents, database-agents, uxd, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: none (plan complete)
- Completed efforts: E-01, E-02, E-03, E-04
- Blocked tasks: none
- In-progress tasks: none
- Next recommended task: none; follow-ups are tracked in the tech debt checklist (TD-015 to TD-017)
- Last updated: 2026-09-26

| Effort | Title | Tasks | Done | Cancelled | Status |
| --- | --- | --- | --- | --- | --- |
| E-01 | Security persistence | 3 | 3 | 0 | done |
| E-02 | Protected CRUD API | 3 | 2 | 1 (T-02.2) | done |
| E-03 | Security Master UI | 8 | 7 | 1 (T-03.2) | done |
| E-04 | Governance review | 2 | 2 | 0 | done |

## Summary

Deliver an organization-owned Security Master with searchable CRUD, lifecycle controls, and safe deletion. Database design and migration establish the organization-scoped persistence contract first; protected API work and then the route-addressable frontend consume that contract. Sector and industry are manually entered free text. AI classification suggestions and provider integration are deferred to a future phase.

## Inputs

- Spec readiness at planning time: `Ready for implementation planning` ([0008-organization-security-master](../specs/0008-organization-security-master.md))
- ADRs reviewed: [0001 organization scoping](../ADRs/0001-organization-aware-data-access.md), [0002 URL-addressable routing](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003 shared planned-feature placeholder](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004 React Router](../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005 Tailwind and shadcn/ui](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [0016 restrict deletion of referenced securities](../ADRs/0016-restrict-deletion-of-referenced-securities.md), [0017 standardize data grid list behaviors](../ADRs/0017-standardize-data-grid-list-behaviors.md) (added 2026-09-26 during UI refinement; codifies behaviors already implemented in the Security Master list; user approved as `accepted` on 2026-09-26)
- UX artifacts used: [Security Master UX flow](../uxd/flows/0008-security-master.md), [UI scaffold contract](../uxd/flows/ui-scaffold-contract.json)
- Schema reference: [current schema documentation](../schema/current.md), [Prisma schema](../../packages/database/prisma/schema.prisma), organization-scoped store patterns in `packages/database/src`
- Intersecting tech debt: TD-003, generated Prisma client commit policy is accepted but unresolved; follow the existing `generate`/`sync-generated.mjs` workflow and keep generated output aligned without broad unrelated regeneration. No other checklist item directly changes this feature's scope.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0001](../ADRs/0001-organization-aware-data-access.md) | Security records are organization-owned and all protected reads/writes must use organization scope from verified auth context. | E-01, E-02, E-03 |
| [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | The Security Master list and record workflows are major views with meaningful search/filter context. | E-03 |
| [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) | Until the working feature is exposed, any planned entry must remain a presentation-only placeholder. | E-03 |
| [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) | New routes and query state must use React Router v7 declarative APIs. | E-03 |
| [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | New React UI uses existing Tailwind tokens and owned shadcn/ui primitives. | E-03 |
| [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) | Permanent deletion must be restricted when references exist and must never cascade to dependent business data. | E-01, E-02, E-03 |
| [ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) | The Security Master list is a filterable data grid: compact heading, one-row URL-owned filters with visible defaults, row hover plus explicit row action, distinct result states, and an organization-scoped "Showing N of T" count line. User approved ADR 0017 as `accepted` on 2026-09-26. | E-02 (T-02.3), E-03 (T-03.6, T-03.7), E-04 |

## Approach

- Follow the existing `JournalEntry`/`AiConnection` organization-owned data pattern: direct `organizationId`, Prisma model, store methods that require organization scope, protected Fastify plugin registration, shared Zod contracts, and frontend calls through `AuthenticatedApiClient`.
- Treat duplicate identity as organization + normalized symbol + exchange. A missing exchange is a distinct value: one blank-exchange record may coexist with exchange-specific records for the same normalized symbol, but a second blank-exchange record may not. Database design must encode this invariant despite PostgreSQL's default unique-index handling of `NULL`.
- Only symbol is required. Sector and industry remain optional free text. The database design task must specify symbol normalization (including case and whitespace) and exchange normalization so UI validation, API conflict handling, and the database invariant agree; do not silently rewrite user-entered display values.
- Use restrictive reference semantics for future foreign keys. There are no current feature tables that reference securities, so the database task should not invent dependent models. The store/API delete contract must nevertheless expose a safe blocked-by-reference result when restrictive references exist.
- AI classification suggestions and provider integration are explicitly deferred. This phase provides optional free-text sector and industry fields only and must not add AI suggestion UI, API, provider invocation, or connection-selection behavior.
- Place the initial Security Master navigation item as a flat **Security Master** link in the existing **System** group. This is the fallback expressly allowed by the UX contract; do not build a general nested navigation framework for one feature. Route path remains `/workspace/security-master`, leaving room to introduce **System → Master Data → Securities** later.
- Keep list search/filter state (`q`, `status`, `type`, `exchange`) in the URL. Validate repeated/unknown/malformed query parameters explicitly. Detail/edit may carry only a validated same-origin list `returnTo` value to preserve navigation context.
- Implement UI with existing React Router v7, Tailwind design tokens, and repository-owned shadcn primitives; do not add a UI package or component-specific CSS.
- Continue using the shared Not Yet Implemented placeholder only while the route is intentionally unavailable. Do not mix placeholder-only behavior with partially working fake CRUD.

## Non-goals

- External catalog, spreadsheet, copy/paste, or AI-assisted import.
- AI-generated classification suggestions or other AI/provider integration for Security Master.
- Licensed/official GICS taxonomy or classification source metadata.
- Prices, market data, broker integrations, options contracts, fundamentals, earnings, or holdings.
- Experiments or other dependent business entities; no speculative reference tables are part of this plan.
- General nested navigation redesign.

---

## E-01: Security persistence

**Goal:** Establish and verify the organization-scoped security persistence contract before API consumers are implemented.

**Exit gate:** The Prisma model, database constraints, generated client, store contract, migration, and schema documentation agree; targeted store tests prove organization isolation and duplicate semantics.

**Depends on:** none

### T-01.1: Designing the security persistence contract

- **Status:** done
- **Owner:** database-design
- **Depends on:** none
- **Files:**
  - `packages/database/prisma/schema.prisma` (review; proposed changes documented in task notes before migration)
  - `docs/specs/0008-organization-security-master.md` (reference)
  - `docs/schema/current.md` (reference)
  - `packages/database/prisma/migrations/` (review relevant existing migration patterns)
- **Intent:** Define the `Security` model, organization relation, stable ID and timestamps, nullable optional fields, allowed type representation, symbol/exchange normalization, indexes for documented search/filter patterns, duplicate constraint including a distinct blank-exchange value, store operations, and restrictive future reference/deletion behavior. Do not add speculative dependent entities; escalate any unresolved identity or migration decision before task completion.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — direct `organizationId` ownership and tenant-filter every operation; [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — no cascading deletion and a persistence-level restriction safe against concurrent references.
- **Verify:** Task notes contain the approved field/nullability and type contract, exact normalization rule, database-enforced uniqueness design (including blank exchange), required indexes, delete-result contract, migration/rollout considerations, and a clear statement that no current dependent entity is being introduced.
- **Notes:**
  - **Field and ownership contract:** Add a `Security` model with a stable `id String @id @default(cuid())`, required direct `organizationId String`, an `Organization` relation with `onDelete: Restrict`, and required `createdAt`/`updatedAt` timestamps using the repository's existing `DateTime @default(now())`/`@updatedAt` pattern. The business fields are `symbol String` (required display value), `symbolNormalized String` (required canonical key), `type SecurityType` (required Prisma enum with exactly `STOCK`, `ETF`, `INDEX`, and `OTHER`), `name String?`, `description String?`, `exchange String?` (optional display value), `exchangeNormalized String` (required canonical key), `sector String?`, `industry String?`, and `active Boolean @default(true)`. Optional fields remain nullable; no official taxonomy or classification-source field is added.
  - **Display and identity normalization:** Preserve `symbol` and `exchange` exactly as supplied at the persistence boundary, including user-entered case and surrounding characters; never rewrite those display columns to their canonical forms. Reject a symbol whose canonical form is empty. Derive each key by Unicode NFKC normalization, Unicode-whitespace trimming, and locale-independent upper-casing (`toUpperCase()`); do not collapse internal whitespace or punctuation. `symbolNormalized` is therefore the canonical symbol. `exchangeNormalized` is the same canonical form for a nonblank exchange and the non-null empty string `''` when exchange is omitted, null, or whitespace-only. The blank display value remains nullable when omitted and is not used for identity. All create/update paths must derive keys from the same shared normalization helper; callers must not supply independent key values.
  - **Uniqueness and indexes:** Enforce duplicate identity with a database unique constraint on `(organizationId, symbolNormalized, exchangeNormalized)`. Because `exchangeNormalized` is non-null and uses `''` for blank, PostgreSQL's NULL uniqueness behavior cannot permit a second blank-exchange row; a blank-exchange row can still coexist with specified exchanges. Add the direct `organizationId` index and composite indexes for documented organization-scoped list access: `(organizationId, symbolNormalized)`, `(organizationId, exchangeNormalized)`, `(organizationId, active)`, `(organizationId, type)`, and `(organizationId, updatedAt)`. Do not add a speculative trigram/full-text index; the symbol/name contains search can begin with the organization predicate and be optimized separately if measured need is demonstrated.
  - **Store contract and typed outcomes:** Every method requires verified `organizationId` and includes it in every read, write, update, delete, and aggregate predicate. The store exposes `create`, `list` (search by symbol/name plus active/type/exchange filters), `find`, `update`, `setActive`/`activate`/`deactivate`, and `delete`. Create/update return a discriminated result distinguishing success, `not_found` (for scoped missing IDs), and `duplicate_identity`; delete distinguishes `deleted`, `not_found`, and `blocked_by_references`. Unexpected database failures are thrown, not converted to success or null. List/detail results never reveal rows outside the supplied organization.
  - **Deletion and future references:** No dependent entity or reference table is introduced in this task. The security primary key remains the only stable reference identity; symbol, exchange, and name are not foreign-key substitutes. Future organization-owned dependent tables must carry both `organizationId` and `securityId`, use a composite foreign key to the security's organization/key pair, and specify `ON DELETE RESTRICT` (not cascade), so cross-organization references are structurally impossible and a reference cannot race a delete unnoticed. The delete store operation must rely on the restrictive database operation/transaction and map the referential-integrity violation to `blocked_by_references`; deactivation remains available and does not affect references. The first dependent feature must add its real FK and tests for blocked deletion rather than relying only on a pre-check.
  - **Migration and rollout:** T-01.2 should add the new enum/table/indexes/FK additively; there is no existing security data to backfill and no existing table to rewrite. Apply the migration before deploying consumers, generate/sync the Prisma client through the repository workflow, and then enable store/API writes. Validate the unique constraint against same-org duplicate, same-org blank-exchange, same-symbol/different-exchange, and cross-organization cases. Rollback should be a forward fix rather than dropping a table after consumer deployment; any future populated-column tightening or dependent FK introduction requires a separate backfill/lock review. Generated-client policy remains the existing TD-003 workflow concern and is not a reason to broaden this design task.
  - **Verification evidence:** Reviewed [0008 organization security master](../specs/0008-organization-security-master.md), [ADR 0001](../ADRs/0001-organization-aware-data-access.md), [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md), the current [Prisma schema](../../packages/database/prisma/schema.prisma), existing migration SQL under `packages/database/prisma/migrations/`, [current schema documentation](../schema/current.md), organization-scoped store patterns under `packages/database/src`, and the Security Master UX query/field contract. The task's Verify requirements are satisfied by the design above; no schema, migration, generated client, store, or test implementation was started.

### T-01.2: Migrating and implementing the security store

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.1
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified)
  - `packages/database/prisma/migrations/<timestamp>_add_securities/migration.sql` (new)
  - `packages/database/src/securityStore.ts` (new)
  - `packages/database/src/index.ts` (modified)
  - `packages/database/src/securityStore.test.ts` (new)
  - `packages/database/src/generated/prisma/` (generated/modified through repository scripts)
  - `docs/schema/current.md` (modified)
- **Intent:** Implement the approved persistence design using repository Prisma migration/generation scripts. Provide organization-required create/list/detail/update/active-state/delete operations; list search and filters must match the UX contract. Return a typed distinction for missing records, duplicate identity conflicts, and deletion blocked by references; do not swallow unrelated database failures.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — direct tenant column and organization filter every operation; [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — restrictive deletion, no cascades, and persistence enforcement.
- **Verify:** Prisma generation and database package typecheck pass; migration applies; targeted store tests prove scoped CRUD, search/filter behavior, normalized duplicate matching for blank and specified exchanges, safe deletion of unreferenced records, and explicit failure/block behavior without affecting another organization's rows.
- **Notes:**
  - Implemented the approved `Security` model, `SecurityType` enum, additive migration, organization-scoped store, exports, generated Prisma client, focused tests, and schema documentation. No dependent business entity was introduced.
  - `normalizeSecurityIdentity` applies Unicode NFKC normalization, `trim()`, and `toUpperCase()`; display `symbol` and `exchange` values remain unchanged. Blank exchange identity is stored as non-null `''`, with database uniqueness on `(organizationId, symbolNormalized, exchangeNormalized)`.
  - Store operations require and filter by `organizationId`. Delete maps a restrictive `P2003` failure to `blocked_by_references` and rethrows unrelated failures; the current migration intentionally has no dependent security reference table.
  - Verification completed: `corepack pnpm --filter @portfolio-engineering/database generate`, database `typecheck`, database `build`, seven focused security store tests, `migrate:deploy` (migration applied; subsequent run reported no pending migrations), and live PostgreSQL checks for same-organization duplicate/blank-exchange behavior, cross-organization isolation, display preservation, and unreferenced deletion.

### T-01.3: Scoping security store writes by organization

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.2
- **Files:**
  - `packages/database/src/securityStore.ts` (modified)
  - `packages/database/src/securityStore.test.ts` (modified)
- **Intent:** Resolve governance finding F5 by ensuring security store writes cannot update records outside the supplied organization scope.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — update writes must include the verified organization predicate, not only the record ID.
- **Verify:** Database build passes; database tests pass; database lint is clean; API tests pass; `git diff --check` is clean.
- **Notes:**
  - Remediated F5: `update` now uses `updateMany({ where: { id, organizationId } })`; a count of `0` maps to `not_found`, and successful updates perform an organization-scoped re-read. `P2002` maps to `duplicate_identity`, `P2025` maps to `not_found`, and unexpected errors are rethrown. `setActive` and `delete` were already organization-scoped writes; no schema change was required.
  - Added in-memory Prisma double tests proving count excludes other organizations; cross-organization update and `setActive` return `not_found` and leave the other row untouched; same-organization update persists; duplicate mapping and unexpected-error rethrow behavior remain intact.
  - Verification passed: database build; database tests (31/31); database lint clean; API tests (41/41); and `git diff --check`.

---

## E-02: Protected CRUD API

**Goal:** Expose validated, organization-scoped security CRUD and lifecycle operations.

**Exit gate:** Protected CRUD routes use verified organization context, conform to shared contracts, and have route tests for success, validation, conflicts, deletion restrictions, and cross-organization isolation.

**Depends on:** E-01

### T-02.1: Implementing protected Security Master CRUD routes

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.2
- **Files:**
  - `apps/api/src/plugins/securityMaster.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified)
  - `apps/api/src/plugins/securityMaster.test.ts` (new)
  - `packages/validation/src/securityMaster.ts` (new)
  - `packages/validation/src/index.ts` (modified)
  - `packages/shared-types/src/securityMaster.ts` (new)
  - `packages/shared-types/src/index.ts` (modified)
- **Intent:** Define typed request/response contracts and protected endpoints for list/search/filter, detail, create, update, activate/deactivate, and delete using only the approved store API. Derive `organizationId` from `request.user`; map duplicate conflicts and referenced-security deletion to explicit, stable client errors without exposing cross-organization record existence or reference details.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — tenant comes from verified JWT and scopes every access; [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — delete rejects references and never cascades.
- **Verify:** API typecheck and targeted route tests pass for all CRUD/lifecycle paths, malformed and repeated query parameters, duplicate conflicts, blocked delete, and same-ID access attempts from a different organization.
- **Notes:**
  - Added strict shared Security Master Zod contracts and shared response/error types, including explicit validation of repeated, unknown, and malformed list query parameters.
  - Added protected list, detail, create, update, activate, deactivate, and delete routes using only the approved organization-scoped security store. Organization scope is derived exclusively from verified `request.user`; inaccessible IDs return the same generic not-found response.
  - Duplicate identity and blocked-by-reference results map to stable 409 errors; unexpected store failures are allowed to propagate to Fastify's error handling. No AI route or provider behavior was added.
  - Added focused route tests covering organization filtering, same-ID cross-organization isolation, query validation, CRUD/lifecycle success paths, duplicate and blocked-delete conflicts, and unexpected failures.
  - Verification passed: validation build; API typecheck, build, lint, and full test suite (41 tests); validation lint; focused Security Master route tests; `git diff --check`.

### T-02.2: Providing optional AI classification suggestions

- **Status:** cancelled
- **Owner:** backend-coding
- **Depends on:** none
- **Files:**
  - `apps/api/src/plugins/securityMaster.ts` (modified)
  - `apps/api/src/plugins/securityMaster.test.ts` (modified)
  - `packages/validation/src/securityMaster.ts` (modified)
  - `packages/shared-types/src/securityMaster.ts` (modified)
  - `packages/ai/src/` (review; modify only if the existing provider adapter lacks a required typed capability)
- **Intent:** Cancelled by user direction: Security Master AI classification and provider integration are deferred to a future phase. Do not implement an endpoint or invoke an AI provider in this plan.
- **ADRs:** none for this cancelled task.
- **Verify:** Cancellation is recorded; no AI suggestion route or provider integration is included in this phase.
- **Notes:** Deferred to a future phase at the user's direction on 2026-09-26.

### T-02.3: Returning an organization-scoped total count from the security list

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/src/securityStore.ts` (modified; `SecurityStore.count({ organizationId })`)
  - `packages/validation/src/securityMaster.ts` (modified; `securityCollectionResponseSchema.totalCount`)
  - `packages/shared-types/src/securityMaster.ts` (modified; `SecurityCollectionResponse.totalCount`)
  - `apps/api/src/plugins/securityMaster.ts` (modified; list route returns `{ securities, totalCount }`)
  - `apps/api/src/plugins/securityMaster.test.ts` (modified; test fakes implement `count`, list test asserts `totalCount`)
  - `apps/api/package.json` (modified; `predev` builds validation and database packages)
- **Intent:** Support the grid count status line by returning the organization's unfiltered security total alongside filtered list results, derived only from verified `request.user.organizationId`. Recorded retroactively: this API change was made during the T-03.6 UI refinement and verified in the same run; this task gives it an owning API record.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — the count predicate is organization-scoped from verified auth context; [ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — "T comes from the server, organization-scoped, in the same list response"; do not compute totals client-side.
- **Verify:** Validation and database builds pass; database tests pass; API typecheck, lint, and tests pass with the list test asserting `totalCount`; the running app shows "Showing N of T securities".
- **Notes:** Added by implementation-planner on 2026-09-26 as a retroactive record. Verification evidence comes from the T-03.5/T-03.6 verification run: validation build passed; database build passed with 27/27 tests; API typecheck and lint passed with 41/41 tests; `git diff --check` passed. The user confirmed the count line in the running app after restarting the API. The count does not change the schema; it is a query only. See debugging log Issue 003 for the stale-`dist` dev-server failure and the `predev` fix. Follow-up for governance: no API test yet proves another organization's rows are excluded from `totalCount`. The fake store filters by organization, but the list test has only one organization's record in the count path. ADR 0017 asks for this coverage.
  - Correction, 2026-09-26: The earlier note claiming no API test covers cross-organization exclusion from `totalCount` was incorrect. The list test in `apps/api/src/plugins/securityMaster.test.ts` includes an `org-b` record and asserts `totalCount === 1`; T-01.3 added direct store-count coverage.

---

## E-03: Security Master UI

**Goal:** Deliver the accessible, responsive, URL-addressable Security Master workflow using the approved API contracts, including the approved optional closed Exchange dropdown and readable detail view.

**Exit gate:** Organization members can complete list/search/filter (per ADR 0017 grid behaviors, including Active default status and the "Showing N of T" count line), CRUD, lifecycle, fixed-choice Exchange, and readable label/value detail workflows; loading, empty, validation, conflict, and failure states are explicit and tested, with blank and Other choices, legacy-value preservation, native keyboard/accessibility behavior, readable multi-line descriptions, bottom-positioned timestamp metadata, existing API behavior, and normalization preserved.

**Depends on:** E-02

### T-03.1: Building Security Master CRUD and navigation

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-02.1
- **Files:**
  - `apps/frontend/src/SecurityMasterPage.tsx` (new)
  - `apps/frontend/src/securityMasterApi.ts` (new)
  - `apps/frontend/src/apiClient.ts` (modified)
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/scaffoldRoutes.ts` (modified)
  - `apps/frontend/src/SecurityMasterPage.test.tsx` (new, using existing test support if feasible)
- **Intent:** Replace the planned placeholder with the real list, detail, create/edit, deactivate/reactivate, and safe delete UX. Implement URL-owned query filters/search and validated list-return context per the UX flow. Add a flat **Security Master** link under the current **System** navigation group (do not build nested navigation infrastructure). Use existing UI primitives/tokens and show errors, empty results, mutation status, and reference-blocked deletion clearly.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — frontend visibility is not authorization and API owns tenant access; [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — route/filter context survives refresh and browser history; [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — replace presentation-only placeholder only when functional workflow is ready; [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — declarative routes and query state, no custom History API; [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — existing owned primitives and semantic Tailwind tokens; [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — confirmation plus server-authoritative blocked-delete handling and no cascades.
- **Verify:** Frontend typecheck, lint, build, and focused tests pass; direct route load, refresh, and back/forward preserve filter/detail return context; focused tests or documented manual verification cover malformed, repeated, and unknown list query parameters, plus malformed, external-origin, and unsupported-path/parameter `returnTo` URLs, aligned to the [Security Master UX flow](../uxd/flows/0008-security-master.md); UI tests or documented manual verification cover empty/results, validation, duplicate conflict, deactivate/reactivate, delete success, blocked deletion, API failure, and keyboard-accessible confirmation.
- **Notes:**
  - Added the typed `AuthenticatedApiClient` Security Master methods and a route-addressable React Router workflow for list/search/filter, detail, create/edit, lifecycle actions, and confirmed deletion. The flat Security Master link is under System; no AI UI or calls were added.
  - List query parsing rejects malformed, repeated, and unknown parameters. Detail/edit `returnTo` accepts only same-origin `/workspace/security-master` URLs with supported, non-repeated filters; invalid, external, unsupported-path, and unsupported-parameter values fall back to the unfiltered list.
  - Implemented explicit loading, empty, validation, API failure/retry, duplicate/reference conflict, save, lifecycle, and deletion states. Forms keep drafts out of the URL and confirm discarding changes; deletion uses an accessible Radix confirmation dialog.
  - Focused tests cover valid query state, malformed/repeated/unknown filters, and malformed/external/unsupported `returnTo` cases. Manual route behavior is wired through declarative `Link`, `NavLink`, `useNavigate`, and `useSearchParams`, preserving refresh and browser history context.
  - Verification passed: frontend typecheck, focused frontend tests (19 tests), lint (pre-existing warnings only), production build, and `git diff --check`. Build emitted only the existing large-chunk advisory.

### T-03.2: Integrating reviewed AI classification suggestions

- **Status:** cancelled
- **Owner:** frontend-coding
- **Depends on:** none
- **Files:**
  - `apps/frontend/src/SecurityMasterPage.tsx` (modified)
  - `apps/frontend/src/securityMasterApi.ts` (modified)
  - `apps/frontend/src/apiClient.ts` (modified)
  - `apps/frontend/src/SecurityMasterPage.test.tsx` (modified)
- **Intent:** Cancelled by user direction: Security Master AI classification and provider integration are deferred to a future phase. Keep sector and industry as manually editable optional free-text fields; do not add AI controls or calls.
- **ADRs:** none for this cancelled task.
- **Verify:** Cancellation is recorded; the Security Master form contains manual free-text classification fields only.
- **Notes:** Deferred to a future phase at the user's direction on 2026-09-26.

### T-03.3: Implementing the approved Exchange combobox UX

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.1
- **Files:**
  - `apps/frontend/src/SecurityMasterPage.tsx` (modified; existing Security Master form/list Exchange control)
  - `apps/frontend/src/SecurityMasterPage.test.tsx` (modified; focused Exchange interaction and accessibility coverage)
- **Intent:** Update the existing Security Master form/list Exchange control to an optional editable accessible combobox. Provide a short set of common local suggestions as non-authoritative convenience values while allowing arbitrary custom text and blank input; selecting a suggestion must only populate the existing string value and must not introduce an Exchange entity, table, API, or provider integration.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — UI behavior must not replace server-side organization/API authorization; [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — preserve the existing URL-owned list exchange filter semantics; [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — retain existing declarative routing/query-state behavior; [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — use existing accessible UI primitives and semantic Tailwind tokens; [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — do not alter server-authoritative lifecycle/deletion behavior.
- **Verify:** Focused frontend tests and frontend typecheck/lint/build pass. Tests or documented manual checks demonstrate that Exchange is optional and can be blank, accepts and preserves arbitrary custom values, offers only local non-authoritative suggestions, remains editable after suggestion selection, and supports keyboard navigation, visible focus, expected combobox announcements/roles, and screen-reader labeling. Existing create/update/list API payloads remain string/null-compatible, and existing symbol/exchange normalization, duplicate handling, URL filter behavior, and all other CRUD/lifecycle workflows are unchanged; no Exchange Master schema/API surface is added.
- **Notes:** Bounded follow-up prompted by the approved UXD update on 2026-09-26; no broader redesign or persistence/API work is in scope.
  - Added the optional editable Exchange combobox to the existing create/edit form with local NYSE, NASDAQ, AMEX, LSE, and TSX suggestions. Suggestions are explicitly convenience-only; custom text, blank values, editing after selection, and a clear action remain supported.
  - Added combobox/listbox roles and relationships, visible focus styling through the existing Input primitive, live suggestion-count/no-suggestion announcements, focus-preserving Arrow Down/Up, Enter, Escape, and mouse selection behavior. Existing list URL exchange filtering and string/null API payload behavior were unchanged.
  - Added focused Exchange tests covering local filtering, custom/no-match behavior, accessible source contract, and keyboard index wrapping. No Exchange entity, schema, API, provider, routing, normalization, duplicate, or lifecycle changes were made.
  - Verification passed: focused Exchange tests (3), complete frontend tests (22), frontend typecheck, lint (existing warnings only), production build (existing chunk-size advisory only), and `git diff --check`. Initial root workspace-selector commands were invalid for this repository; rerunning from `apps/frontend` passed.

### T-03.4: Replacing Exchange combobox with fixed-choice dropdown

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.3
- **Files:**
  - `apps/frontend/src/SecurityMasterPage.tsx` (modified; Exchange create/edit control)
  - `apps/frontend/src/SecurityMasterPage.test.tsx` (modified; Exchange select behavior)
- **Intent:** Replace the editable Exchange combobox with a native closed select. Offer blank, NYSE, NASDAQ, AMEX, LSE, TSX, and Other choices; do not accept newly entered custom values. Preserve an existing stored exchange outside the fixed set as a clearly labelled legacy/current choice while editing, until the user explicitly selects one of the fixed choices. “Other” is the literal value `OTHER`, not a custom-entry mode. Do not change the string/null API contract, schema, normalization, duplicate identity, or list filtering; do not add Exchange Master or provider integration.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — use existing semantic tokens and accessible owned primitives; [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — preserve URL-owned exchange filtering; [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — retain declarative routing behavior.
- **Verify:** Frontend tests confirm blank and every fixed choice (including literal `OTHER`), legacy value preservation, and use of the shared native `<select>` with an associated label; frontend typecheck, lint, build, and `git diff --check` pass. The browser's native select supplies Arrow Up/Down behavior; no custom keyboard handling remains. Existing API payload compatibility, normalization, duplicate handling, list URL filtering, and other CRUD/lifecycle behavior remain unchanged; no schema/API Exchange Master surface is added.
- **Notes:** Follow-up to the user's 2026-09-26 decision replacing the editable combobox with fixed choices; retain T-03.3 as completed history. Implemented and verified 2026-09-26. Frontend tests (22), typecheck, lint, and production build passed; lint showed only existing warnings and build showed the existing chunk-size advisory. Keyboard behavior is native HTML select behavior, not separately simulated in a browser test.

### T-03.5: Improving the security detail presentation

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.4
- **Files:**
  - `apps/frontend/src/SecurityMasterPage.tsx` (modified; read-only detail layout and description rendering)
  - `apps/frontend/src/SecurityMasterPage.test.tsx` (modified; detail presentation contract)
  - `apps/frontend/src/securityMasterApi.ts` and `apps/frontend/src/securityMasterApi.test.ts` (modified; safe detail return URL construction)
  - `docs/specs/0008-organization-security-master.md` (modified; detail presentation requirement)
  - `docs/uxd/flows/0008-security-master.md` (modified; detail layout and text treatment)
  - `docs/uxd/flows/ui-scaffold-contract.json` (modified; Security Master detail-view contract)
- **Intent:** Improve Security Master list/detail hierarchy: use a moderate list title and subtle result-row hover feedback; show symbol, name, and lifecycle status together in the detail header; use compact two-column label/value rows with subtle hover feedback; preserve user-entered description line breaks; move created/updated timestamps to the bottom in smaller secondary text; and return edit save/cancel actions to the read-only detail view while preserving list context.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — keep the record detail route addressable and return context intact; [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — use existing semantic tokens and accessible structure.
- **Verify:** Focused frontend tests assert the moderate list title, subtle hover highlight on result rows, symbol/name/status detail header, compact two-column label/value rows, bold/high-contrast labels, subtle detail-row hover feedback, description in the value column with preserved whitespace/newlines, timestamps after the detail fields, and edit-save/cancel returning to the read-only detail route with validated list context. Frontend typecheck, tests, lint, build, and `git diff --check` pass. Existing API and lifecycle behavior remain unchanged.
- **Notes:** Refined the detail layout to match the user's clarification: the two columns are label and value, not separate field pairs. Labels use a compact first column; values use the wider second column. Description preserves line breaks and stays in the value column; timestamps remain in smaller text at the bottom. Updated the detail header to show symbol, name, and lifecycle status together. Edit save, cancel, and Back now return to detail while preserving list return context; create cancel still returns to list. Reduced the Security Master grid heading to a moderate 2xl size. New-security forms now reset every field and leave optional Type unselected instead of defaulting it to OTHER. Added subtle hover highlighting to the security list result rows while retaining the explicit View link. Verification passed: `corepack pnpm --filter @portfolio-engineering/frontend test` (34/34), `typecheck`, `lint` (six pre-existing warnings), `build` (existing 595.96 kB chunk advisory), and `git diff --check`. User manually confirmed the detail view works. The timestamp test now checks ISO `dateTime` values; the UI formats API-serialized timestamps as valid HTML time values.

### T-03.6: Compacting list filters and using an Exchange dropdown

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.4
- **Files:**
  - `apps/frontend/src/SecurityMasterPage.tsx` (modified; responsive filter row and Exchange filter select)
  - `apps/frontend/src/securityMasterApi.ts` (modified; exchange filter choice helper)
  - `apps/frontend/src/SecurityMasterPage.test.tsx` (modified; rendered filter contract)
  - `apps/frontend/src/securityMasterApi.test.ts` (modified; fixed and legacy exchange filter choices)
  - `docs/uxd/flows/0008-security-master.md` (modified; responsive list filter behavior)
  - `docs/uxd/flows/ui-scaffold-contract.json` (modified; list filter contract)
- **Intent:** Place search, Status, Type, and Exchange filters in one horizontal row at wide viewport sizes with responsive wrapping on smaller screens. Replace the free-text Exchange filter with a native select using All exchanges, the supported fixed exchange values, and Other. Preserve a currently selected legacy exchange query as a clearly labelled option without changing URL/API filter semantics.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — filters remain URL-owned; [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — use the existing accessible native select and responsive utilities.
- **Verify:** Focused tests confirm the filter controls share a row at desktop widths and Exchange offers the fixed choices with a fallback for an existing unlisted URL filter. Frontend tests, typecheck, lint, build, and `git diff --check` pass. Search/status/type/exchange query parsing, URL update behavior, and API request shape remain unchanged.
- **Notes:** Implemented the one-row wide-screen filter layout, responsive wrapping, and native Exchange select with fixed choices plus a labelled unlisted-current-value fallback. Added source and helper tests; preserved URL query and API filter semantics. Status now defaults to Active when the URL omits it (the list requests `status=active`); choosing All writes `status=all` explicitly. Added a grid-footer status line ("Showing N of T securities"); `GET /api/securities` now returns an organization-scoped `totalCount` via a new `SecurityStore.count`. Verification passed: validation build; database build and tests (27/27); API typecheck, tests (41/41), and lint; frontend tests (34/34), typecheck, lint, build, and `git diff --check`. Frontend lint reported six pre-existing warnings; build reported the existing 595.96 kB chunk advisory. User manually confirmed the list loads and shows the count line after API restart. Added `count` to the unexpected-store-failure test fake to satisfy the expanded store contract.

### T-03.7: Resolving governance UI findings

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.6
- **Files:**
  - `apps/frontend/src/SecurityMasterPage.tsx` (modified)
  - `apps/frontend/src/apiClient.ts` (modified)
  - `apps/frontend/src/SecurityMasterPage.test.tsx` (modified)
- **Intent:** Resolve governance findings F1, F2, F3, F4, and F6 in the implemented Security Master UI.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — frontend behavior must preserve server-owned organization scoping; [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — Add Security carries a validated list `returnTo`; [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — accessible semantic controls and feedback; [ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — distinguish empty and filtered-zero list states and keep count context.
- **Verify:** Frontend tests, typecheck, lint, build, and `git diff --check` pass.
- **Notes:**
  - Remediated F1 by rendering the edit form only when the loaded record matches the route ID, showing `role="status"` while loading, showing a `role="alert"` failed-load state with Try again and a return link, and gating submission until the record is loaded.
  - Remediated F2 by adding field-level errors with `aria-invalid`/`aria-describedby`, visible messages, focus on the first invalid field, duplicate-identity feedback on Symbol and Exchange while preserving the draft, and form-level handling for unexpected failures.
  - Remediated F3 by distinguishing "No securities yet" from "No securities match your filters", adding Clear filters for filtered-zero results, and preserving the count line.
  - Remediated F4 by ignoring stale aborted responses and passing `AbortSignal` through `listSecurities`/`getSecurity` to `fetch`. Remediated F6 by carrying a validated list `returnTo` into Add Security.
  - Verification passed: frontend tests (39/39); frontend typecheck; frontend lint with six pre-existing warnings; frontend build with the existing large-chunk advisory; and `git diff --check`.

### T-03.8: Updating Security Master UX docs to implemented state

- **Status:** done
- **Owner:** uxd
- **Depends on:** T-03.6
- **Files:**
  - `docs/uxd/flows/0008-security-master.md` (modified)
  - `docs/uxd/flows/ui-scaffold-contract.json` (modified)
- **Intent:** Resolve governance finding F7 by updating UX artifacts from planned/placeholder wording to the implemented Security Master behavior.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — documented return context and route state; [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — documented implemented UI states; [ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — documented implemented list behaviors.
- **Verify:** `docs/uxd/flows/ui-scaffold-contract.json` parses and `git diff --check` is clean.
- **Notes:**
  - Removed planned/placeholder language; the placeholder section is now a historical note. Marked the delete-reference blocker resolved with `409 SECURITY_BLOCKED_BY_REFERENCES` and documented the T-03.7 loading, validation, empty-state, stale-response, and return-context behaviors.
  - Updated the scaffold entry status to `in-progress`, removed "Planned" from route descriptions, removed `placeholderBlocks`/`placeholderContract`, renamed `plannedWorkflow` to `workflow` with no code reads of the JSON, and added `emptyStates`, `createReturnContext`, `editLoading`, and `validationFeedback`.
  - Executed by a general-purpose agent because the `uxd` agent lacked edit tools. Verification passed: scaffold JSON parses and `git diff --check` is clean.

---

## E-04: Governance review

**Goal:** Verify the completed implementation remains aligned with the approved business, persistence, security, deletion, and UX contracts.

**Exit gate:** Governance reports no unresolved requirement/ADR drift, or records concrete follow-up risks before closeout.

**Depends on:** E-03

### T-04.1: Reviewing Security Master implementation alignment

- **Status:** done
- **Owner:** governance
- **Depends on:** T-02.3, T-03.5, T-03.6
- **Files:**
  - `docs/specs/0008-organization-security-master.md` (reference)
  - `docs/ADRs/0001-organization-aware-data-access.md` (reference)
  - `docs/ADRs/0016-restrict-deletion-of-referenced-securities.md` (reference)
  - `docs/ADRs/0017-standardize-data-grid-list-behaviors.md` (reference)
  - `packages/database/src/securityStore.ts` (review; `count`)
  - `docs/uxd/flows/0008-security-master.md` (reference)
  - `docs/uxd/flows/ui-scaffold-contract.json` (reference)
  - `packages/database/prisma/schema.prisma` and migration (review)
  - `apps/api/src/plugins/securityMaster.ts` (review)
  - `apps/frontend/src/SecurityMasterPage.tsx` and `apps/frontend/src/App.tsx` (review)
- **Intent:** Perform the repository's beginner's-mind governance review against the BRD, applicable ADRs, UX handoff, implementation plan, and actual diff. Report deviations and blockers; do not perform implementation changes.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — explicit tenant scoping; [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — safe referential deletion; [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md), and [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — route/UI behavior and implementation direction; [ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — grid layout, URL-owned filter defaults, row hover plus explicit action, distinct result states, and server-side organization-scoped count line.
- **Verify:** Governance review confirms each BRD acceptance criterion and ADR constraint against code/tests, or records each remaining discrepancy with affected task and owner.
- **Notes:** Earlier governance review planning/checks predate the approved Exchange combobox change; re-run governance after T-03.3 completes. _(appended by executing agent)_
  - Planner, 2026-09-26: Recheck these earlier non-blocking findings:
    - the stale planned-feature placeholder language in the UX flow and scaffold contract (`status: placeholder-only`, `placeholderContract`)
    - empty/no-match states and field-validation feedback
    - plan progress accuracy
  - Planner, 2026-09-26: Also assess these:
    - ADR 0017 status (`accepted`; user confirmation pending)
    - the missing cross-organization `totalCount` test noted on T-02.3
  - Governance review completed on 2026-09-26 with verdict **NOT ready for closeout**. Blocking findings: F1 edit form rendered before record loaded; F2 validation was not field-level and did not focus the first invalid field; F3 empty organization and filtered-zero results were not distinguished; F4 stale list responses could overwrite newer results; F5 store update write was scoped only by ID, violating ADR 0001. Non-blocking findings: F6 Add Security lacked `returnTo`; F7 UX docs still called the feature a placeholder; F8 plan notes were stale (T-02.3 cross-organization count claim and R-1). Remediation has since been implemented and verified by T-01.3, T-03.7, T-03.8, and the T-02.3/R-1 corrections; T-04.1's verification is satisfied by recording each discrepancy, and re-review is tracked by T-04.2.

### T-04.2: Re-reviewing Security Master alignment after remediation

- **Status:** done
- **Owner:** governance
- **Depends on:** T-01.3, T-02.3, T-03.5, T-03.6, T-03.7, T-03.8
- **Files:**
  - `docs/specs/0008-organization-security-master.md` (reference)
  - `docs/ADRs/0001-organization-aware-data-access.md` (reference)
  - `docs/ADRs/0002-url-addressable-routing-and-history-safe-navigation.md` (reference)
  - `docs/ADRs/0004-use-react-router-for-frontend-navigation.md` (reference)
  - `docs/ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md` (reference)
  - `docs/ADRs/0016-restrict-deletion-of-referenced-securities.md` (reference)
  - `docs/ADRs/0017-standardize-data-grid-list-behaviors.md` (reference)
  - `packages/database/src/securityStore.ts` (review)
  - `packages/database/src/securityStore.test.ts` (review)
  - `apps/api/src/plugins/securityMaster.ts` (review)
  - `apps/api/src/plugins/securityMaster.test.ts` (review)
  - `apps/frontend/src/SecurityMasterPage.tsx` (review)
  - `apps/frontend/src/apiClient.ts` (review)
  - `apps/frontend/src/SecurityMasterPage.test.tsx` (review)
  - `docs/uxd/flows/0008-security-master.md` (reference)
  - `docs/uxd/flows/ui-scaffold-contract.json` (reference)
- **Intent:** Confirm governance findings F1-F8 are resolved after remediation and no new BRD, ADR, UX, plan, API, persistence, or frontend drift was introduced.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) — organization-scoped persistence/API writes and reads; [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md), and [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — route/UI behavior and implementation direction; [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — safe referential deletion; [ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — implemented data-grid behavior, filter states, result states, and count line.
- **Verify:** Governance reports ready for closeout or records remaining discrepancies.
- **Notes:** Governance re-review completed on 2026-09-26 with verdict **ready with follow-ups**. It rechecked F1–F8 against the code, tests, UX docs, and plan, and all eight are resolved. All 11 BRD acceptance criteria pass; criterion 7 passes with the scope limit already tracked by R-4. No new blocking drift was found. The review was a read-only source review and relied on the recorded verification results.

  It raised two non-blocking follow-ups:
  - **N1:** the UX API-facing create contract still said Exchange could be "any user-entered string". Closeout corrected it in `docs/uxd/flows/0008-security-master.md`.
  - **N2:** `SecurityStore.update` scopes its write with `updateMany` and then re-reads the record separately. A concurrent write or delete between the two steps can return a different record than was written, or a false `not_found`. Tenant scoping is unaffected. Recorded as tech debt TD-015.

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | Resolved: canonicalization for symbol and exchange is recorded in T-01.1 and implemented in T-01.2, preserving user-entered display values while using normalized identity keys. | No remaining canonicalization drift risk for this phase. | database-design | none |
| R-4 | No current business table references securities, so blocked deletion cannot be exercised through a real dependent entity in the initial migration. | ADR 0016's future reference behavior needs store-level contract/test coverage now and actual FK coverage when the first dependent feature is added. | database-design, backend-coding | No blocker; prohibit speculative dependent tables and add real FK/test when such a feature is planned |
| R-5 | TD-003 leaves generated Prisma-client commit policy unresolved. | Generated output may create review noise or repository policy questions. | database-design | No blocker; follow existing generation and sync scripts and record whether generated diffs are expected |
| R-6 | Resolved: T-03.5 and T-03.6 verification completed successfully on 2026-09-26. | No remaining verification risk; test, typecheck, lint, build, and diff checks passed, and the user confirmed detail and count-line behavior. | frontend-coding | none |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-26 | Initial plan | Created from spec 0008, ADR 0016, and the Security Master UX flow. |
| 2026-09-26 | User deferred AI integration | Marked AI API and UI tasks cancelled for this phase; core scope uses manual free-text classifications only. |
| 2026-09-26 | T-01.1 completed | Recorded the approved organization-scoped Security persistence contract, canonical identity keys, blank-exchange uniqueness strategy, store outcomes, restrictive future-reference contract, and additive rollout notes. |
| 2026-09-26 | T-01.2 completed | Applied the security migration, generated the Prisma client, implemented and tested the organization-scoped store, and updated the verified schema documentation. |
| 2026-09-26 | Prior governance finding before T-03.1 | Clarified T-03.1's verification gate to require focused coverage for malformed, repeated, and unknown list query parameters and malformed, external-origin, and unsupported-path/parameter `returnTo` URLs, aligned to the Security Master UX flow. |
| 2026-09-26 | User changed Exchange entry to fixed dropdown | Updated the BRD and UX contract for a closed optional Exchange dropdown with blank, NYSE, NASDAQ, AMEX, LSE, TSX, and Other choices; appended T-03.4 for UI implementation, preserving completed task history and existing API/database contracts. |
| 2026-09-26 | T-03.1 completed | Delivered the typed Security Master frontend CRUD/lifecycle workflow, System navigation link, strict URL context validation, focused URL tests, and frontend verification. Governance task remains pending and was not started. |
| 2026-09-26 | Approved Exchange combobox UX follow-up | Added pending T-03.3 for the optional editable Exchange combobox on the existing Security Master form/list control; preserved string/null API and normalization behavior, excluded Exchange Master schema/API work, and moved governance dependency to follow the UI follow-up. |
| 2026-09-26 | T-03.3 completed | Added and verified the bounded editable Exchange combobox UX and focused accessibility/keyboard coverage; governance T-04.1 remains pending and was not started. |
| 2026-09-26 | T-03.4 completed | Replaced the editable Exchange combobox with the approved native fixed-choice select, including literal Other and legacy-value preservation; retained the existing string/null contract and completed frontend verification. |
| 2026-09-26 | Read-only detail presentation follow-up | Added T-03.5 for the requested single-column security details, line-break-preserving description, and bottom-positioned smaller timestamp metadata; governance now follows this UI refinement. |
| 2026-09-26 | Detail layout refinement | Updated T-03.5 and its BRD/UX contract to specify compact two-column label/value rows with subtle hover feedback, bold labels, preserved description line breaks, and bottom-positioned timestamp metadata. |
| 2026-09-26 | Edit return navigation | Updated the Security Master UX and T-03.5 to return edits to the read-only detail route on save or cancel, retaining the validated list context for subsequent navigation. |
| 2026-09-26 | Compact list filters and Exchange dropdown | Added T-03.6 and aligned the list search/filter row and Exchange filter control with the user's requested layout, preserving query/API behavior and legacy filter values. |
| 2026-09-26 | Planner documentation cleanup | Added a Cancelled column to the Progress table, so E-02 (2 done + T-02.2 cancelled) and E-03 (5 done + T-03.2 cancelled) are visibly complete, and moved the current effort to E-04. Appended T-02.3 (done, retroactive) to record the organization-scoped `totalCount` list API change made during T-03.6. Added ADR 0017 to Inputs, the Applicable ADRs table, and T-04.1. Corrected the stale "single-column" wording in the E-03 exit gate. Made T-04.1 depend on T-02.3 and listed the governance recheck items. |
| 2026-09-26 | T-03.5 and T-03.6 verification completed | Passed validation/database builds and tests, API checks, frontend tests/typecheck/lint/build, and `git diff --check`; recorded user confirmation of the detail view and list count line, resolved R-6, and set T-04.1 as next. |
| 2026-09-26 | Governance remediation recorded | Marked T-04.1 done with F1-F8 findings, added verified remediation tasks T-01.3, T-03.7, and T-03.8, added pending governance re-review T-04.2, corrected T-02.3's totalCount coverage note, resolved R-1, recorded ADR 0017 acceptance, and refreshed Progress counts. |
| 2026-09-26 | T-04.2 completed; closeout | Governance re-review resolved F1–F8 with verdict ready with follow-ups. Closeout fixed N1 in the UX flow, recorded N2 as TD-015, marked T-04.2 done and the plan `done` (all tasks done or cancelled), and queued the plan for archival to `docs/plans/closed/`. |
