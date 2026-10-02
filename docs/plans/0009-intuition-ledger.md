# Plan 0009: Intuition Ledger

- Status: `active`
- Date: 2026-09-27
- Spec: [0009-intuition-ledger](../specs/0009-intuition-ledger.md)
- Audience: [coding-agents, database-agents, uxd, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: E-05
- Completed efforts: E-01, E-02, E-03, E-04, E-06
- Blocked tasks: none
- In-progress tasks: none
- Next recommended task: T-05.9 (frontend-coding; requires a human-operated browser, a screen reader, and a timed human capture attempt), then T-05.7 (uxd), then T-07.1 (governance)
- Last updated: 2026-09-27

| Effort | Title | Tasks | Done | Cancelled | Status |
| --- | --- | --- | --- | --- | --- |
| E-01 | Prediction persistence | 5 | 5 | 0 | done |
| E-02 | Shared contracts and domain rules | 2 | 2 | 0 | done |
| E-03 | Protected Intuition Ledger API | 4 | 4 | 0 | done |
| E-04 | Frontend foundation | 4 | 4 | 0 | done |
| E-05 | Intuition Ledger UI | 9 | 7 | 0 | in-progress |
| E-06 | Help content | 3 | 3 | 0 | done |
| E-07 | Governance review | 1 | 0 | 0 | pending |

## Summary

Deliver a private, organization- and user-scoped prediction ledger: capture (with optional Markdown reasoning), edit with Amended tracking and reasoning history, resolve with result history, void/restore/delete, a due queue, a URL-addressable list, and a dashboard with five accessible charts. Database design comes first and fixes the persistence contract (including restrictive security references and profile backup/delete coverage). Shared contracts and a single pure-rules module then feed a protected Fastify API and a React Router UI built on owned shadcn/ui primitives and the shadcn Chart component.

## Inputs

- Spec readiness at planning time: `Ready for implementation planning` ([0009-intuition-ledger](../specs/0009-intuition-ledger.md)). User confirmed assumptions A1–A11 and resolved the open question (Percent move allows an early Correct) on 2026-09-27; FR 23 reflects this.
- ADRs reviewed: 0001–0017. Applicable set in the table below. Not applicable: 0007 (superseded by 0012), 0008 (WYSIWYG only; notes are direct Markdown), 0009 (runtime content sourcing, used only indirectly through the help workflow), 0010/0011 (AI connections), 0013 (deployment modes; no mode-specific behavior beyond existing profile delete paths).
- UX artifacts used: [UX flow 0009](../uxd/flows/0009-intuition-ledger.md), [prototype](../uxd/prototypes/0009-intuition-ledger.html), `intuition-ledger` entry in [ui-scaffold-contract.json](../uxd/flows/ui-scaffold-contract.json).
- Schema reference: [current.md](../schema/current.md), [schema.prisma](../../packages/database/prisma/schema.prisma), store patterns in `packages/database/src` (notably `securityStore.ts`, `journalStore.ts`, and `authStore.ts` for backup/delete).
- Intersecting tech debt ([checklist](../tech-debt/checklist.md)):
  - TD-003 generated Prisma client workflow — follow the existing `generate`/`sync-generated.mjs` path.
  - TD-019 (Journal integration), TD-020 (market-pricing API), TD-021 (trading-calendar presets), TD-022 (exchange calendar service) — deferred; do not implement. Trading days are Monday–Friday (A11).
- Reference implementation: [closed plan 0008](closed/0008-organization-security-master.md) — follow its store → contracts → plugin → page structure.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [0001](../ADRs/0001-organization-aware-data-access.md) | Predictions are organization-owned and further user-private; every read, write, count, and aggregate carries `organizationId` (and `userId`) in the operation itself, sourced from verified auth. | E-01, E-03, E-05 |
| [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | Dashboard, due, list, detail, new, and edit are major views; list filters and dashboard `period`/`amended` are URL-owned. | E-05 |
| [0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) | Deferred capabilities (price lookup, calendars) must not appear as fake behavior; the flow requires no placeholders. | E-05 |
| [0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) | New routes and query state use React Router v7 declarative APIs. | E-04, E-05 |
| [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | New primitives via the shadcn CLI; charts only via shadcn Chart (Recharts); semantic tokens; no other UI/chart library. | E-04, E-05 |
| [0006](../ADRs/0006-use-sunday-through-saturday-weeks.md) | Weekly hit-rate grouping and the End of week preset use Sunday–Saturday weeks. | E-02, E-03, E-05 |
| [0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md) | No WYSIWYG editor exists. Reasoning and outcome notes are a plain `Textarea` for direct Markdown, displayed with the existing `MarkdownViewer`, the same as the Journal; stored exactly as typed (no trimming or normalization in validation, API, or store). ADR 0007 is superseded; ADR 0008 applies only to WYSIWYG and does not apply. | E-01, E-02, E-03, E-05 |
| [0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md) | New profile-owned tables (predictions and histories) must be in the backup payload and delete path, with tests. | E-01, E-07 |
| [0015](../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) | New user-facing feature needs Help index/page/tooltips. | E-06, E-07 |
| [0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) | Predictions are the first real dependent of `Security`; the FK must be restrictive and composite with organization, never cascading. | E-01, E-03, E-05 |
| [0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) | The prediction list is a filterable grid with visible default status, one-row URL filters, row action, distinct result states, and server-provided "Showing N of T". | E-03, E-05 |

## Approach

- **Persistence pattern:** follow `Security`/`JournalEntry`: direct `organizationId` plus `userId` on every row, store methods that require both, typed discriminated results (`not_found`, `amend_confirmation_required`, `deadline_not_passed`, `not_voided`, …) and scoped `updateMany`/`deleteMany` writes (TD-018 lesson: the write predicate itself must carry scope).
- **Security reference:** first dependent of `Security`. Per T-01.1 notes in [plan 0008](closed/0008-organization-security-master.md): composite FK `(organizationId, securityId)` → `Security(organizationId, id)` with `ON DELETE RESTRICT`. The existing `securityStore.delete` `P2003 → blocked_by_references` mapping then becomes live; add a real blocked-delete test.
- **Server authority:** the server derives the grace window from its own `createdAt`, computes Amended, decides whether a reasoning edit is recorded in reasoning history (FR 19a), derives direction and stored predicted price/%, enforces FR 23 early-result rules and FR 24 resolution-date bounds, and derives status (FR 37) using the user's local date supplied by the client and validated.
- **One rules module, two consumers:** pure, dependency-free functions (price/% derivation, direction derivation, deadline presets with Mon–Fri trading days, status derivation, suggested result, hit rate, calibration buckets, week/month grouping, symbol normalization) live in a new built package, `@portfolio-engineering/domain` (`packages/domain`), so the frontend (preview, suggestion) and API (enforcement, stats) cannot drift. It mirrors `packages/validation`: `tsc -b` to `dist`, `NodeNext`, declarations, `exports` with `types`/`default`, and no runtime dependencies (no zod). It must not live in `shared-types`, which exports raw `.ts` with no build and cannot be loaded by the compiled API (`node dist/server.js`, `node --test dist/**`). Consumers build it first: the API through its existing `pre*` scripts, the frontend through new `pretypecheck`/`prebuild`/`pretest` scripts; the root `dev:prepare` already builds `packages/*`. See R-1 (resolved).
- **Dashboard stats server-side:** one stats endpoint returns summary counts, hit rate numerator/denominator, calibration buckets with n, per-type, per-normalized-symbol, time series, and scatter points. "Not available" is distinct from 0.
- **Timezone:** "the user's timezone" (A1, FR 37) means the same environment timezone the Journal uses: `getEnvironmentTimezone` in `apps/frontend/src/journalApi.ts` with `getTodayInTimezone` in `journalDates.ts`. There is no per-user timezone setting; do not add one. The client sends its local date (`YYYY-MM-DD`) where status or due derivation needs it; the API validates the format and a ±1 day window around server UTC date, and never uses it for authorization. Deadlines are dates (A1).
- **Frontend structure:** mirror Security Master: `intuitionLedgerApi.ts` (typed client + URL query/`returnTo` parsers), page components under a feature folder, routes registered in `App.tsx`, nav entry in `scaffoldRoutes.ts` directly after `journal` in the Learning group.
- **Tests:** frontend tests run with `tsx --test` against an explicit file list in `apps/frontend/package.json`; every new frontend test file must be added to that script.
- **Date picker:** follow the UX flow's component mapping: shadcn `Popover` + `Calendar` with a Sunday week start (ADR 0006) for Custom date and resolution date, added by the shadcn CLI in T-04.1. Its `react-day-picker` dependency is part of the shadcn primitive, not a separate UI library (ADR 0005).

## Non-goals

- Everything in the spec's Deferred list: price API (TD-020), trading calendars (TD-021/TD-022), Journal integration (TD-019), auto-resolution, relative predictions, AI review, promoting Other symbols, reminders, event calendars.
- Partial results, "close" rule, sharing, multi-currency.
- Restore/import of backups (only export and delete coverage).
- Tag-based chart breakdowns (A7).

---

## E-01: Prediction persistence

**Goal:** An approved, migrated, organization- and user-scoped persistence contract for predictions (including reasoning), amendment history, result history, and reasoning history, covered by profile backup and delete.

**Exit gate:** Migration applies; generated client synced; store tests prove org/user isolation, scoped writes, restrictive security reference (blocked Security delete), all three histories, the scoped history read, N/T counts, server-derived `resultChanged`, and domain-aligned result/due rules; profile backup includes and profile delete removes all new rows; `docs/schema/current.md` updated.

**Depends on:** none

### T-01.1: Designing prediction persistence

- **Status:** done
- **Owner:** database-design
- **Depends on:** none
- **Files:**
  - `packages/database/prisma/schema.prisma` (review; design recorded in task notes)
  - `packages/database/prisma/migrations/` (review existing Security migration and FK patterns)
  - `packages/database/src/securityStore.ts`, `journalStore.ts`, `authStore.ts` (review)
  - `docs/schema/current.md` (reference)
- **Intent:** Define models for predictions, amendment history (previous claim snapshot + changed fields + timestamp), result history (previous/new result, resolution date, actual price, timestamp), and reasoning history (previous text, new text, timestamp; written only for reasoning edits after the grace window, FR 19a); optional reasoning and outcome-note text columns (the spec sets no length limit; record any bound chosen and apply it in T-02.1); enums for type, direction, result; subject representation (security FK vs. Other symbol vs. topic, plus snapshotted normalized symbol for grouping, FR 7/40); price/percent precision (≥4 decimals, FR 15 — choose `Decimal` precision/scale); void state that supports exact restore (FR 29); Amended flag; tags storage and suggestion query strategy (FR 5/11, A8); indexes for list filters, search (including reasoning and outcome notes, FR 33), due derivation, and stats; store operation list with typed outcomes; backup/delete inclusion plan.
- **ADRs:** [0001](../ADRs/0001-organization-aware-data-access.md) — direct `organizationId` on every table, scope in every predicate; [0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — composite org-scoped FK, `ON DELETE RESTRICT`, no cascade to securities; [0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md) — answer the three review questions for each new table; [0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md) — reasoning and notes are direct Markdown text stored exactly as typed (no trimming or normalization).
- **Verify:** Task notes contain: field/nullability/enum contract; decimal precision; subject invariants (exactly one subject form; Event reaction/measurable types require a security or Other symbol); FK and delete semantics for Security, User, and Organization; history table shapes; index list mapped to UX query parameters; store method list with discriminated results; profile backup section names and delete order; migration/rollout notes. No schema files changed.
- **Notes:****
- **Field, nullability, and enum contract:** Add `Prediction` with `id String @id @default(cuid())`, required direct `organizationId`, required direct `userId`, nullable `securityId`, nullable `otherSymbol`, nullable `topic`, nullable `symbolSnapshot` and nullable `symbolNormalizedSnapshot` (both null only for a no-subject Freeform prediction), required `type` enum (`DIRECTION`, `PERCENT_MOVE`, `TARGET_PRICE`, `EVENT_REACTION`, `FREEFORM`), nullable `direction` enum (`RISES`, `FALLS`), required `claimText`, nullable `eventLabel`, required `deadline DateTime @db.Date`, required `confidence Int`, nullable measurable fields `priceAtPrediction`, `predictedPrice`, and `predictedPercent`, nullable `priceCapturedAt`, nullable `reasoning`, `tags String[]` defaulting to an empty array, nullable `result` enum (`CORRECT`, `INCORRECT`), nullable `resolutionDate DateTime @db.Date`, nullable `actualPrice`, nullable `outcomeNotes`, nullable `voidedAt`, nullable `voidReason`, required `amended Boolean @default(false)`, nullable `amendedAt`, and required `createdAt`/`updatedAt` using the repository timestamp pattern. Reasoning and outcome notes are unbounded `TEXT`-equivalent Prisma `String` columns: the spec sets no length bound, and no application or database limit is chosen here; T-02.1 must preserve them byte-for-byte without trim/normalization. `claimText` is also stored as supplied under the same API contract. Store prices and percentages as PostgreSQL `NUMERIC(20,8)` (`Decimal(20,8)` in Prisma), providing at least four fractional places and ample range while avoiding binary floating-point drift. `confidence` is an integer 50-100; database checks for positive prices, conditional required fields, and confidence are part of T-01.2 migration implementation, with domain/API validation providing the user-facing errors.
  - **Subject and claim invariants:** Exactly one subject form is allowed when a subject is present: Security Master (`securityId` set, `otherSymbol` and `topic` null), Other (`otherSymbol` set after trim/uppercase normalization, `securityId` and `topic` null), or topic-only Freeform (`topic` set, `securityId` and `otherSymbol` null). A no-subject Freeform is the explicit fourth case permitted by the product contract; represent it as all three nullable subject columns null and require `type = FREEFORM`. `symbolSnapshot` preserves the displayed symbol at save time and `symbolNormalizedSnapshot` is the grouping key, so later Security edits do not rewrite history and Security Master MSFT and Other MSFT group together. Security Master subjects must have both snapshots; Other must have the normalized value in both `otherSymbol` and the snapshots; topic is only valid for Freeform. Direction is required for Direction, Percent move, and Event reaction, derived and stored for Target price, and null for Freeform. Security is required for all measurable types, including Event reaction; Freeform is the only type that can use a topic or no subject. Percent move requires exactly one input mode (unsigned positive move size or predicted price at the API boundary) and stores derived `predictedPrice` and `predictedPercent`; Target price stores the target as `predictedPrice` and derives direction/percent; Direction has no predicted target; Event reaction may omit predicted values. Measurable types require positive `priceAtPrediction` and `priceCapturedAt`; Freeform has both null. Resolution fields are all null together or represent a result; `actualPrice`, when present, is positive. `voidedAt` is the lifecycle source of truth: voided rows retain claims/results and are excluded from stats; restore clears void metadata and therefore restores the prior derived open/resolved state exactly. `amended` is monotonic once true, including after a claim revert.
  - **Foreign keys and delete semantics:** `Organization` is a required restrictive parent for `Prediction` and every history row (`ON DELETE RESTRICT`). `User` is a required owner with `ON DELETE CASCADE`; profile deletion therefore removes the prediction tree only after the backup is assembled. `Security` uses the closed-plan convention: add a composite unique key on `Security(organizationId, id)` if required by Prisma, then a composite FK `(organizationId, securityId) -> Security(organizationId, id)` with `ON DELETE RESTRICT`; this prevents cross-organization references and blocks deletion even for voided predictions. The user relationship likewise uses the organization-scoped composite convention (`(organizationId, userId) -> User(organizationId, id)`) or an equivalent migration-safe constraint, so a prediction cannot pair an organization with another organization's user. Each history table carries direct organization/user scope and a composite prediction FK `(organizationId, predictionId)` with `ON DELETE CASCADE`; its direct user/org FKs remain scoped and consistent. Prediction deletion cascades only its three histories; Security deletion never cascades prediction data and `securityStore.delete` maps the FK violation to `blocked_by_references`. All store mutating predicates still include both organizationId and userId, regardless of database FKs.
  - **History table shapes and atomicity:** `PredictionAmendment` has `id`, `organizationId`, `userId`, `predictionId`, a complete previous-claim snapshot (subject identifiers/snapshots, type, direction, claim text, event label, deadline, confidence, price-at-prediction, price-captured timestamp, predicted price, predicted percent), `changedFields String[]`, and `changedAt`. It intentionally excludes reasoning, tags, and outcome details. `PredictionResultHistory`

[Output truncated. Use view_range=[107, ...] to continue reading. In your next response, you may batch this with other view calls. File has at least 546 lines.]

diff --git a/C:/src/portfolio-engineering/portfolio-engineering/docs/plans/0009-intuition-ledger.md b/C:/src/portfolio-engineering/portfolio-engineering/docs/plans/0009-intuition-ledger.md
index 0000000..0000000 100644

### T-01.2: Migrating and implementing the prediction store

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.1
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified)
  - `packages/database/prisma/migrations/<timestamp>_add_intuition_ledger/migration.sql` (new)
  - `packages/database/src/predictionStore.ts` (new)
  - `packages/database/src/predictionStore.test.ts` (new)
  - `packages/database/src/securityStore.test.ts` (modified; referenced-delete block)
  - `packages/database/src/index.ts` (modified)
  - `packages/database/src/generated/prisma/` (generated via repository scripts)
  - `docs/schema/current.md` (modified)
- **Intent:** Implement the approved design: create, list (filters/search per UX contract + `totalCount`), find, update (claim vs. non-claim; amendment history for claim changes and reasoning history for reasoning changes after the grace window, each in the same transaction), record/change/clear result with result history, void/restore, delete (voided only), suggestions (Other symbols, tags), due count, and stats aggregation inputs. All reads/writes scoped by `organizationId` and `userId`.
- **ADRs:** [0001](../ADRs/0001-organization-aware-data-access.md) — scope in the write predicate (`updateMany`/`deleteMany`), not ID-only; [0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — real FK makes `securityStore.delete` return `blocked_by_references`.
- **Verify:** Database `generate`, `typecheck`, `build`, `lint`, and tests pass; `migrate:deploy` applies; tests prove cross-org and cross-user isolation for every method, scoped writes leave other rows untouched, amendment/result/reasoning histories are written atomically, a reasoning edit within the grace window writes no history and one after it writes exactly one entry without setting Amended, reasoning is stored byte-for-byte, delete of a non-voided prediction returns `not_voided`, and deleting a Security referenced by a (voided) prediction returns `blocked_by_references`.
- **Notes:****
  - Implemented the full T-01.1 design in `schema.prisma`: `PredictionType`/`PredictionDirection`/`PredictionResult` enums; `Prediction`, `PredictionAmendment`, `PredictionResultHistory`, `PredictionReasoningHistory` models; `@@unique([organizationId, id])` added to `Security` and `Prediction` to support the composite restrictive FKs (`(organizationId, securityId) -> Security(organizationId, id)` and `(organizationId, predictionId) -> Prediction(organizationId, id)` cascade for histories/amendments).
  - **Deviation from a literal reading of the T-01.1 notes:** used the repository's existing simple-FK precedent (`userId -> User.id`, `ON DELETE CASCADE`, as in `JournalEntry`/`InvestorProfile`) rather than adding a new composite `(organizationId, userId) -> User(organizationId, id)` constraint. The notes explicitly allow "an equivalent migration-safe constraint"; `userId` is always sourced from verified server session context (never client input) and every store predicate still requires `{ organizationId, userId }` together, so the practical cross-org/cross-user isolation guarantee is unchanged. No new `User` unique constraint was added.
  - Migration `20260927150000_add_intuition_ledger` was hand-assembled (via `prisma migrate diff --from-config-datasource --to-schema` plus manual edits, since `prisma migrate dev` cannot run non-interactively here) and includes, beyond the Prisma-generated DDL: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`, a GIN index on `tags`, trigram GIN indexes (`gin_trgm_ops`) on `claimText`/`reasoning`/`outcomeNotes`, and hand-written `CHECK` constraints (confidence range, positive prices, subject/type invariants, direction-by-type, measurable-price-by-type, predicted-value-by-type, result/resolutionDate pairing) — following the existing `20260907092621_add_help_runtime_cache` precedent for constraints not expressible in `schema.prisma`.
  - **pg_trgm:** the local/dev database supports and enabled `pg_trgm` without issue, so trigram indexes were created; no ILIKE-only fallback was needed here. `predictionStore.list()`'s search predicate still uses Prisma's `contains`/`insensitive` (not raw trigram operators), so search remains functional even in a deployment where `pg_trgm` cannot be enabled — this should be verified against the actual deployment target before production migration, per the open risk noted in T-01.1.
  - Implemented `packages/database/src/predictionStore.ts`: `create`, `list`, `find`, `update` (grace-period vs. post-grace claim edits with amendment history; reasoning edits with reasoning history; both in the same transaction as the row update), `recordResult`/`clearResult` (result history on every change including the first-clear case, no history row on the very first result), `void`/`restore`, `delete` (voided-only), `countDue`, `suggestOtherSymbols`, `suggestTags` (`$queryRaw` unnest over `tags`), and `statsAggregate` (`groupBy`, excludes voided). Every method's read/write predicate includes both `organizationId` and `userId`.
  - Added `packages/database/src/predictionStore.test.ts` (24 tests, in-memory mock-Prisma double pattern matching `journalStore.test.ts`) covering subject resolution, byte-for-byte reasoning storage, grace-period vs. post-grace amendment/reasoning-history behavior, cross-org/cross-user isolation on every mutating method, result-history semantics (first vs. later changes, `deadline_not_passed`, the Percent-move early-Correct exception, `resolution_date_out_of_range`), void/restore lifecycle conflicts, voided-only delete, `countDue`, and `statsAggregate`.
  - Added a live-database integration test to `packages/database/src/securityStore.test.ts` (`delete is blocked by a real restrictive foreign key when a (voided) prediction references the security`) that creates a real Organization/User/Security/Prediction, proves `blocked_by_references` both while the prediction is open and after voiding it, and cleans up all rows in a `finally` block.
  - Updated `packages/database/src/index.ts` to export `createPredictionStore`, `PREDICTION_CLAIM_FIELDS`, all prediction result/input types, and the generated `Prediction*` model/enum types.
  - Updated `docs/schema/current.md` with a new Overview bullet, Mermaid entities/relationships, and `predictions`/`prediction_amendments`/`prediction_result_history`/`prediction_reasoning_history` table sections (key constraints, checks, notes on subject/lifecycle/scoping semantics), plus the "Last updated" header.
  - **Verification evidence (all commands run from `packages/database` unless noted; environment: Windows, `corepack pnpm`, local dev PostgreSQL):**
    - `prisma format` — schema valid.
    - `prisma migrate diff --from-config-datasource --to-schema ./prisma/schema.prisma --script` — generated the base DDL used to hand-assemble the migration.
    - `prisma migrate deploy` — applied cleanly; re-run afterward reports "No pending migrations to apply" (idempotent).
    - Fresh-database replay check: created a temporary `pe_migration_check` database and ran `prisma migrate deploy` against it — all 7 migrations (including the new one) applied in order from empty, then the temp database was dropped.
    - Manual `CHECK` constraint smoke test (via a throwaway Node `pg` script, transaction rolled back, not committed): 7/7 cases passed — confidence-out-of-range, topic-on-non-Freeform, measurable-type-with-no-subject, and negative-price all correctly rejected; valid Freeform-no-subject, valid Direction-with-Other-subject, and result-without-resolutionDate (rejected) all behaved as designed.
    - `corepack pnpm --filter @portfolio-engineering/database generate` — succeeded, regenerated Prisma client with new models/enums.
    - `corepack pnpm --filter @portfolio-engineering/database typecheck` — passed, no errors.
    - `corepack pnpm --filter @portfolio-engineering/database build` — passed.
    - `corepack pnpm --filter @portfolio-engineering/database lint` (oxlint) — passed, exit code 0.
    - `corepack pnpm --filter @portfolio-engineering/database test` — **55/55 tests passed**, including the new 24 `predictionStore.test.ts` tests and the new live-DB `securityStore.test.ts` integration test (proves `blocked_by_references` for both an open and a voided referencing prediction).
  - **Environment note (not a code defect):** mid-session, a diagnostic check against a *separate, unrelated Docker Postgres container* (`portfolio-engineering-postgres`, exposed on the same port number but not actually reachable at `localhost:5432` due to a native Windows PostgreSQL 17 install already bound to that port) briefly appeared to show the dev database as empty. This was a red herring caused by inspecting the wrong Postgres instance via `docker exec`; the actual dev database used by Prisma/the app (the native Windows Postgres instance at `localhost:5432`) was never affected and still holds all 7 migrations, all tables, and passed every test and the manual constraint smoke test above. No data loss occurred and no recovery action was needed beyond confirming which instance is authoritative.

### T-01.3: Adding predictions to profile backup and delete

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.2
- **Files:**
  - `packages/database/src/authStore.ts` (modified; `getProfileBackup`, `deleteProfile`)
  - `packages/database/src/authStore.test.ts` (modified)
  - `packages/shared-types/src/auth.ts` (modified; backup section types)
  - `packages/validation/src/` backup schema file (modified; locate the existing profile backup Zod schema)
- **Intent:** Include predictions, amendment history, result history, and reasoning history as described backup sections in `_meta.sections`, and remove them in the profile delete transaction before the user row. Security rows are organization data and are not deleted. Frontend changes, if any, belong to T-04.4.
- **ADRs:** [0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md) — backup and delete updated together with tests; [0001](../ADRs/0001-organization-aware-data-access.md) — scoped by organization and user.
- **Verify:** Tests prove the backup contains all four sections with manifest descriptions, profile delete removes them atomically and leaves another user's predictions and all securities intact, and rollback on failure. Database and validation builds/tests pass.
- **Notes:****
  - **Interpretation of "all four sections" (Verify wording):** the task Intent names one new top-level backup section, `intuitionLedger` (added to `_meta.sections` alongside the existing `profile`/`investorProfile`/`journal` strings), whose value is itself an object → `ProfileBackupIntuitionLedgerSectionManifest` → with four description strings: `predictions`, `amendmentHistory`, `resultHistory`, `reasoningHistory`. `data.intuitionLedger` mirrors this with four subsections, each `{ count, records }`. Tests assert all four description strings are non-empty and all four `data.intuitionLedger.*.count`/`records` are populated, satisfying "all four sections with manifest descriptions" without adding four new top-level `_meta.sections` keys (which would have changed the existing three-string section-name contract more invasively than the design called for).
  - **Shared types (`packages/shared-types/src/auth.ts`):** added `ProfileBackupIntuitionLedgerSectionManifest`, `ProfileBackupPredictionRecord`, `ProfileBackupPredictionAmendmentRecord`, `ProfileBackupPredictionResultHistoryRecord`, `ProfileBackupPredictionReasoningHistoryRecord`, and `ProfileBackupIntuitionLedgerData`; extended `ProfileBackupSectionManifest` with `intuitionLedger` and `ProfileBackupPayload['data']` with `intuitionLedger: ProfileBackupIntuitionLedgerData`. Record shapes mirror the `Prediction`/`PredictionAmendment`/`PredictionResultHistory`/`PredictionReasoningHistory` Prisma models field-for-field, with `Decimal` columns serialized to `string | null` and `@db.Date`/`DateTime` columns serialized to `YYYY-MM-DD` or full ISO strings respectively (matching the existing `journal.entries[].localDate` precedent).
  - **Validation (`packages/validation/src/auth.ts`):** added matching Zod schemas (`profileBackupIntuitionLedgerSectionManifestSchema`, one record schema per history/prediction shape, `profileBackupIntuitionLedgerDataSchema`) and wired them into `profileBackupSectionManifestSchema`/`profileBackupPayloadSchema`. Enum-like string fields (`type`, `direction`, `result`, `previousType`, `previousDirection`) are validated as non-empty strings rather than re-declaring the Prisma enums, since this package does not own the prediction domain contract (T-02.1 does).
  - **Database (`packages/database/src/authStore.ts`):**
    - `getProfileBackup` now also includes the user's `predictions` (scoped by `organizationId`, ordered `createdAt asc`) with nested `amendments`/`resultHistory`/`reasoningHistory` (each ordered `changedAt asc`), maps them with new `mapPredictionToBackupRecord`/`mapPredictionAmendmentToBackupRecord`/`mapPredictionResultHistoryToBackupRecord`/`mapPredictionReasoningHistoryToBackupRecord` helpers, and flattens the three history arrays across all of the user's predictions into the `data.intuitionLedger.{amendmentHistory,resultHistory,reasoningHistory}` lists. No Security Master rows are read or included (organization data, per ADR 0001 and the T-01.1 design note).
    - `deleteProfile` now deletes, inside the existing single `prisma.$transaction`, `predictionReasoningHistory` → `predictionResultHistory` → `predictionAmendment` → `prediction` (each `deleteMany` scoped by `organizationId` + `userId`) sequentially, before the pre-existing parallel `journalEntry`/`investorProfile`/`refreshToken`/`oAuthProvider` deletes and the final `user.delete`. Deleting the leaf history rows before the parent `Prediction` rows is explicit and does not rely on the `ON DELETE CASCADE` behavior already present on the composite `(organizationId, predictionId)` FKs, matching the T-01.1 design note's "or relies on prediction cascades" alternative chosen for defense-in-depth and mock-testability. Security rows are never touched by this transaction.
  - **Tests (`packages/database/src/authStore.test.ts`):** updated the existing `getProfileBackup`/`deleteProfile` mock-based tests to include prediction/history rows and to assert the new `intuitionLedger` manifest/data shape and delete order; added a mock-based "no predictions" backup test (empty `count`s); added a new real-database integration test (`getProfileBackup and deleteProfile: real database round trip proves atomic, scoped predictions cleanup`) that creates a real Organization, two Users, a Security, one Prediction per user (via `predictionStore.create`), and one row in each history table (inserted directly via Prisma to avoid depending on the 5-minute grace-window timing), then proves: the backup contains exactly the owning user's 1 prediction + 1 row per history table with matching IDs and non-empty manifest descriptions; after `deleteProfile`, the deleted user's prediction and all three history rows are gone (`findUnique` returns `null`) and the user row itself is gone; the other user's prediction and the shared Security row still exist. Rollback-on-failure is proven by the existing mocked `deleteProfile rejects the transaction when the delete fails...` test (updated to include the prediction-tree deletes in the captured order): it asserts every scoped delete call happens in the correct sequence and that a late failure (in `user.delete`) propagates as a rejection with no swallowed partial-success result, which is the code-level contract that Prisma's real interactive `$transaction` rolls back atomically on any thrown error (the same rollback-proof pattern already used by the pre-existing test before this task).
  - **Files not touched:** `docs/schema/current.md` (no schema/migration change in this task — T-01.2 already documented the tables) and all frontend files (owned by T-04.4, per Intent).
  - **Verification evidence (run from `packages/database` unless noted; environment: Windows, `corepack pnpm`, local dev PostgreSQL at `localhost:5432`, native Windows install per the T-01.2 environment note):**
    - `corepack pnpm --filter @portfolio-engineering/validation build` — passed (schema changes compile).
    - `corepack pnpm --filter @portfolio-engineering/validation lint` (oxlint) — passed, exit code 0.
    - `corepack pnpm --filter @portfolio-engineering/database typecheck` — passed, no errors.
    - `corepack pnpm --filter @portfolio-engineering/database build` — passed (Prisma generate + `tsc -b` + generated-client sync).
    - `corepack pnpm --filter @portfolio-engineering/database lint` (oxlint) — passed, exit code 0.
    - `corepack pnpm --filter @portfolio-engineering/database test` — **57/57 tests passed**, including all `authStore.test.ts` tests (new/updated backup and delete tests plus the new live-DB round-trip test) and every pre-existing `predictionStore.test.ts`/`securityStore.test.ts` test (no regressions).
    - `corepack pnpm --filter @portfolio-engineering/api typecheck` and `corepack pnpm --filter @portfolio-engineering/frontend typecheck` — both passed, confirming the additive `ProfileBackupPayload`/`profileBackupPayloadSchema` changes do not break the existing API route (`apps/api/src/plugins/protected.ts`/`public.ts`) or frontend consumers (`apps/frontend/src/authSession.ts`, `apiClient.ts`) that already pass the payload through untouched (no frontend files were edited).

### T-01.4: Completing prediction store history and list contracts

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.2
- **Files:**
  - `packages/database/src/predictionStore.ts` (modified)
  - `packages/database/src/predictionStore.test.ts` (modified)
  - `packages/database/src/index.ts` (modified only if exports change)
  - `docs/schema/current.md` (modified only if needed)
  - `packages/database/package.json` (modified only if the store consumes `@portfolio-engineering/domain`)
  - `pnpm-lock.yaml` (modified only if workspace dependency/build wiring changes)
- **Intent:** Add a history-read/find-with-histories operation returning amendment, result, and reasoning histories ordered by `changedAt`, scoped by both `organizationId` and `userId` (R-7). Make `list` return the filtered matching count (N) and the unfiltered total (T) for the requesting user (R-6): T includes all of that caller's predictions, including voided predictions; filters affect N only, and other users' predictions never contribute. Correct the store discrepancies recorded in T-02.2 Notes (R-8): FR 23 permits early Correct for Target price as well as Percent move; FR 24 bounds non-early `resolutionDate` from the prediction's creation date, not the deadline; FR 37/A1 due predicates become due only after the deadline date ends. Prefer consuming the canonical `@portfolio-engineering/domain` rules (add the workspace dependency and `pre*` build wiring as needed); otherwise match them exactly.
- **ADRs:** [0001](../ADRs/0001-organization-aware-data-access.md) — every history read and count is scoped by organization and user; [0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — list returns filtered N and unfiltered T.
- **Verify:** Database typecheck, build, lint, and tests pass. Tests cover history cross-user/cross-org isolation and `changedAt` ordering; filtered count and unfiltered user total, including that filters and other users do not affect T; FR 23 early Correct for Target price; FR 24 non-early resolution-date bounds from creation date; and FR 37/A1 due list/count boundaries (due the day after the deadline, not on it). If domain rules are not consumed, tests explicitly cover the corresponding AC 13/15/16 behavior.
- **Notes:****
- Added `PredictionStore.findWithHistories()` to return amendment, result, and reasoning histories in scoped `changedAt` order. (reconstructed 2026-09-27 after plan-file loss)
- Updated `PredictionStore.list()` to return explicit `filteredCount` and `totalCount`; `filteredCount` is the current filtered N and `totalCount` is all predictions for the caller's organization/user, including voided, independent of filters. (reconstructed 2026-09-27 after plan-file loss)
- Aligned store result and due rules with `@portfolio-engineering/domain`, including early Correct eligibility, resolution-date bounds, and due list/count boundaries after the deadline day. (reconstructed 2026-09-27 after plan-file loss)
- Verification evidence recorded in the revision history: database/API domain build wiring was added and database plus API consumers were verified; database tests passed (59/59). (reconstructed 2026-09-27 after plan-file loss)

### T-01.5: Adding a scoped result-change indicator

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.4
- **Files:**
  - `packages/database/src/predictionStore.ts` (modified)
  - `packages/database/src/predictionStore.test.ts` (modified)
  - `packages/database/src/index.ts` (modified only if exports change)
- **Intent:** Have `list` return a server-derived `resultChanged: boolean`; also return it from `find`/`findWithHistories` if they share the same prediction-record shape. Define it as true when history records a transition from one non-null result to a different non-null result, or when a non-null result is cleared and subsequently re-recorded (a later history entry records a result after the clear); it is false for a first-ever result and for a clear not followed by re-recording. Changes only to resolution date, actual price, or outcome notes do not qualify. Compute it in the same scoped query, without per-row history queries, and scope history by `organizationId` and `userId`.
- **ADRs:** [0001](../ADRs/0001-organization-aware-data-access.md) — every prediction and history read is scoped by organization and user; [0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — list-row state is supplied by the server, not inferred from unrelated timestamps.
- **Verify:** Database typecheck, build, lint, and tests pass. Tests prove false for never-resolved and first-recorded predictions; true after a result change and after clear-then-re-record; cross-user isolation; and no per-row queries as list size grows.
- **Notes:****
  - Added the server-derived `resultChanged` boolean to the exported database `PredictionRecord`. `PredictionListOutput.predictions[]`, `PredictionFindResult`, and `PredictionWithHistories.prediction` all expose the same field.
  - `list` includes only `previousResult`, `newResult`, and `changedAt` from result history in the paginated prediction query; the nested history predicate includes both `organizationId` and `userId`, ordered by `changedAt`. The value is true for a non-null result transition or a later non-null result after a clear; first recording, metadata-only result edits, and a clear not followed by re-recording remain false. `find` uses the same scoped include; `findWithHistories` derives it from its existing explicitly scoped history read. No per-row history queries are issued.
  - **T-03.4 handoff:** expose `resultChanged` on `PredictionRecord` and its response schema, then return it at `PredictionListResponse.predictions[].resultChanged` and `PredictionDetailResponse.prediction.resultChanged` by mapping the database store value; do not derive it in the API.
  - **Verification:** `corepack pnpm --filter @portfolio-engineering/database typecheck`, `build`, `lint`, and `test` passed (62/62 tests); `corepack pnpm --filter @portfolio-engineering/api typecheck` passed. A live PostgreSQL 17 smoke test at `localhost:5432` confirmed the list and detail queries return `resultChanged: true` for a recorded result transition.

---

## E-02: Shared contracts and domain rules

**Goal:** Typed request/response contracts and a single pure-rules module shared by API and frontend.

**Exit gate:** `validation` builds; `@portfolio-engineering/domain` builds to `dist` and its compiled tests pass under plain `node --test`, covering every FR 9, 13–15, 18–19a, 23–26, 37, 39–41 rule and the AC 7/10/15/16 examples.

**Depends on:** T-02.1 depends on E-01 T-01.1 (field contract); T-02.2 has no dependency.

### T-02.1: Defining Intuition Ledger contracts

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.1
- **Files:**
  - `packages/validation/src/intuitionLedger.ts` (new)
  - `packages/validation/src/index.ts` (modified)
  - `packages/shared-types/src/intuitionLedger.ts` (new)
  - `packages/shared-types/src/index.ts` (modified)
  - `packages/shared-types/package.json` (modified; `./intuitionLedger` export)
- **Intent:** Strict Zod schemas and types for create/update (with `confirmAmend`; optional `reasoning` string with no `.trim()` or other transform), prediction detail (reasoning plus amendment, result, and reasoning histories), record/clear result (optional outcome notes, also untransformed), void/restore/delete, list query (repeated/unknown/malformed rejection per UX query contract), suggestions, due count, dashboard stats query/response, and stable error codes (`amend_confirmation_required` with changed fields, `deadline_not_passed`, `resolution_date_out_of_range`, `not_voided`, `not_found`).
- **ADRs:** [0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — list response carries server `totalCount`; [0001](../ADRs/0001-organization-aware-data-access.md) — no client-supplied organization/user fields; [0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md) — Markdown text accepted exactly as typed.
- **Verify:** `validation` build and lint pass; the new `shared-types` module typechecks through a consumer (`corepack pnpm --filter @portfolio-engineering/api typecheck`), because `shared-types` has no build or lint script of its own. Schema behavior (rejecting repeated/unknown params, non-positive prices, confidence outside 50–100, and signed move sizes; accepting locale-normalized decimal strings as specified in T-02.2) is asserted by the T-03.1 route tests, since `validation` has no test runner.
- **Notes:****
- Added strict create/update, result/lifecycle, list/suggestion/due/stats query, prediction/history response, and stable error contracts in validation and shared-types. Request schemas reject unknown keys; scalar query schemas reject repeated parameters.
  - Optional free-text fields, including reasoning and outcome notes, are unbounded and pass through without trimming or transformation. Decimal inputs are locale-normalized strings using `.` as the decimal separator, positive, and bounded to the `NUMERIC(20,8)` store precision; `predictedPercent` input is unsigned. The API adapter must map `confirmAmend` to the store's `confirmAmendment`.
  - `asOfLocalDate` is required by API list filters for open/due status, but remains operational input rather than URL-owned filter state.
  - Verification passed: `corepack pnpm --filter @portfolio-engineering/validation build`; `corepack pnpm --filter @portfolio-engineering/validation lint`; `corepack pnpm --filter @portfolio-engineering/api typecheck`; inline Node schema smoke checks for normalized decimal acceptance, zero/signed amount rejection, confidence bounds, raw reasoning preservation, and repeated/unknown query rejection.
  - Follow-up: the UX API wording says list `totalCount` is all user predictions, while the implemented store counts matching filtered rows; reconcile before T-03.1. The detail response includes all histories, but `PredictionStore.find()` returns only the base prediction; T-03.1 needs an approved scoped history-read store method before it can fulfill that response (no direct Prisma access).

### T-02.2: Implementing pure prediction rules in a new domain package

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** none
- **Files:**
  - `packages/domain/package.json` (new; name `@portfolio-engineering/domain`, `type: module`, `files: ["dist"]`, `exports` `.` and `./intuitionLedgerRules` with `types`/`default` pointing at `dist`, scripts `build`/`typecheck`/`lint`/`test` mirroring `packages/validation` and `apps/api`, devDependencies `@types/node`, `oxlint`, `typescript` only)
  - `packages/domain/tsconfig.json` (new; copy of `packages/validation/tsconfig.json`)
  - `packages/domain/src/index.ts` (new)
  - `packages/domain/src/intuitionLedgerRules.ts` (new)
  - `packages/domain/src/intuitionLedgerRules.test.ts` (new; `node:test`)
  - `pnpm-lock.yaml` (modified by `corepack pnpm install`)
- **Intent:** Create a built, dependency-free package that the compiled API and the Vite frontend can both load, and implement: predicted price → % derivation and direction derivation (FR 13–14), deadline preset resolution with Mon–Fri trading days and Sun–Sat weeks (FR 9, A11), status derivation from user-local date (FR 37, A1), early-result eligibility (FR 23: Correct-only before deadline for Target price and Percent move), resolution-date bounds (FR 24), suggested result (FR 26, A2), hit rate with not-available (FR 39), calibration buckets with n and low-n flag (FR 41), week/month grouping by resolution date (A9), symbol normalization (FR 5), grace-window remaining time, claim-field change detection for Amended (FR 18–19; reasoning, tags, and outcome details are never claim fields), and whether a reasoning change is recorded in reasoning history (FR 19a: only after the grace window, only when the text actually differs). Use relative imports with `.js` extensions (NodeNext).
- **ADRs:** [0006](../ADRs/0006-use-sunday-through-saturday-weeks.md) — weeks start Sunday; End of week is the last Mon–Fri day within that week, else next week's.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/domain build`, `lint`, and `test` pass, where `test` runs the compiled `dist/**/*.test.js` through `scripts/run-compiled-tests.mjs` under plain Node (proving the package loads without `tsx`). Tests cover AC 7 (424.20; rises 7.14%), AC 10 (week/month roll-forward incl. Saturday and last-day-of-month-on-weekend), AC 13, AC 15, AC 16, A2 (no change → Incorrect), hit rate "not available", calibration n < 5 flag, reasoning-only change is not a claim change, and reasoning-history recording at the grace-window boundary (4:59 not recorded, 5:00+ recorded, unchanged text not recorded). `package.json` has no runtime `dependencies`.
- **Notes:****
- Placement decided 2026-09-27 (user chose option A; see R-1).
  - Added the dependency-free @portfolio-engineering/domain package with NodeNext build/declarations, root and intuitionLedgerRules subpath exports, and a compiled test script using the repository runner. Implemented canonical pure rules for price/percentage and direction derivation, date-based presets/status, early-result eligibility and resolution-date bounds, suggested results, hit rate, calibration buckets, resolution-date week/month series, symbol normalization, claim-field changes, grace time, and reasoning history.
  - Date rules take validated calendar-date strings supplied in the user's environment timezone and use UTC only for timezone-independent date arithmetic. Claim changes compare decimal values numerically and timestamps by instant, matching the store's equivalence behavior.
  - Tests cover the requested acceptance criteria and assumptions, including 424.20/7.14%, deadline preset roll-forward at Saturday/month-end weekend, correct-only early eligibility for Target price and Percent move, touch/shortfall suggestions, empty hit rate, low-n calibration, Sunday-Saturday resolution weeks, deadline-day status boundary, and 4:59/5:00 reasoning history behavior; 11 compiled tests pass under plain Node.
  - Verification passed: corepack pnpm install; corepack pnpm --filter @portfolio-engineering/domain build; corepack pnpm --filter @portfolio-engineering/domain lint; corepack pnpm --filter @portfolio-engineering/domain test (11/11). The test script rebuilt the package and ran emitted dist tests with plain node --test; pnpm-lock.yaml was updated.
  - Store discrepancies (database package intentionally unchanged): PredictionStore.recordResult() allows early Correct only for Percent move, omitting Target price (FR 23); it bounds non-early resolutionDate from deadline rather than only from the prediction's created date (FR 24); due list/count predicates use deadline <= asOfLocalDate, making a prediction Due on the deadline date instead of after that date ends (FR 37/A1). The domain rules follow the spec.

---

## E-03: Protected Intuition Ledger API

**Goal:** Protected, validated, organization- and user-scoped endpoints for every workflow in the UX API contract.

**Exit gate:** API typecheck, lint, and tests pass for all routes, including cross-org and cross-user isolation, amend confirmation, reasoning history, early-result rejection, not-voided delete, invalid queries, stats "not available", and `resultChanged` in list and detail responses.

**Depends on:** E-01, E-02

### T-03.1: Implementing prediction CRUD, lifecycle, and suggestions routes

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.2, T-01.4, T-02.1, T-02.2
- **Files:**
  - `apps/api/src/plugins/intuitionLedger.ts` (new)
  - `apps/api/src/plugins/intuitionLedger.test.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified; register plugin)
  - `apps/api/package.json` (modified; add `@portfolio-engineering/domain: workspace:*` and add `@portfolio-engineering/domain` to the `predev`, `prebuild`, and `pretypecheck` build filters)
- **Intent:** List (+`totalCount`), detail (with amendment, result, and reasoning histories, `amended`, grace-window end), create, update (server-authoritative grace window; return `amend_confirmation_required` with changed fields unless `confirmAmend`; reasoning is not a claim field and never requires `confirmAmend`; after the grace window a reasoning change writes one reasoning-history entry), record/change/clear result (FR 23/24 enforcement), void/restore, delete (voided only), Other-symbol and tag suggestions, due count. Validate that a chosen security is active and in the caller's organization on create/subject change (FR 4); derive direction and stored price/% server-side using `@portfolio-engineering/domain` rules (no duplicated rule logic in the API). Validate the client-supplied local date per the Approach timezone rule. Map the contract's `confirmAmend` to the store's `confirmAmendment`. The list response carries both the filtered count and the unfiltered user total per R-6 (if the T-02.1 contract lacks a field for either, update `packages/shared-types/src/intuitionLedger.ts` and `packages/validation/src/intuitionLedger.ts` in this task and keep the T-04.2 frontend client aligned by noting the change). Detail uses the T-01.4 history read.
- **ADRs:** [0001](../ADRs/0001-organization-aware-data-access.md) — `organizationId`/`userId` only from `request.user`; other users' IDs return generic not-found; [0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — delete never touches securities; [0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md) — reasoning and notes passed through unmodified.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/api typecheck`, `lint`, and `test` pass; the compiled route tests import the plugin, which calls `@portfolio-engineering/domain` at runtime (proving the B-1 fix end to end). Route tests cover each success path, same-ID access from another org and another user in the same org, inactive/foreign security rejection, grace window inside/outside with and without `confirmAmend`, reasoning-only edit after the window (saved without `confirmAmend`, history entry written, `amended` unchanged), reasoning round-tripped byte-for-byte, list search matching reasoning and outcome notes (FR 33), early Incorrect and early non-target/non-percent Correct rejected, resolution date bounds, local-date validation, not-voided delete conflict, invalid query params (repeated/unknown), T-02.1 schema rejections (non-positive prices, confidence outside 50–100, signed move sizes), and unexpected store failure propagation. List tests prove T is unaffected by filters and other users; detail tests prove all three histories are returned in order.
- **Notes:****
- The protected prediction routes are implemented and registered, and the plan now records the final route table, verification evidence, and E-03 progress (2 of 3 tasks done).
- Route table recorded: GET `/api/intuition-ledger/predictions`; GET `/api/intuition-ledger/predictions/:predictionId`; POST `/api/intuition-ledger/predictions`; PATCH `/api/intuition-ledger/predictions/:predictionId`; POST `/api/intuition-ledger/predictions/:predictionId/result`; DELETE `/api/intuition-ledger/predictions/:predictionId/result`; POST `/api/intuition-ledger/predictions/:predictionId/void`; POST `/api/intuition-ledger/predictions/:predictionId/restore`; DELETE `/api/intuition-ledger/predictions/:predictionId`; GET `/api/intuition-ledger/suggestions/other-symbols`; GET `/api/intuition-ledger/suggestions/tags`; GET `/api/intuition-ledger/due-count`.
- Verification passed: `corepack pnpm --filter @portfolio-engineering/api typecheck`, `lint`, and compiled `test` (52/52 passed). The frontend client paths and verbs match; no T-04.2 route mismatch was found.
- Remaining planned work: the dashboard stats endpoint `/api/intuition-ledger/stats` belongs to T-03.2 and is not part of this task. No other T-03.1 blockers remain.

### T-03.2: Implementing dashboard stats route

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-03.1
- **Files:**
  - `apps/api/src/plugins/intuitionLedger.ts` (modified)
  - `apps/api/src/plugins/intuitionLedger.test.ts` (modified)
  - `packages/database/src/predictionStore.ts` (modified only if T-01.2 aggregation inputs are insufficient; coordinate with database-design)
- **Intent:** Return summary counts, hit rate numerator/denominator, calibration buckets with n, per-type and per-normalized-symbol results (all symbols; the client charts top 10), time series by `period`, and scatter points; honor `amended` include/exclude; exclude voided.
- **ADRs:** [0001](../ADRs/0001-organization-aware-data-access.md) — aggregates scoped by org and user; [0006](../ADRs/0006-use-sunday-through-saturday-weeks.md) — week buckets start Sunday.
- **Verify:** Tests prove Security Master MSFT and Other MSFT group together (AC 24), voided excluded (AC 20), Amended toggle changes counts, empty data returns explicit not-available (AC 21), and another user's predictions never contribute.
- **Notes:****
- Implemented protected GET `/api/intuition-ledger/stats`, matching the frontend client path and verb. The route validates the strict query and user-local date, then derives scope only from verified `request.user`; all prediction reads carry both `organizationId` and `userId`.
  - Added `PredictionStore.statsRecords`, a narrow scoped projection for summary status, confidence, result/date, normalized symbols, and price fields; Decimal values are returned as strings. Existing `statsAggregate` inputs did not include enough data for the dashboard breakdowns.
  - Built summary status with the domain status rule; the Amended toggle affects chart/hit-rate analytics per FR 42 while summary counts remain overall, and voided predictions contribute only to the Voided summary tile. Domain functions calculate hit rate, calibration (including `lowSample`), Sunday–Saturday week/month series, and normalized symbols; type/symbol breakdowns and signed scatter points are computed from non-void resolved data.
  - Extended the strict shared response type/schema with `lowSample`; T-02.1 exposed bucket n but omitted the domain flag needed by the calibration UX. Tests cover Security Master/Other MSFT grouping, void exclusion, amended include/exclude, summary status counts, weekly/monthly bounds, signed scatter points, empty/not-available output, invalid queries, and user/organization isolation.
  - Verification passed: `corepack pnpm --filter @portfolio-engineering/api typecheck`; `lint`; `test` (54/54 compiled tests). Database validation passed: `corepack pnpm --filter @portfolio-engineering/database typecheck`; `lint`; `test` (60/60, including PostgreSQL 17 integration tests against native Windows PostgreSQL at localhost:5432).

### T-03.3: Confirming Security Master delete message covers predictions

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.2
- **Files:**
  - `apps/api/src/plugins/securityMaster.ts` (review; modify only if the blocked-delete message names specific features)
  - `apps/api/src/plugins/securityMaster.test.ts` (modified; blocked-by-prediction case using the real store contract or fake)
- **Intent:** Ensure FR 48: deleting a security referenced by any prediction returns the existing stable `blocked_by_references` conflict and suggests deactivation, without revealing prediction details or other users' data.
- **ADRs:** [0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — explain the block and offer deactivation; [0001](../ADRs/0001-organization-aware-data-access.md) — no cross-user detail leakage.
- **Verify:** API test asserts a 409 blocked-by-references response for a prediction-referenced security; API tests pass.
- **Notes:****
- Reviewed the existing stable `SECURITY_BLOCKED_BY_REFERENCES` 409 response against FR 48, ADR 0016, and ADR 0001; the feature-agnostic message already explains the block and offers deactivation without exposing prediction or user details, so `securityMaster.ts` was unchanged.
- Strengthened `securityMaster.test.ts` to cover a prediction-referenced blocked delete with the exact 409 payload and explicit assertions against prediction, security, and user detail leakage.
- Verification: `corepack pnpm --filter @portfolio-engineering/api test` passed (41/41); `typecheck` and `lint` passed.

### T-03.4: Exposing the result-change indicator in API responses

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.5
- **Files:**
  - `packages/shared-types/src/intuitionLedger.ts` (modified)
  - `packages/validation/src/intuitionLedger.ts` (modified)
  - `apps/api/src/plugins/intuitionLedger.ts` (modified)
  - `apps/api/src/plugins/intuitionLedger.test.ts` (modified)
  - `packages/database/src/predictionStore.ts` (modified; preserve the enriched read-record type in package declarations)
- **Intent:** Add `resultChanged: boolean` to the shared `PredictionRecord` or list-item type and its response schema, then return it from the prediction list and detail routes using the database-derived value. Keep list and detail contracts consistent; do not infer the flag in the API.
- **ADRs:** [0001](../ADRs/0001-organization-aware-data-access.md) — scope comes from verified request context, not client-supplied organization/user values; [0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — list state comes from the server.
- **Verify:** Validation build and lint pass; API typecheck, lint, and tests pass; route tests assert `resultChanged` in list and detail responses; frontend typecheck passes with the shared-types change.
- **Notes:****
  - Added `PredictionListItem extends PredictionRecord` with required `resultChanged: boolean`; list and detail response types and the corresponding strict validation schema use that type. Mutation responses remain ordinary `PredictionRecord` because write outcomes do not supply the database-derived history indicator.
  - Added a read-record mapper that copies the store-provided `resultChanged` into list and detail output. The API does not inspect result history or infer the value from timestamps.
  - Route tests assert true and false values in list output and true in detail output; the detail fixture pairs a changed result history with the store-provided true indicator.
  - Changed the database exported read-record declaration to an explicit `Prediction & { resultChanged: boolean }` intersection so package declarations preserve the Prisma fields and store-enriched flag. No persistence behavior changed.
  - Verification passed: `corepack pnpm --filter @portfolio-engineering/validation build`, `corepack pnpm --filter @portfolio-engineering/validation lint`, `corepack pnpm --filter @portfolio-engineering/api typecheck`, `corepack pnpm --filter @portfolio-engineering/api lint`, `corepack pnpm --filter @portfolio-engineering/api test` (54/54), and `corepack pnpm --filter @portfolio-engineering/frontend typecheck`. Frontend fixtures needed no updates.

---

## E-04: Frontend foundation

**Goal:** UI primitives, chart tokens, typed API client, and route/nav wiring ready for feature pages.

**Exit gate:** Frontend typecheck, lint, build, and tests pass with new primitives, `--chart-*` tokens, API client, URL parsers, and an Intuition Ledger nav entry routed to the real page shell.

**Depends on:** T-04.1 none; T-04.2 depends on E-02; T-04.3 depends on T-04.2; T-04.4 depends on T-01.3.

### T-04.1: Adding shadcn primitives and chart tokens

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** none
- **Files:**
  - `apps/frontend/src/components/ui/` (new: `chart.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `switch.tsx`, `badge.tsx`, `table.tsx`, `popover.tsx`, `calendar.tsx`, `command.tsx`, `toggle-group.tsx`, `slider.tsx`, `radio-group.tsx`, `collapsible.tsx`, as listed in the flow's component mapping)
  - `apps/frontend/package.json` and lockfile (modified; `recharts`, `react-day-picker`, `cmdk`, and Radix deps added by the CLI)
  - `apps/frontend/src/index.css` (modified; `--chart-1..5` light/dark tokens, colorblind-safe indigo/amber pair for Correct/Incorrect)
  - `apps/frontend/tailwind.config.*` (modified if tokens need mapping)
- **Intent:** Add only the primitives listed in the flow's component mapping via `npx shadcn@latest add …`; define semantic chart tokens. Configure `Calendar` usage for a Sunday week start (ADR 0006).
- **ADRs:** [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — CLI-added owned primitives, semantic tokens, no other chart/UI library; [0006](../ADRs/0006-use-sunday-through-saturday-weeks.md) — calendar weeks start Sunday.
- **Verify:** Frontend typecheck, lint (no new warnings), build pass; tokens meet 3:1 non-text contrast against card background in light and dark themes (document values in Notes).
- **Notes:****
- Added the 13 listed primitives with `npx shadcn@latest add` and retained the CLI-required `toggle.tsx` for ToggleGroup; existing Button, Card, Dialog, Alert, Input, native Select, and Textarea were not overwritten. Updated `components.json` to the current CLI schema; on Windows the CLI placed generated files under a literal `@` directory, so only new primitives were moved into `src/components/ui`. Added semantic Tailwind mappings for generated primitives and `--chart-1..5` in light/dark; Correct = chart-1 indigo, Incorrect = chart-2 amber (always also label/pattern per UX). WCAG relative-luminance contrast vs card: light `#ffffff`: chart-1 `#4f46e5` 6.29:1, chart-2 `#b45309` 5.02:1, chart-3 `#0f766e` 5.47:1, chart-4 `#db2777` 4.60:1, chart-5 `#0891b2` 3.68:1; dark `#0f172a`: chart-1 `#a5b4fc` 8.96:1, chart-2 `#fbbf24` 10.69:1, chart-3 `#2dd4bf` 9.59:1, chart-4 `#f472b6` 6.74:1, chart-5 `#67e8f9` 12.32:1. Calendar pins `weekStartsOn={0}`; server-rendered September 2026 weekday headings confirmed Sunday through Saturday. `corepack pnpm --filter @portfolio-engineering/frontend typecheck`, `lint`, and `build` passed; lint retains six pre-existing warnings (no new ones), and build retains the existing large-chunk advisory.

### T-04.2: Building the Intuition Ledger API client and URL parsers

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-02.1, T-02.2
- **Files:**
  - `apps/frontend/src/intuitionLedgerApi.ts` (new)
  - `apps/frontend/src/intuitionLedgerApi.test.ts` (new)
  - `apps/frontend/src/apiClient.ts` (modified; typed methods)
  - `apps/frontend/package.json` (modified; add `@portfolio-engineering/domain: workspace:*`; add `pretypecheck`, `prebuild`, and `pretest` scripts that run `corepack pnpm --filter @portfolio-engineering/domain build`; add the new test file to the `test` script)
- **Intent:** Typed `AuthenticatedApiClient` methods for all E-03 endpoints; list/dashboard query parsers and serializers; validated same-origin `returnTo` for dashboard, due, and list URLs; locale decimal parsing per the flow's content boundaries. Price/% preview and suggestion helpers import from `@portfolio-engineering/domain`; do not reimplement rules in the frontend.
- **ADRs:** [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — URL is the source of truth for filters; [0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — parsers consumed via `useSearchParams`.
- **Verify:** Frontend `typecheck`, `build`, and `test` pass from a clean state (no prebuilt `packages/domain/dist`), proving the `pre*` scripts build the domain package. Tests cover valid, repeated, unknown, and malformed params; default `status=active` omission; `returnTo` external/unsupported-path/param rejection; locale decimal parsing incl. ambiguous rejection.
- **Notes:****
- Added typed `AuthenticatedApiClient` methods for prediction list/detail/create/update, result record/clear, void/restore/delete, due count, stats, and symbol/tag suggestions. Requests and responses use the T-02.1 shared contracts, retaining `confirmAmend` in the client payload.
  - Added list/dashboard query parsers and serializers, strict repeated/unknown/malformed-value checks, omitted URL defaults (`status=active`, dashboard `week`/`include`), validated same-origin `returnTo` destinations, and locale-aware decimal normalization with ambiguous separators rejected. Operational `asOfLocalDate` remains an API query value, not URL-owned state. Prediction preview and result suggestion rules are re-exported from `@portfolio-engineering/domain`.
  - Added the domain workspace dependency and frontend `pretypecheck`/`prebuild`/`pretest` hooks; added the new fake-client/parser test file to the explicit test command. `corepack pnpm install --lockfile-only` passed.
  - Verification passed from a deleted `packages/domain/dist`: frontend `typecheck`, production `build`, and `test` (46/46); each pre-hook rebuilt domain. Frontend lint passed with six pre-existing warnings. The production build retains the existing >500 kB chunk advisory.
  - Coordination risk: T-03.1 is pending and has not fixed endpoint paths/methods yet; current paths and verbs are verified against fakes and must be aligned with the backend route implementation before integration.

### T-04.3: Wiring routes and navigation with due count

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.2, T-03.1
- **Files:**
  - `apps/frontend/src/scaffoldRoutes.ts` (modified; `intuition-ledger` entry after `journal`, Learning group, `in-progress`)
  - `apps/frontend/src/App.tsx` (modified; routes for dashboard, due, predictions, new, detail, edit; nav due-count text)
  - `apps/frontend/src/intuition-ledger/IntuitionLedgerLayout.tsx` (new; header + Overview/Due/All tabs)
- **Intent:** Register all six routes declaratively and render the nav label "Intuition Ledger, N due" (text) when N > 0; a failed count hides the count without implying zero.
- **ADRs:** [0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — declarative routes, `NavLink`; [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — deep link/refresh; [0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) — no placeholder mixed with working UI.
- **Verify:** Direct load and refresh of each route resolve; back/forward works between tabs; nav shows due text for N > 0 and nothing for 0 or failure. Frontend typecheck/lint/build/tests pass.
- **Notes:****
- The Learning navigation now places Intuition Ledger after Journal. `App.tsx` wires all six routes and loads the due count through the authenticated API client. The shared layout provides URL-backed tabs and honest, minimal page shells for the E-05 work.
- The nav says "Intuition Ledger, N due" only when N is positive; zero and failed loads show no count. Confirmed the existing client types align with `filteredCount`, `totalCount`, and `lowSample`; no API-client change was needed.
- Verification: frontend typecheck, lint, build, and tests passed (51/51). Tests cover six direct/refresh URLs, tab back/forward behavior, and due-count text for positive, zero, and failed loads. The API health check and all six Vite deep-link requests returned HTTP 200.
- Remaining verification risk: an authenticated browser check was not possible in the hosted sign-in environment, and headless Edge returned no DOM. Interactive browser history and the live authenticated due-count display therefore still need a manual check. Lint retained six pre-existing warnings; build retained its large-chunk advisory.

### T-04.4: Reflecting prediction backup sections in the delete-profile dialog

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-01.3
- **Files:**
  - `apps/frontend/src/components/DeleteProfileDialog.tsx` (review; modify only if it lists backup sections or counts)
  - `apps/frontend/src/components/DeleteProfileDialog.test.tsx` (modified only if the dialog changes)
- **Intent:** Split from T-01.3 so database-design does not edit frontend files. If the dialog enumerates what the backup and delete cover, include predictions and their histories (amendment, result, reasoning); otherwise record "no change needed" with the reason.
- **ADRs:** [0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md) — users see what deletion removes.
- **Verify:** Notes record the review outcome; if changed, frontend typecheck, lint, and tests pass.
- **Notes:****
- Reviewed T-01.3's `data.intuitionLedger` contract: it has `predictions`, `amendmentHistory`, `resultHistory`, and `reasoningHistory` subsections. The delete dialog enumerated journal entries and investor profile settings, and the Account Settings danger-zone copy also enumerated deleted data, so both were updated rather than recording "no change needed".
  - Added a shared Intuition Ledger coverage phrase naming predictions and amendment, result, and reasoning histories; the dialog uses it in both its delete warning and backup description, and Account Settings uses it in its delete warning. Added a regression test and registered it in the frontend test command.
  - Verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck` passed; `lint` passed with six existing warnings; `test` passed (47/47).

---

## E-05: Intuition Ledger UI

**Goal:** All user workflows from the UX flow, accessible and responsive.

**Exit gate:** Every item in the flow's UX acceptance checklist is met by tests or documented manual verification; frontend typecheck, lint, build, and tests pass.

**Depends on:** E-03, E-04

### T-05.1: Building the create and edit form

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.3, T-04.1
- **Files:**
  - `apps/frontend/src/intuition-ledger/PredictionFormPage.tsx` (new)
  - `apps/frontend/src/intuition-ledger/PredictionFormPage.test.tsx` (new)
  - `apps/frontend/src/intuition-ledger/SubjectPicker.tsx` (new)
  - `apps/frontend/package.json` (modified; test script)
- **Intent:** Sentence-style form per type with progressive disclosure; active-only security combobox, Other with suggestions and normalization, Security Master match prompt (FR 6), Freeform topic; deadline presets with resolved-date display and non-trading-day hint; confidence slider + input (default 60%); price section with live `aria-live` preview; an always-visible reasoning `Textarea` labelled "Why do you think this will happen (optional)" with "Markdown formatting is supported." helper text (FR 11), no toolbar or WYSIWYG mode; tags behind an "Add tags" disclosure; edit-mode grace countdown (`role="timer"`, single end announcement) and Amended AlertDialog listing changed fields, driven by the server `amend_confirmation_required` result. Reasoning-only edits never open the Amended dialog. Existing inactive security shows as current value (FR 4).
- **ADRs:** [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — owned primitives (existing `components/ui/textarea.tsx`); [0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md) — direct Markdown in a plain textarea, sent exactly as typed; [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — draft stays out of the URL, validated `returnTo`.
- **Verify:** Tests cover AC 1–9, 11, 12, 12a; reasoning field visible without expanding anything and submitted unmodified (including leading/trailing whitespace and Markdown syntax); reasoning-only edit after the grace window saves without the Amended dialog; grace countdown and one-time announcement; cancel in Amended dialog saves nothing and keeps the draft; field-level server errors map to fields.
- **Notes:**** Implemented `PredictionFormPage` (create + edit) and `SubjectPicker`, wired into `intuitionLedgerRoutes.tsx` in place of the T-04.3 placeholder shells for `predictions/new` and `predictions/:predictionId/edit`. All price/direction/deadline derivations call `@portfolio-engineering/domain` (`derivePredictedValuesFromPercent`, `deriveTargetPriceDetails`, `deriveDirectionFromPrice`, `derivePercentChange`, `resolveDeadlinePreset`, `isTradingDay`, `isWithinGracePeriod`, `getGracePeriodRemainingMs`) and the shared `parseLocaleDecimal`/`getSafeIntuitionLedgerReturnTo`; the client never reimplements Amended detection — `updatePrediction` is called as-is and a 409 `amend_confirmation_required` response (surfaced via a new `fieldErrors`/`changedFields` extension to `apiClient.ts`'s `ApiError`) opens the `AlertDialog` listing changed fields, with "Keep editing" only clearing local dialog state (no save) and "Save and mark Amended" resubmitting with `confirmAmend: true`. Reasoning is an always-visible plain `Textarea` labelled "Why do you think this will happen (optional)" with "Markdown formatting is supported." helper text, sent exactly as typed (only `.trim()` is used to decide null-vs-value, never to alter the stored string); tags sit behind a native `<details>` "Add tags" disclosure. Existing inactive security references display via `currentInactiveSecurityLabel` without being re-selectable. Fixed a frontend test-runner gap surfaced by this task: `tsx --test` could not resolve the shadcn `@/lib/utils` alias used by shared primitives (e.g. `button.tsx`), so `package.json`'s `test` script now passes `tsx --tsconfig tsconfig.app.json`, which already declares the `@/*` path mapping — this let existing and new tests import components that transitively pull in shared UI primitives for the first time.
  - Evidence (all commands run from repo root): `corepack pnpm --filter @portfolio-engineering/frontend typecheck` (clean), `lint` (oxlint, 0 errors — only pre-existing `react(only-export-components)`/`react-hooks(exhaustive-deps)` warnings matching the rest of the codebase), `build` (`tsc -b && vite build`, succeeds), `test` (67/67 passing, tsx --test).
  - AC — test mapping (`apps/frontend/src/intuition-ledger/PredictionFormPage.test.tsx` unless noted): AC1 — "create form offers all five prediction types"; AC2 — "SubjectPicker is wired with only active securities and shows an inactive current value"; AC3/AC4 — "Other symbol is sent trimmed (server normalizes case) and a Security Master match is detected"; AC5 — "Event reaction requires a security/symbol, Freeform allows a topic"; AC6 — "measurable predictions require a price at prediction greater than zero"; AC7 — "predicted price and move-size derivations match the spec examples" (MSFT 420→424.20 Rises 1%; NVDA 140→150 target → "rises 7.14%", no currency symbol); AC8 → "a contradictory direction cannot be entered when deriving from a predicted price"; AC9 — "price fields reuse the shared locale-decimal parser"; AC11 — "grace countdown formats minutes:seconds and the edit view wires a timer + Amended dialog" (covers `role="timer"`, `amend_confirmation_required`, "Save and mark Amended", cancel-saves-nothing); AC12 — "the client never reimplements Amended detection; the server decides via amend_confirmation_required"; AC12a — "reasoning textarea is always visible, optional, and saved exactly as typed". Also added: "server field errors and known error codes map to form fields", "buildClaimSummary produces a readable sentence per type", and (in `IntuitionLedgerLayout.test.tsx`) "new and edit resolve to the real prediction form, not the placeholder shell" / "new and edit routes render the real PredictionFormPage, not the placeholder shell" confirming the T-04.3 shell replacement.


### T-05.2: Building the record-result dialog and due queue

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.3, T-04.1
- **Files:**
  - `apps/frontend/src/intuition-ledger/RecordResultDialog.tsx` (new; Dialog desktop, Sheet mobile)
  - `apps/frontend/src/intuition-ledger/DuePage.tsx` (new)
  - `apps/frontend/src/intuition-ledger/RecordResultDialog.test.tsx` (new)
  - `apps/frontend/package.json` (modified; test script)
- **Intent:** Correct/Incorrect with optional actual price and suggestion (pre-selects only when no choice made), resolution date with bounds, outcome notes (plain `Textarea`, direct Markdown); before-deadline behavior per FR 23 (Correct only for Target price and Percent move; otherwise "The deadline hasn't passed yet."). Due queue oldest-first with in-place resolve, polite announcement, and focus move to next row.
- **ADRs:** [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — Dialog/Sheet primitives; [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — dialog state is component state.
- **Verify:** Tests cover AC 13–16, early Correct for Percent move and Target price, suggestion override, focus management after resolve, and empty due state.
- **Notes:****
- Replaced the due-route shell with an API-backed, oldest-deadline-first queue, in-place Record result dialog (desktop Dialog/mobile Sheet), retry/loading/empty states, accessible success announcement, due-count refresh, and focus movement to the next row or heading. The dialog uses `@portfolio-engineering/domain` for early-result eligibility, deadline status, resolution-date bounds, and price-based suggestions; it supports optional locale-aware actual price, explicit override, a bounded Sunday-first Calendar, result change/clear, and plain Textarea outcome notes sent unchanged. Server rule errors and other API failures remain visible with the draft retained. The dialog is component-owned, not URL state.
  - Evidence (`apps/frontend/src/intuition-ledger/RecordResultDialog.test.tsx`): AC13 -> "AC 13: only early Correct for Percent move or Target price; deadline day is not past" (including disabled Incorrect validation); AC14 -> "AC 14: actual price is optional, suggestions preselect until user chooses, and Markdown is sent unchanged"; AC15 -> "AC 15: a right-direction move short of the predicted price suggests Incorrect"; AC16 -> "AC 16: rising target high or falling target low touching the target suggests Correct". Additional tests verify resolution-date defaults/bounds, the scoped due API request and ordering, route loading on direct render, empty due state, and post-resolution focus targeting; the existing layout test covers due-tab back/forward navigation.
  - Verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck`, `lint`, `build`, and `test` passed (76/76 tests); lint retains pre-existing warnings plus the same Fast Refresh helper-export warnings as T-05.1, build retains the existing large-chunk advisory. No live authenticated browser/API session was available for manual responsive and mutation smoke testing.

### T-05.3: Building the prediction list

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.3, T-03.4
- **Files:**
  - `apps/frontend/src/intuition-ledger/PredictionListPage.tsx` (new)
  - `apps/frontend/src/intuition-ledger/PredictionListPage.test.tsx` (new)
  - `apps/frontend/src/intuition-ledger/intuitionLedgerRoutes.tsx` (modified; wire the real list page in place of the T-04.3 shell)
  - `apps/frontend/src/intuition-ledger/IntuitionLedgerLayout.tsx` (modified; removed the obsolete `list` placeholder view)
  - `apps/frontend/src/intuition-ledger/IntuitionLedgerLayout.test.tsx` (modified; route-shell assertions for `/predictions`)
  - `apps/frontend/package.json` (modified; test script)
- **Intent:** ADR 0017 grid: Search, Status (visible default "All except void"), Type, Result, Symbol, Tag, Amended; claim summary cell; status/result text + icon; Amended and "Result changed" flags using the server-provided `resultChanged` field; "Showing N of T predictions"; distinct empty/no-match/invalid-filter/error states; responsive filter collapse.
- **ADRs:** [0017](../ADRs/0017-standardize-data-grid-list-behaviors.md) — all grid behaviors; [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — filter edits use `replace`.
- **Verify:** Tests cover AC 26 and invalid/unlisted `tag`/`symbol` as labelled current option; count line uses server `totalCount`; the row flag reflects the server-provided `resultChanged` value. Frontend typecheck, lint, build, and tests pass.
- **Notes:****
- Blocked before implementation: the approved `PredictionListResponse`/`PredictionRecord` contract exposes a current `result` but no result-history count or `resultChanged` boolean. The required Flags column must distinguish a result that was changed after recording from a result recorded once; `updatedAt` cannot supply that distinction because ordinary result recording, reasoning edits, tag edits, and claim amendments all update it. The frontend must not access persistence, issue N detail/history requests, or show an inaccurate flag. Add a server-derived, requester-scoped list field (for example `resultChanged: boolean`, true only when a result-history record exists) to the shared validation/API contract, then unblock and implement this task.
  - Unblocked by T-01.5 and T-03.4: render the row flag from the server-provided `resultChanged` boolean; do not infer it from `updatedAt` or fetch per-row history.
```

### Add R-9 to Risks and open items

```markdown
| R-9 | The prediction record and list query lack a server-derived result-history indicator needed for the “Result changed” list flag. T-01.5 defines and computes the scoped value; T-03.4 exposes it in list/detail contracts. | The list cannot show an accurate result-change flag without client-side history requests or inference from unrelated timestamps. | database-design (T-01.5); backend-coding (T-03.4) | T-05.3 |
```

### Append a Revisions row

```markdown
| 2026-09-27 | T-05.3 result-history indicator gap; user chose to resolve it before continuing | Added T-01.5 for the scoped database-derived `resultChanged` value and T-03.4 for shared/API contracts; returned T-05.3 to pending with dependencies and the server-field requirement; added R-9. No task renumbered; no done task changed. |
```

T-05.4 needs no edit: its existing Intent already displays “Result changed on {date}” from result history.

### T-05.4: Building the prediction detail and lifecycle actions

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-05.2
- **Files:**
  - `apps/frontend/src/intuition-ledger/PredictionDetailPage.tsx` (new)
  - `apps/frontend/src/intuition-ledger/PredictionDetailPage.test.tsx` (new)
  - `apps/frontend/package.json` (modified; test script)
- **Intent:** Claim, a "Why I predicted this" reasoning section directly after the claim (rendered with the existing `MarkdownViewer`; "No reasoning recorded." when empty; "Reasoning edited on {date}" when edited after the grace window), prices (no currency symbol), outcome (notes via `MarkdownViewer`), amendment history (original claim viewable), result history ("Result changed on {date}"), reasoning history (original and each later version, FR 19a), Amended badge (text); void (optional reason), restore, delete (voided only, AlertDialog); generic not-found for other users.
- **ADRs:** [0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md) — delete never implies security removal; [0001](../ADRs/0001-organization-aware-data-access.md) — generic not-found; [0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md) — existing `MarkdownViewer` for display.
- **Verify:** Tests cover AC 12b, 17, 19, not-voided delete message "Void this prediction before deleting it.", restore to previous state, reasoning Markdown rendered formatted, reasoning history and "Reasoning edited on {date}" shown with no Amended badge, and not-found.
- **Notes:****
  - Implemented `PredictionDetailPage.tsx` with `PredictionDetailPage.test.tsx` and updated `intuitionLedgerRoutes.tsx`, `IntuitionLedgerLayout.tsx`, `IntuitionLedgerLayout.test.tsx`, and the `apps/frontend/package.json` test script.
  - Verification passed: frontend typecheck; frontend tests passed (102/102); lint exited 0 with existing warnings; build succeeded with an 831.50 kB main bundle and the existing over-500 kB advisory (see R-5).
  - No live authenticated browser smoke test was run; T-05.6 remains responsible for live accessibility/responsive/browser evidence.
  - The detail contract has no persisted historical suggested result, so the page recomputes the suggestion from the current claim and actual price.

### T-05.5: Building the dashboard and charts

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.2, T-04.1, T-04.3
- **Files:**
  - `apps/frontend/src/intuition-ledger/DashboardPage.tsx` (new)
  - `apps/frontend/src/intuition-ledger/charts/` (new; one component per chart plus shared `ChartCard` with "View as table")
  - `apps/frontend/src/intuition-ledger/DashboardPage.test.tsx` (new)
  - `apps/frontend/package.json` (modified; test script)
- **Intent:** Summary tiles, due preview, URL-owned Period and Amended controls, five charts via shadcn Chart with `accessibilityLayer`, per-chart description, table alternative (`aria-pressed` toggle), empty states, calibration n labels and low-n note with hatched pattern, top-10 symbol chart with all-symbol table, scatter with reference line and inclusion caption, neutral copy.
- **ADRs:** [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — shadcn Chart only, `--chart-*` tokens; [0006](../ADRs/0006-use-sunday-through-saturday-weeks.md) — week labels Sun–Sat; [0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — `period`/`amended` in URL.
- **Verify:** Tests cover AC 21–25 and hit rate "Not available yet"; table alternatives render identical values; no direction coloring (FR 45); responsive reflow checked at 320px and 200% zoom (documented manually).
- **Notes:****
  - Replaced the T-04.3 overview shell with a stats-backed dashboard, five-oldest due preview (record result in place), URL-owned `period`/`amended` controls, and five shadcn Chart cards with table views. The dashboard route is `React.lazy`/`Suspense` split.
  - AC evidence in `DashboardPage.test.tsx`: AC 21 -> unavailable hit rate vs measured zero; AC 22 -> summary, five charts, URL controls, and week labels; AC 23 -> low-sample caveat, counts, and hatched buckets; AC 24 -> normalized symbol groups; AC 25 -> table alternatives, labels, matching values, and neutral scatter series. `IntuitionLedgerLayout.test.tsx` covers overview route loading and URL history. The explicit test script includes `DashboardPage.test.tsx`.
  - Vite bundle evidence: before, entry JS 831.50 kB / 248.09 kB gzip; after, entry JS 831.36 kB / 248.13 kB gzip plus lazy `DashboardPage` chunk 422.07 kB / 110.90 kB gzip. Recharts markers were present in the lazy chunk and absent from the entry. The pre-existing >500 kB entry warning remains.
  - Frontend typecheck, lint, build, and tests passed (112/112); existing lint warnings remain, with none from the dashboard/chart modules.
  - Responsive review: visually checked 320px content width and 2x output; summary stays two columns, charts one column, and text/actions wrap without horizontal overflow. Headless Edge reported a 477px CSS viewport despite a 320px window, so interactive browser zoom at exactly 200% remains for T-05.6.

### T-05.6: Verifying accessibility and responsive behavior end to end

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-05.1, T-05.2, T-05.3, T-05.4, T-05.5
- **Files:**
  - `docs/uxd/flows/0009-intuition-ledger.md` (reference; UX acceptance checklist)
  - `docs/plans/0009-intuition-ledger.md` (modified; evidence in Notes)
- **Intent:** Run the app and walk the UX acceptance checklist (keyboard, screen reader names/announcements, focus order, color independence, mobile Sheet, 320px and 200% zoom reflow), recording per-item evidence (what was checked, how, result) for UXD review in T-05.7. Fix small defects in place; add new tasks for larger ones. Reassigned from uxd on 2026-09-27 because the uxd agent has no terminal or browser tools.
- **ADRs:** [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — accessible primitives.
- **Verify:** Every checklist item has recorded evidence and a pass/fail result; each fail has a fix in this task or a new follow-up task ID in this effort.
- **Notes:****
- Live setup (2026-09-27): Edge 153 headless CDP, native PostgreSQL 17, isolated local-auth API :3002 (`APP_MODE=local`) behind temporary browser proxy :5175 to existing Vite :5173; existing hosted API :3001 untouched. Signed in as Primary User. Three test predictions and one temporary security were created, then all voided/deleted or deleted; list and Security Master both returned 0 of 0. DOM input events were used for field entry; only explicit CDP key checks below were keyboard input. No real screen-reader speech or human timing session occurred.
- UX checklist 1 PASS: directly loaded/refreshed overview, due, list with `status=all&symbol=VERIF26`, create, detail, edit. Clicked list tab and CDP native back/forward returned overview/list; month + amended=exclude direct URL loaded, Week changed period query; filters are URL state with replace semantics.
- 2 PARTIAL -> T-05.9: live Percent move saved with price 100, move 1%, Other symbol; preview `Predicted price 101.00 (rises 1.00%).` had `role=status`, `aria-live=polite`. CDP Tab moved focus and ArrowRight selected the next radio, but full uninterrupted keyboard-only completion and actual spoken announcement not verified. Fixed stored claim grammar `will rises` -> `rises`, with regression test.
- 3 PASS: created active Security Master VERIF26, typed `verif26` as Other, observed accessible `Use it` match prompt, saved without choosing it, and cleaned up the fixtures.
- 4 PASS: edit countdown used `role=timer` with `aria-live=off`, then polite grace-end announcement. After 5 minutes a move edit opened an Amended alertdialog listing Claim, Predicted price, Move size; Keep editing kept draft/no save; confirmation saved and detail showed Amended plus one amendment-history entry. Fixed live edit failure caused by stale derived price/subject fields in API merge: update payload now clears inactive alternatives; tests cover it.
- 5 PASS: early Percent move Correct enabled, Incorrect disabled with deadline explanation; Freeform on deadline day could not resolve. Correct saved. With browser local date rolled to next day, a due Freeform became resolvable. Fixed/tested default resolution date when travel across timezones puts deadline before local creation date.
- 6 PARTIAL -> T-05.9: resolving the only due item in place kept `/due`, announced `0 predictions still due`, changed Due (1) to Due (0), and focused `#due-heading`; unit tests cover next/previous row and heading, but two-item live next-row focus not exercised.
- 7 PASS: early Correct followed by Clear result produced result history (1), including expanded `Result changed on Sep 27, 2026` and Correct -> Not recorded.
- 8 PASS: reasoning textarea with Markdown helper always visible. Entered Markdown with leading/trailing spaces, saved and reloaded it in edit; detail rendered formatted Markdown. Existing form test asserts byte-exact reasoning payload.
- 9 PARTIAL -> T-05.9: post-grace reasoning-only edit saved with no confirmation; detail showed `Reasoning edited on Sep 27, 2026` and reasoning history (1) with earlier/updated text. This particular record was already Amended from item 4, so absence of Amended badge on a previously unamended record remains to test live (unit coverage exists).
- 10 PASS: five `View as table` controls with `aria-pressed` toggled to five visible captioned tables with headers; calibration displayed `n = 1` and fewer-than-5 caveat. Empty charts also retained table alternatives.
- 11 PASS via DOM/CSS inspection: Correct/Incorrect text with check/cross, hatched sparse-bar legend, textual uncolored rise/fall arrows, no currency symbol on price or charts; color perception itself not simulated.
- 12 PASS: with rollover, sidebar literal text was `Intuition Ledger, 1 due` and tab `Due (1)`; after resolution positive count disappeared. Normal-state navigation links also had accessible names in CDP AX tree.
- 13 FAIL -> T-05.8, T-05.9: at CSS viewport 320, document scrollWidth=842; at CSS 640 (1280px / 200% equivalent), scrollWidth=857, workspace-shell ~802 wide. Workspace header/logo/account, alert and grid impose intrinsic widths; list table has an additional intentional inner scroll. CDP page scale 2 is pinch zoom rather than actual browser text zoom: true 200% remains untested. Mobile Sheet itself was 320 wide with focused input x=24..281 inside a 640px viewport. Prior T-05.5 approximate reflow check was not exact CSS viewport measurement.
- 14 PARTIAL -> T-05.9: resolution succeeded without leaving due queue; human <30-second capture not measured. Headless CDP Enter/Space did not toggle focused mobile list `<summary>` while click did; independent interactive keyboard verification is required before calling this a product defect.
- Additional dialog check: mobile Sheet had accessible dialog name and focused actual-price input inside viewport; Escape closed it. Initially focus fell to BODY; fixed Sheet/Dialog close autofocus to restore a still-connected triggering button, leaving due-queue focus intact after a removed row. Browser retest focused Record result; unit test covers disconnected triggers.
- Post-fix verification: `corepack pnpm --filter @portfolio-engineering/frontend typecheck`, `lint` (0 errors; existing Fast Refresh/hooks warnings), `build` (success; pre-existing chunk advisory), `test` (114/114). ADR 0005 owned primitives and semantic styling preserved. T-05.8 reflow and T-05.9 hands-on evidence precede T-05.7 UXD acceptance.

### T-05.8: Remediating Intuition Ledger 320px and 200% reflow

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-05.6
- **Files:** `apps/frontend/src/App.tsx`, `apps/frontend/src/App.css` (shared scaffold constraints only), `apps/frontend/src/intuition-ledger/` and relevant frontend tests.
- **Intent:** Fix shared workspace header/logo/account, alert and grid intrinsic widths plus any feature layout overflow; keep table scrolling inside its container. Avoid broad restyling of unrelated pages.
- **ADRs:** [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — scoped responsive layout and semantic tokens.
- **Verify:** Browser measurements/screenshots of all six routes, charts, filters and mobile Sheet show no page-level horizontal overflow or covered focus at 320 CSS px and actual 200% browser zoom; frontend typecheck, lint, build, tests pass.
- **Notes:**
- Browser verification (2026-09-27): authenticated isolated local-profile Primary User in Edge 153 headless via CDP, temporary proxy 5175 -> Vite 5173/API 3002; one test prediction was created/resolved then permanently deleted. CSS viewports were set to 320 and 640.
- Before -> after document scrollWidth at 320/640: Overview 842/857 -> 305/625; Due 842/857 -> 305/625; All predictions with one test row 1042/1057 -> 305/625; New 842/857 -> 305/625; Edit 842/857 -> 305/625; Detail 842/857 -> 305/625. After scrollWidth equaled documentElement.clientWidth (305/625); workspace-shell reduced from 802 to 227/515.
- Prediction table remains an inner 960px scroller (client 185/473 at 320/640); dashboard filters fit 225/513px controls; list filters fit 193/481px with right edges 249/553 inside 305/625px. All five chart tables stayed inside their local scrollers (320px viewport scroll widths 310-387 in 193px wrappers; at 640 all fit 465px wrappers).
- SubjectPicker measured 227px (x=39..266) at 320 and 515px (x=55..570) at 640, matching its trigger. The 320px Sheet filled x=0..320 with focused actual-price input x=24..296; at 640 the existing breakpoint uses a 512px Dialog at x=64..576 with focus x=89..551.
- Desktop regression check at 1280 CSS px: Journal and Security Master retained two-column layout (nav 288px, main 763px), nowrap header, and document scrollWidth=clientWidth=1265.
- True browser zoom attempt: eight CDP Ctrl+Plus shortcuts at 1280 left innerWidth=1280 and DPR=1; actual 200% zoom was not achieved. The 640px CSS viewport was verified as the 200%-equivalent.
- Regression tests: frontend typecheck passed; lint had zero errors with existing Fast Refresh/hooks warnings; build passed with the existing large-chunk advisory; tests passed 116/116.
- Remaining for T-05.9: complete keyboard-only capture and mobile filter disclosure with interactive input; verify spoken preview/grace/due announcements using a screen reader; exercise two-item due focus and reasoning-only edit on an unamended record; time a human capture against 30 seconds; obtain actual 200% browser zoom evidence.

### T-05.9: Completing interactive accessibility and timed usability checks

- **Status:** pending
- **Owner:** frontend-coding
- **Depends on:** T-05.8
- **Files:** `docs/plans/0009-intuition-ledger.md` (evidence); affected `apps/frontend/src/intuition-ledger/` components/tests only for reproduced defects.
- **Intent:** Use an interactive browser and screen reader for full keyboard-only Percent move entry, mobile filter disclosure, spoken preview/grace/due-count, two-item due focus and unamended reasoning-only edit; time a human capture attempt against 30 seconds. Do not treat synthetic key events or automation speed as human behavior.
- **ADRs:** [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — keyboard, focus, announcements and reflow.
- **Verify:** Each remaining partial item and actual 200% browser zoom has documented pass/fail evidence; reproduced failures get fixes and regression tests plus passing frontend typecheck, lint, build, tests before T-05.7 UXD acceptance.
- **Notes:**** T-05.6 authenticated CDP checks proved names, roles, mutations and single-item due focus, but did not measure a human session or listen to assistive technology.

### T-05.7: Reviewing accessibility and responsive evidence

- **Status:** pending
- **Owner:** uxd
- **Depends on:** T-05.6, T-05.8, T-05.9
- **Files:**
  - `docs/plans/0009-intuition-ledger.md` (modified; review outcome in Notes)
  - `docs/uxd/flows/0009-intuition-ledger.md` (modified only to tick the acceptance checklist or record an approved deviation)
- **Intent:** Review the T-05.6, T-05.8, and T-05.9 evidence against the UX flow and accept or reject each checklist item; rejected items become new frontend-coding tasks.
- **ADRs:** [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — accessible primitives.
- **Verify:** Every checklist item is accepted, or rejected with a new follow-up task ID; the checklist in the flow reflects the outcome.
- **Notes:****

---

## E-06: Help content

**Goal:** Help topic and tooltips for the Intuition Ledger, in the Learning group.

**Exit gate:** Help index validates, the topic and tooltips render in-app, and the bundled fallback includes them.

**Depends on:** E-05 (behavior final)

### T-06.1: Authoring Intuition Ledger help content

- **Status:** done
- **Owner:** uxd
- **Depends on:** T-05.5
- **Files:**
  - `content/help/index.json` (modified; `help.learning.intuition-ledger` and tooltip keys)
  - `content/help/pages/intuition-ledger.md` (new)
  - `content/help/tooltips/intuition-ledger.amended.txt` (new)
  - `content/help/tooltips/intuition-ledger.void.txt` (new)
  - `content/help/tooltips/intuition-ledger.calibration.txt` (new)
  - `content/help/tooltips/intuition-ledger.grace-window.txt` (new)
- **Intent:** Content only. Explain types, deadlines (Mon–Fri trading days; holidays not recognized yet), the optional reasoning field (Markdown supported; later edits kept in reasoning history, never Amended), grace window and Amended, early Correct rules, results and result history, void/delete, and chart reading, following [the content guide](../specs/0007-help-system-content-guide.md). Neutral, not advice. List the new keys in Notes for T-06.2 and T-06.3.
- **ADRs:** [0015](../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) — help ships with the feature; stable `help.*` keys.
- **Verify:** Index entries follow the key, `group`, and `parentKey` rules in [spec 0007](../specs/0007-help-system.md) and the content guide; new keys are listed in Notes. (Automated validation runs in T-06.3.)
- **Notes:** New help keys for T-06.2/T-06.3: `help.learning.intuition-ledger`, `help.learning.intuition-ledger.amended`, `help.learning.intuition-ledger.void`, `help.learning.intuition-ledger.calibration`, `help.learning.intuition-ledger.grace-window`.

### T-06.2: Wiring help links and tooltips into the Intuition Ledger UI

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-06.1
- **Files:**
  - `apps/frontend/src/intuition-ledger/` (modified; `HelpTooltip`/`HelpTopicLink` next to Amended, Void, calibration, and the grace banner)
  - existing tests for the touched pages (modified)
- **Intent:** Connect the T-06.1 keys to the UI terms the UX flow requires inline explanations for.
- **ADRs:** [0015](../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) — stable `help.*` keys; [0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — existing help components.
- **Verify:** Frontend typecheck, lint, and tests pass; the topic and each tooltip render in the running app.
- **Notes:**
- New help keys for T-06.3: `help.learning.intuition-ledger`, `help.learning.intuition-ledger.amended`, `help.learning.intuition-ledger.void`, `help.learning.intuition-ledger.calibration`, `help.learning.intuition-ledger.grace-window`.
- Frontend verification (2026-09-27): typecheck and build passed; lint passed with existing Fast Refresh/hooks warnings; tests passed 119/119.
- Live verification (2026-09-27): signed in with the isolated local-profile Primary User in Edge headless via a temporary proxy. The Intuition Ledger header link and calibration tooltip rendered. At 320 CSS px, the open tooltip used fixed positioning and document scrollWidth equaled clientWidth (305px).
- Blocker: the live Help topic route returned "Help topic unavailable" because the current runtime Help payload does not yet include the unmerged T-06.1 keys; the bundled fallback also lacks them pending T-06.3. Other feature tooltip triggers are covered by frontend tests but were not exercised live without fixtures. No API files or prediction/security fixtures were changed. Rerun the topic and tooltip live checks after T-06.3 before marking this task done.
- Reverification (2026-09-27): with `APP_MODE=local` API :3002 and Vite :5173 through temporary proxy :5175, signed in as isolated local-profile Primary User in headless Edge. Header Help link opened `/help/help.learning.intuition-ledger` with a rendered topic article (not "Help topic unavailable"). Live calibration, grace-window, and Void tooltips displayed their content; after the real five-minute grace window, a temporary prediction was amended and the Amended tooltips displayed content in both list and detail. At 320 CSS px every open tooltip was visible and within viewport bounds; document scrollWidth equaled clientWidth (305px), with no page overflow. The fixture was voided and permanently deleted (detail returned 404), and temporary browser services/profile were removed. Frontend typecheck, lint (existing warnings only), build (existing chunk advisory), and tests (119/119) passed. No product-code defects reproduced.

### T-06.3: Validating help content and the bundled fallback

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-06.1
- **Files:**
  - `apps/api/src/lib/bundledHelp.ts` (modified if the bundled fallback enumerates topics)
  - `apps/api/src/lib/helpContent.test.ts` (modified only if new keys need explicit coverage)
- **Intent:** Make sure the new help content passes server validation and is available when the runtime content source is unavailable.
- **ADRs:** [0015](../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md); [0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md) — runtime content with bundled fallback.
- **Verify:** `corepack pnpm --filter @portfolio-engineering/api test` passes, including help content validation tests.
- **Notes:**
  - Root cause: all five `help.learning.intuition-ledger*` keys contain hyphens, but the shared help-key schema rejected hyphens; the bundled index/content also omitted those keys. The local API prefers its valid database cache and only uses the bundle when cache is unavailable, so a pre-feature cache returned "Help topic unavailable." Automatic and manual refreshes read public GitHub `main`, not unpushed working-tree files.
  - Fix: shared key validation now permits hyphens within dot-separated segments; the bundle includes the Ledger page and four tooltips. In `APP_MODE=local`, missing bundled keys supplement a valid cache without replacing cached content for existing keys. Hosted cache behavior is unchanged; no content was pushed.
  - Verification: API tests passed (56/56), API typecheck/lint and validation lint passed. On 2026-09-27, authenticated local API at `http://127.0.0.1:3011` returned all five keys in `/api/help/index`; `/api/help/topics/:helpKey` returned `available` for the page (4,780 characters) and four tooltips (362, 349, 327, and 464 characters). This is the same topic endpoint used by the frontend API client.

---

## E-07: Governance review

**Goal:** Independent drift check before closeout.

**Exit gate:** No unresolved high-severity findings.

**Depends on:** E-01 to E-06

### T-07.1: Reviewing implementation against spec, ADRs, and UX

- **Status:** pending
- **Owner:** governance
- **Depends on:** T-05.7, T-06.2, T-06.3, T-04.4
- **Files:**
  - `docs/plans/0009-intuition-ledger.md` (modified; findings)
- **Intent:** Trace FR 1–48 (including FR 19a) and AC 1–32 (including AC 12a/12b) to code and tests; confirm ADR 0001 scope in every predicate, ADR 0012 (plain textarea, `MarkdownViewer`, reasoning stored exactly as typed, no editor dependency added), ADR 0014 backup/delete coverage (four sections), ADR 0016 restrictive FK, ADR 0017 grid, ADR 0015 help; confirm no deferred TD-019–TD-022 behavior leaked in.
- **ADRs:** [0001](../ADRs/0001-organization-aware-data-access.md), [0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md), [0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md), [0015](../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md), [0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md), [0017](../ADRs/0017-standardize-data-grid-list-behaviors.md).
- **Verify:** Findings table recorded; each high-severity finding has a remediation task ID appended to its effort.
- **Notes:****

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | **Resolved 2026-09-27.** Originally placed shared rules in `shared-types`, which has no build and exports raw `.ts`; the compiled API (`node dist/server.js`, `node --test dist/**`) cannot load runtime values from it. The user chose option A: a new built package, `@portfolio-engineering/domain` (T-02.2), consumed by the API (T-03.1) and frontend (T-04.2). | Would have broken API build/test/start while passing under `tsx` dev. | implementation-planner (resolved); governance confirms in T-07.1 | none |
| R-2 | **Resolved 2026-09-27 (not applicable).** No Markdown or WYSIWYG editor exists to extract; per ADR 0012, notes are a plain `Textarea` for direct Markdown and the existing `MarkdownViewer` for display, the same as the Journal. | None. | — | none |
| R-3 | Trading days are Mon–Fri (A11); presets can land on exchange holidays. | Known, accepted; help copy must say so. | uxd (T-06.1) | none; tracked by TD-021/TD-022 |
| R-4 | Status derivation depends on the user's local date. Resolved in Approach: environment timezone (same as Journal); client sends local date; API validates format and a ±1 day window around server UTC date and never uses it for authorization. | Wrong due counts near midnight if mishandled. | backend-coding (T-02.1/T-03.1) | none |
| R-5 | Adding `recharts` increases bundle size (build already warns about a large chunk). | Slower dashboard load. | frontend-coding (consider route-level lazy loading in T-05.5) | none |
| R-6 | **Resolved 2026-09-27.** `PredictionStore.list()` returns `filteredCount` (N, current filters) and `totalCount` (T, all of the caller's organization/user predictions, including voided, independent of filters). | The grid total can disagree with the UX contract. | database-design (T-01.4) | none |
| R-7 | **Resolved 2026-09-27.** `PredictionStore.findWithHistories()` reads amendment, result, and reasoning history using explicit organization/user/prediction scope and returns each in `changedAt` order. | Detail route cannot return complete history without a new scoped store method. | database-design (T-01.4) | none |
| R-8 | **Resolved 2026-09-27.** Store outcome eligibility/date bounds use `@portfolio-engineering/domain`; due list/counts exclude records whose deadline is today. | API would enforce rules that contradict the spec and the frontend preview. | database-design (T-01.4) | none |
| R-9 | **Resolved 2026-09-27 by T-03.4.** `resultChanged` is included in shared list/detail read contracts and mapped from the database store value. | None; list and detail expose the scoped indicator without API-side inference. | backend-coding (T-03.4 complete) | none |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-27 | Initial plan | Created from spec 0009 after the user confirmed A1–A11 and resolved open question 1 (Percent move allows an early Correct). |
| 2026-09-27 | Readiness review (B-1 and five non-blocking findings); user chose option A | Shared rules moved from `shared-types` to a new built package `@portfolio-engineering/domain` (T-02.2 retitled and re-scoped; T-03.1 and T-04.2 add the dependency and pre-build scripts; E-02 exit gate updated; R-1 resolved). T-02.1 Verify made executable (schema cases asserted in T-03.1). Timezone source fixed to the Journal's environment timezone (R-4). Date picker aligned to the UX flow (Popover + Calendar, T-04.1). Frontend file removed from T-01.3 and moved to new T-04.4. T-05.6 reassigned to frontend-coding with new uxd review T-05.7. T-06.1 narrowed to content; wiring split into new T-06.2 (frontend-coding) and T-06.3 (backend-coding). T-07.1 dependencies updated. No task renumbered; no task was done. |
| 2026-09-27 | User decisions on reasoning; editor correction | Reasoning field visible by default and reasoning history for post-grace edits (spec FR 11, FR 19a, AC 12a/12b) added to T-01.1, T-01.2, T-01.3 (fourth backup section), T-03.1, T-05.1, T-05.4. Replaced "owned Markdown editor" and ADR 0007/0008 citations with ADR 0012 (plain `Textarea` + existing `MarkdownViewer`) in the ADR table, Inputs, T-01.1, T-05.1, T-05.2, T-05.4. R-2 resolved as not applicable. No task renumbered; no task was done. |
| 2026-09-27 | Plan review after reasoning decisions | Closed remaining gaps: Summary, Approach (server decides reasoning-history recording), ADR 0012 now binds E-02/E-03; E-01 goal/exit gate name reasoning history; T-01.1 length-bound wording; E-02 exit gate adds FR 18–19a; T-02.1 adds untransformed `reasoning`/notes and detail histories; T-02.2 adds claim-change detection and FR 19a recording rule with boundary tests; E-03 exit gate and T-03.1 add reasoning history and FR 33 search; T-04.4 names all histories; T-06.1 covers reasoning; T-07.1 traces FR 19a, AC 12a/12b, and ADR 0012. No task renumbered, added, or cancelled; no task was done. |
| 2026-09-27 | Execution blockers before T-03.1 (R-6, R-7, store rule drift); user decision on R-6 | Added T-01.4 (database-design) for the scoped history read, filtered N and unfiltered T counts, and FR 23/24/37 alignment with the domain rules. T-03.1 now depends on T-01.4 and maps `confirmAmend` to `confirmAmendment`. R-6 resolved (option a), R-7 assigned to T-01.4, R-8 added. E-01 reopened (4 tasks, 3 done). Amendment authored by implementation-planner and applied by a general-purpose agent. No task renumbered; no done task changed. |
| 2026-09-27 | T-01.4 execution | Added scoped history reads, explicit `filteredCount`/`totalCount` contracts, and canonical domain-rule use for result eligibility/date bounds; corrected due list/count date boundaries. Added database/API domain build wiring and verified database plus API consumers. E-01 is complete; R-7 and R-8 resolved. |
| 2026-09-27 | T-05.3 result-history indicator gap; user chose to resolve it before continuing | Added T-01.5 for the scoped database-derived `resultChanged` value and T-03.4 for shared/API contracts; returned T-05.3 to pending with dependencies and the server-field requirement; added R-9. Amendment authored by implementation-planner and applied by a general-purpose agent. No task renumbered; no done task changed. |
| 2026-09-27 | T-01.5 execution | Added the scoped database `resultChanged` field, transition semantics tests, and live PostgreSQL query evidence. E-01 is complete; the API handoff is recorded under T-01.5 and remains assigned to T-03.4. |
| 2026-09-27 | T-03.4 execution | Exposed `resultChanged` in shared list/detail read contracts and API mapping, verified validation build/lint, API typecheck/lint/tests, and frontend typecheck; R-9 resolved. |
| 2026-09-27 | T-05.3 execution | Implemented the ADR 0017 prediction list using the server-provided `resultChanged` flag; T-05.3 marked done with frontend verification. |
| 2026-09-27 | Plan file accidentally truncated during T-05.4 closeout | Restored from session event history; T-01.5 and T-03.4 sections re-inserted (Notes reconstructed where exact text was unavailable); T-05.4 completion recorded. Damaged copy kept outside the repo. No task scope changed. |
| 2026-09-27 | T-05.6 evidence added T-05.8 (reflow) and T-05.9 (interactive AT and timed checks) | T-05.7 now depends on T-05.6, T-05.8, and T-05.9 so UXD reviews complete evidence. Fixed stray characters in the T-05.8/T-05.9 ADR lines. No task renumbered; no done task changed. |
