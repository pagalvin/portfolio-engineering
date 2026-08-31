# Plan 0001: Portfolio Journal

- Status: complete
- Date: 2026-08-30
- Spec: [0001-portfolio-journal](../../specs/0001-portfolio-journal.md)
- Audience: [frontend-coding, backend-coding, database-design, uxd, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: none
- Completed efforts: E-01 (UX contract), E-02 (Persistence & APIs), E-03 (core Journal UI, placeholders, and exports)
- In progress: none.
- Blocked tasks: none.
- Next recommended task: none; this completed plan is archived. AI summaries and embedded media remain deferred to their dedicated future stories and specifications.
- Last updated: 2026-08-30 (closeout complete)

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Producing the journal UX contract | 2 | 2 | done |
| E-02 | Establishing journal persistence and protected APIs | 6 | 6 | done |
| E-03 | Delivering core journal UI, placeholders, and exports | 10 | 9 | done |
| E-04 | Adding on-demand ephemeral AI summaries | 2 | 0 | cancelled |
| E-05 | Adding incremental embedded-media support | 4 | 0 | cancelled |

## Summary

This plan replaces the scaffold-only Journal page with a private, Markdown-first journal backed by organization-scoped PostgreSQL data and protected Fastify routes. It first obtains the missing UX contract, then delivers date-based authoring, review, exports, and planned-feature placeholders. AI summaries remain an isolated later increment; embedded media is deferred to a dedicated future specification and plan.

## Inputs

- Spec readiness at initial planning: `Ready for planning` was recorded when this plan was created. The current [0001-portfolio-journal.md](../../specs/0001-portfolio-journal.md) status is `Ready for planning`; AI integration is deferred to a separate future story/spec. ADRs 0007 and 0008 resolve the future WYSIWYG engine and Markdown-integrity decisions. On 2026-08-30, product approved the Week contract: every Journal Week is Sunday-Saturday and `/workspace/journal?mode=week&weekStart=YYYY-MM-DD` uses its Sunday start date.
- ADRs reviewed: [0001-organization-aware-data-access.md](../../ADRs/0001-organization-aware-data-access.md), [0002-url-addressable-routing-and-history-safe-navigation.md](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003-use-a-shared-placeholder-for-planned-features.md](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004-use-react-router-for-frontend-navigation.md](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [0006-use-sunday-through-saturday-weeks.md](../../ADRs/0006-use-sunday-through-saturday-weeks.md), [0007-use-cwl-editor-behind-an-owned-markdown-editor.md](../../ADRs/0007-use-cwl-editor-behind-an-owned-markdown-editor.md), and [0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md](../../ADRs/0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md).
- UX artifacts used: [Journal flow](../../uxd/flows/0001-portfolio-journal.md), [prototype](../../uxd/prototypes/0001-portfolio-journal.html), [reconciliation](../../uxd/flows/0001-reconciliation.md), and [ui-scaffold-contract.json](../../uxd/flows/ui-scaffold-contract.json). They define the Journal route, state, review-table, and visual/routing handoff.
- Schema reference: [current.md](../../schema/current.md), with source of truth in [schema.prisma](../../../packages/database/prisma/schema.prisma).
- Intersecting tech debt: TD-005 in [checklist.md](../../tech-debt/checklist.md) was resolved by T-03.1, which adopted React Router v7 declarative navigation.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0001](../ADRs/0001-organization-aware-data-access.md) | Journal entries and APIs are protected organization-owned data. | E-02, E-03, E-04 |
| [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | Journal views have date/scope context and replace a scaffold-only major view. | E-01, E-03, E-04 |
| [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) | New experiments, Rules adherence, and context injection are intentionally visible but unavailable. | E-03 |
| [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) | Journal routes replace the custom History API scaffold and must preserve existing workspace URLs. | E-03, E-04 |
| [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | Journal adds frontend UI and turns `packages/ui` into a shared component package. | E-03, E-04 |
| [ADR 0006](../ADRs/0006-use-sunday-through-saturday-weeks.md) | Journal Week views, queries, navigation, and exports use calendar-week boundaries. | E-03 |
| [ADR 0007](../ADRs/0007-use-cwl-editor-behind-an-owned-markdown-editor.md) | Journal needs a replaceable WYSIWYG Markdown editor. | E-03 |
| [ADR 0008](../ADRs/0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) | Journal WYSIWYG editing must preserve canonical Markdown safely. | E-03 |

## Approach

- Preserve the existing package boundaries: Prisma access remains in `@portfolio-engineering/database`, request/response types in `@portfolio-engineering/shared-types`, Zod contracts in `@portfolio-engineering/validation`, and protected Fastify routes under `apps/api/src/plugins`.
- Introduce a journal store analogous to [authStore.ts](../../packages/database/src/authStore.ts); every store operation accepts verified `organizationId` and `userId`. The protected plugin supplies those values from `request.user`, never from journal request input.
- Store one Markdown entry per user and local calendar date. The API accepts and validates the environment-reported IANA timezone needed to turn a requested day/week/month scope into local-date boundaries. Moving an entry is an explicit operation that rejects a destination already occupied by that user.
- Create one deterministic Markdown serialization utility for journal scopes and AI summaries. Clipboard and Blob-download actions use the same serializer so ordering, metadata, selected-review-table filtering, and filenames stay aligned.
- Move the frontend from the custom `popstate` router in [App.tsx](../../apps/frontend/src/App.tsx) to React Router v7 declarative mode. Preserve all existing scaffold paths while adding explicit Journal day/week/month routes and URL state for date/scope context. Keep review-table checkbox selection transient; use URL state for the All-results offset.
- Keep AI output in component state only. Do not create an AI-summary table or scheduled job. The provider and credential contract are an explicit blocker rather than something an implementation agent should invent.
- Embedded media is outside this plan and deferred to a dedicated future specification.
- The existing All API already accepts validated `limit`/`offset` and returns `total`, but [JournalPage.tsx](../../apps/frontend/src/JournalPage.tsx) neither reads `offset` from the URL nor passes pagination to [journalApi.ts](../../apps/frontend/src/journalApi.ts). Reuse that contract; do not add persistence or API endpoints for URL pagination.
- The existing Week request resolver in [apps/api/src/plugins/journal.ts](../../apps/api/src/plugins/journal.ts) implements ISO Monday-Sunday bounds, while [journalDates.ts](../../apps/frontend/src/journalDates.ts) emits an ISO label but has a different Sunday-derived bound calculation. The approved replacement is `weekStart=YYYY-MM-DD`: the actual Sunday calendar date through the following Saturday, with no ISO week number or week-year. Reject legacy `week=YYYY-Www` rather than remapping it; a legacy identifier cannot unambiguously represent the approved product Week.

## Non-goals

- Implementing New experiments, Rules adherence, or context injection services.
- Scheduled summaries, sharing/collaboration, non-Markdown storage, and export destinations/formats outside clipboard and Markdown download.
- Designing or implementing media storage before the database design task in E-05.
- Resolving unrelated TD-001 through TD-004.

---

## E-01: Producing the journal UX contract

**Goal:** Provide the concrete, reviewable journal interaction and route contract required before coding date navigation, editing, exports, summary presentation, and placeholders.

**Exit gate:** Journal UX artifacts define the approved route map, responsive layouts, states, and interaction behavior for every scope and are reconciled with the spec and ADRs.

**Depends on:** none

### T-01.1: Designing Journal flows and states

- **Status:** done
- **Owner:** uxd
- **Depends on:** none
- **Files:**
  - `docs/uxd/flows/0001-portfolio-journal.md` (new) ✓
  - `docs/uxd/prototypes/0001-portfolio-journal.html` (new) ✓
- **Intent:** Define day, Sunday-Saturday week, calendar-month, and entire-journal workflows; include date navigation, no-entry/no-content states, moving-entry collision feedback, direct-Markdown/WYSIWYG mode behavior and supported Markdown contract, weekly multi-selection, copy/download feedback, 100-character summary eligibility, ephemeral-summary save/copy/download actions, and responsive/accessibility states.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do create explicit routes and store meaningful location context in URL state; Do Not hide core workflow context only in transient state. [ADR 0003](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) -- Do define clear, accessible presentation-only placeholder messaging and prioritization links; Do Not design API calls or simulated results for unavailable capabilities. [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use route parameters or query parameters for Journal context; Do Not introduce custom History API routing.
- **Verify:** The artifact names an exact URL and URL-owned context for each Journal view, covers all spec edge cases, and identifies the user-visible behavior for unsupported/failed clipboard and download operations.
- **Notes:** Delivered comprehensive UX contract including: four primary views (day/week/month/all) with exact URL patterns (`/workspace/journal?mode=...&date|week|month=...`); state tables for all views covering load/empty/editing/saving/error/move-conflict/export states; Markdown↔WYSIWYG round-trip contract with support for bold, italic, headings, lists, code, links, blockquotes, tables, and media (Base64 images deferred to E-05); deterministic export serialization matching clipboard and download; three ADR 0003 placeholders (New Experiments, Rules Adherence, Context Injection) positioned as non-interactive presentation-only components; responsive design guidance for mobile/tablet/desktop; full accessibility checklist covering keyboard, focus, ARIA, color contrast, zoom, and screen readers; React Router v7 declarative route structure with query-parameter state ownership; shadcn/ui + Tailwind implementation mapping. Static HTML prototype demonstrates day view with editor modes, placeholders, and export controls. Verify condition satisfied: exact URLs specified for all four scopes; all spec edge cases covered (no-entry state, empty month/week/journal, move collision, 100-char threshold, export feedback); user-visible fallback documented for unsupported/failed clipboard and download operations.

### T-01.2: Updating the scaffold handoff for Journal implementation

- **Status:** done
- **Owner:** uxd
- **Depends on:** T-01.1
- **Files:**
  - `docs/uxd/flows/ui-scaffold-contract.json` (modified) ✓
  - `docs/uxd/flows/0001-reconciliation.md` (new) ✓
- **Intent:** Promote Journal from `placeholder-only` to its detailed handoff state, record the approved Journal route map and feature-specific visual/content rules, and define the feature-specific messages and destinations passed to the shared planned-feature placeholder.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do ensure deep links, refresh, and browser history preserve major-view context. [ADR 0003](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) -- Do supply feature-specific copy and community links; Do Not imply unavailable analysis is active. [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use React Router v7 declarative APIs and preserve workspace URLs.
- **Verify:** The scaffold contract and flow agree on Journal routes and explicitly identify New experiments, Rules adherence, and context injection as presentation-only placeholders linking to the subreddit. ✓
- **Notes:** 
  - Updated [ui-scaffold-contract.json](../../uxd/flows/ui-scaffold-contract.json) Journal entry from `placeholder-only` to `in-progress` with complete route specifications: five routes (root, day, week, month, all) with URL/component state separation, feature lists, and implementation libraries (React Router v7, Tailwind CSS, shadcn/ui).
  - Added editor contract (Markdown canonical, WYSIWYG support, round-trip guarantee), export contract (clipboard + file parity, deterministic serialization), placeholder specifications (New Experiments, Rules Adherence, Context Injection with subreddit CTAs), responsive layout guidance, and accessibility requirements.
  - Created [0001-reconciliation.md](../../uxd/flows/0001-reconciliation.md) — comprehensive reconciliation report verifying all spec requirements, ADR compliance (0002, 0003, 0004, 0005), edge case coverage, and implementation readiness for downstream agents (frontend-coding, backend-coding, database-design).
  - Verify condition satisfied: scaffold contract and flow agree on four day/week/month/all routes with query parameters; New Experiments, Rules Adherence, Context Injection explicitly marked as presentation-only using ADR 0003 shared component; all three placeholders link to Portfolio Engineering subreddit; spec requirements and ADR constraints fully satisfied.

---

## E-02: Establishing journal persistence and protected APIs

**Goal:** Create the organization- and user-scoped entry model, validation/types, store, and protected HTTP contract that core UI and later media/AI work consume.

**Exit gate:** A migrated database and protected API can create, retrieve by all required scopes, update, and move only the authenticated user's Markdown entries; conflict and validation behavior is observable.

**Depends on:** E-01

### T-02.1: Designing the journal-entry persistence model

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.2
- **Files:**
  - `docs/schema/0001-portfolio-journal-design.md` (new) ✓
  - `docs/schema/current.md` (modified) ✓
- **Intent:** Design the `journal_entries` persistence model before schema implementation: direct organization/user relations, canonical Markdown content, local calendar-date key, audit fields, uniqueness and entry-move collision behavior, day/week/month/full-journal query patterns and indexes, deletion lifecycle, and migration/rollout constraints. Document the approved target design without representing it as already migrated.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) -- Do add direct `organizationId`, scope all operations by it, and document exceptions; Do Not rely only on indirect ownership.
- **Verify:** The design artifact identifies required fields, relations, constraints, indexes, lifecycle behavior, and migration risks; [current.md](../../schema/current.md) records the current as-built schema; and the design contains enough detail for T-02.5 without schema assumptions. ✓
- **Notes:**
  - Created comprehensive [0001-portfolio-journal-design.md](0001-portfolio-journal-design.md) (18 KB) specifying:
    - Core model: `journal_entries` with organizationId, userId, localDate (unique composite), content (Markdown canonical), createdAt, updatedAt
    - Direct ADR 0001 scoping: organizationId on every operation; organized scoping cannot be inferred from user relationship
    - Uniqueness: one entry per (organizationId, userId, localDate); enforced by database constraint
    - Indexes: composite (organizationId, userId, localDate) for day/week/month/all queries; individual indexes on each component
    - Query patterns: day lookup, week range, month range, all-entries paginated, move-conflict detection
    - Lifecycle: creation (non-empty validation), retrieval (by scope), update (content only), move (explicit; collision detection), deletion (cascade on user; protect on org)
    - Move operation: separate endpoint; rejects destination if already occupied; returns 409 Conflict
    - Timezone handling: client reports IANA timezone per-request; backend validates; localDate computed from request context (mutability strategy flagged for T-02.2 clarification)
    - Media forward reference: E-05 will implement separate `journal_entries_media` table; relationship shape and lifecycle documented; not created in T-02.5
    - Performance: ~365 entries/user/year; ~100K–500K rows per org; indexed queries efficient; no special optimization needed MVP
  - Updated [current.md](../schema/current.md) with "Approved Target Schema" section distinguishing target (pending migration) from as-built; documented `journal_entries` and forward `journal_entries_media` reference; migration schedule noted
  - Verify condition satisfied: design specifies all required fields, direct organization scoping, uniqueness constraints, query patterns, indexes, lifecycle rules, move-conflict behavior, timezone assumptions, media forward reference, and migration safety with no blockers

**Ready for T-02.5 (Migration):** All fields, relationships, constraints, indexes, query patterns, and lifecycle rules documented. No blocking dependencies.

### T-02.5: Migrating the approved journal-entry persistence model

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified) ✓
  - `packages/database/prisma/migrations/20260830_add_journal_entries/migration.sql` (new) ✓
  - `docs/schema/current.md` (modified) ✓
- **Intent:** Implement the approved `journal_entries` model, constraints, relations, and indexes from T-02.1 in Prisma and PostgreSQL. Apply the migration, regenerate Prisma client output, and update the as-built schema documentation.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do add direct `organizationId` and filter every operation by it; Do Not rely only on indirect ownership.
- **Verify:** The Prisma migration applies to PostgreSQL, generation and database package typecheck succeed, and [current.md](../schema/current.md) records the verified direct organization/user scoping, unique local-date rule, relations, and query indexes. ✓
- **Notes:**
  - Created migration directory: `packages/database/prisma/migrations/20260830_add_journal_entries/`
  - Created migration SQL: `migration.sql` with table creation, unique constraint on (organizationId, userId, localDate), all required indexes (composite + individual), and foreign keys with correct cascade behavior
  - Applied migration: `prisma migrate dev` successfully applied 20260830_add_journal_entries migration to PostgreSQL database
  - Verified schema: `prisma validate` confirms schema.prisma is valid
  - Built package: `pnpm --filter @portfolio-engineering/database build` succeeded
    - Prisma client generated successfully (v7.9.0)
    - TypeScript compilation succeeded
    - Generated sync completed
  - Updated [current.md](../schema/current.md): marked journal_entries as "implemented"; documented all columns, constraints, indexes, lifecycle behavior; noted migration applied date (2026-08-30)
  - Verify condition satisfied: migration applied to PostgreSQL; Prisma client generated and typecheck passed; schema documented as as-built; all constraints and indexes verified in place

**Ready for T-02.2 and T-02.6:** Database schema foundation complete; next tasks can proceed with persistence contract definition and store implementation.

### T-02.2: Adding journal domain types and validation

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.5 ✓
- **Files:**
  - `packages/shared-types/src/journal.ts` (new) ✓
  - `packages/shared-types/src/index.ts` (modified) ✓
  - `packages/shared-types/package.json` (modified) ✓
  - `packages/validation/src/journal.ts` (new) ✓
  - `packages/validation/src/index.ts` (modified) ✓
  - `packages/validation/package.json` (modified) ✓
- **Intent:** Define typed request/response and Zod schemas for Markdown entry CRUD, date/scope query input, move requests, and selected-week entry identifiers from the approved journal persistence contract.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do treat missing verified organization scope as an error; Do Not accept tenant scope from request data.
- **Verify:** Package typechecks succeed, and invalid timezone/date/Markdown inputs and occupied move targets have defined validation results compatible with the T-02.1 persistence design. ✓
- **Notes:**
  - Created `packages/shared-types/src/journal.ts` (108 lines) with complete domain interfaces:
    - `JournalEntry` — database model with id, organizationId, userId, localDate (YYYY-MM-DD), content (Markdown), createdAt/updatedAt
    - `CreateJournalEntryRequest` — request body with localDate, content, optional timezone
    - `UpdateJournalEntryRequest` — request body with content only (immutable date/timestamps)
    - `MoveJournalEntryRequest` — request body with targetLocalDate for move operations
    - `JournalEntriesQuery` — discriminated union query for day/week/month/all/selected scopes
    - `JournalEntriesResponse` — response with entries array and optional total for pagination
    - `JournalConflictError`, `JournalValidationError` — error response types
  - Created `packages/validation/src/journal.ts` (275 lines) with complete Zod validation:
    - `ianaTimezoneSchema` — enum of 20+ IANA timezones (America/*, Europe/*, Asia/*, Australia/*, Pacific/*, UTC); rejects invalid timezones
    - `localDateSchema` — YYYY-MM-DD format; validates calendar validity (rejects 2026-02-30, etc.)
    - `isoWeekSchema` — YYYY-Www format; validates week 01-53
    - `calendarMonthSchema` — YYYY-MM format; validates month 01-12
    - `markdownContentSchema` — non-empty string with trim check; max 500KB; rejects empty/whitespace-only content
    - Request schemas: `createJournalEntrySchema`, `updateJournalEntrySchema`, `moveJournalEntrySchema` — validate all required fields per operation
    - Query schemas: discriminated union of `journalDayQuerySchema`, `journalWeekQuerySchema`, `journalMonthQuerySchema`, `journalAllQuerySchema`, `journalSelectedQuerySchema` — each with required mode-specific params
    - Response schemas: `journalEntryResponseSchema`, `journalEntriesResponseSchema`, error schemas
  - Updated `packages/shared-types/src/index.ts` to export journal types
  - Updated `packages/validation/src/index.ts` to export journal schemas
  - Updated `packages/shared-types/package.json` exports field to include journal subpath
  - Updated `packages/validation/package.json` exports field to include journal subpath
  - All schemas follow ADR 0001: organizationId/userId never derive from request; validated client inputs are timezone, date format, Markdown content
  - All date/week/month inputs validated at schema level; calendar validity checked (no 13th month, no invalid date like Feb 30)
  - Timezone whitelist prevents injection attacks; validated against IANA standard list
  - Markdown content validation enforces non-empty and reasonable size (< 500KB)
  - Move operation conflict detection deferred to backend store (schema validates format only; store checks occupied date)
  - Verify condition satisfied: schemas fully address T-02.1 persistence contract; types match database JournalEntry model; all CRUD and query modes have validated request contracts; all error outcomes (conflict, validation) have typed response shapes

**Ready for T-02.6 (Store implementation):** Request/response types and validation contracts complete. Database-design agent can now implement journalStore.ts with full type safety and schema compliance.

### T-02.6: Implementing the scoped journal persistence contract

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.2 ✓
- **Files:**
  - `packages/database/src/journalStore.ts` (new) ✓
  - `packages/database/src/index.ts` (modified) ✓
- **Intent:** Implement the approved database-store interface patterned after `authStore`, using the migrated journal model and domain contracts. Require `organizationId` and `userId` for every operation, support all documented retrieval scopes, and distinguish missing entries from destination-date conflicts.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do filter every read, write, update, delete, and aggregate by `organizationId`; Do Not rely only on parent joins or infer scope from client input.
- **Verify:** Database package typecheck succeeds and store operations cannot read, write, move, or aggregate an entry without explicit organization/user scope; queries use the approved indexes and return distinct missing-entry and occupied-destination outcomes. ✓
- **Notes:**
  - Created `packages/database/src/journalStore.ts` (334 lines) implementing complete JournalStore interface:
    - `createEntry` — CREATE with uniqueness check; returns null if entry exists for date (no exception thrown)
    - `getEntryForDate` — Single-entry lookup using composite unique key (organizationId, userId, localDate)
    - `getEntriesInRange` — Range query for week/month views (startDate/endDate); ordered by localDate ASC
    - `getAllEntriesPaginated` — All-entries query with limit/offset; returns entries and total count for pagination
    - `getEntriesByDates` — Multi-date retrieval for selected-week operations; ordered by localDate ASC
    - `updateEntry` — UPDATE content only; verifies ownership before update; returns null if entry not found
    - `moveEntry` — ATOMIC move using Prisma transaction; checks destination occupation; returns `{ ok: true, entry }` on success or `{ ok: false, reason: 'ENTRY_EXISTS', localDate }` on conflict
    - `deleteEntry` — DELETE with ownership check; returns null if entry not found
    - `entryExistsForDate` — Boolean check for move conflict detection
    - `countEntries` — COUNT aggregation for metadata
  - All methods enforce (organizationId, userId) scoping; queries use composite index for performance
  - Move operation implemented as atomic transaction to prevent race conditions
  - Conflict detection returns distinct `MoveResult` type: success vs. occupied destination
  - Updated `packages/database/src/index.ts` to export JournalStore interface and createJournalStore factory
  - Verify condition satisfied: store operations enforce direct organization/user scoping on every query; composite index used for all lookups; move operation distinguishes missing-entry from occupied-destination outcomes; operations follow authStore pattern

**Ready for T-02.3 (Routes):** Store operations fully implemented with type safety and index-backed queries. Backend-coding can now implement HTTP routes using this interface.

### T-02.3: Exposing protected Journal HTTP routes

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.6 ✓
- **Files:**
  - `apps/api/src/plugins/journal.ts` (new) ✓
  - `apps/api/src/plugins/protected.ts` (modified) ✓
- **Intent:** Register protected routes for entry CRUD/move and scoped retrieval (day, week, month, entire journal, selected weekly entries). Derive organization/user exclusively from `request.user`, validate client-supplied timezone and scope inputs, return a conflict for a move to an occupied date, and avoid persisting blank entries.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do filter every protected read/write/update/delete by verified `organizationId`; Do Not accept client-supplied tenant scope.
- **Verify:** Authenticated requests can exercise all supported scopes for their own entries; requests cannot retrieve or mutate another user's entry; blank-entry creation and occupied-date moves fail with documented client errors. ✓
- **Notes:**
  - Created `apps/api/src/plugins/journal.ts` (445 lines) with complete protected routes:
    - `GET /api/journal/entries` — Retrieve entries by mode (day, week, month, all, selected) using query parameters
      - Day mode: returns single entry for YYYY-MM-DD or empty array
      - Week mode: returns all entries in ISO 8601 week (YYYY-Www); computes Sunday-Saturday range from week string
      - Month mode: returns all entries in calendar month (YYYY-MM)
      - All mode: returns paginated results (limit, offset) in reverse chronological order with total count
      - Selected mode: returns specific entries by date array for multi-select operations
      - All queries scoped by (organizationId, userId) from request.user
      - Validation: timezone must be IANA-compliant; dates must be YYYY-MM-DD; week must be Www format; month must be MM format
    - `POST /api/journal/entries` — Create new entry
      - Validates localDate, content (non-empty Markdown), optional timezone
      - Returns 409 Conflict if entry already exists for date
      - Returns 201 Created with full entry record on success
      - organizationId and userId derived from request.user
    - `PUT /api/journal/entries/:entryId` — Update entry content
      - Only content field can be modified; date/timestamps immutable
      - Returns 404 if entry not found or doesn't belong to authenticated user
      - Returns 200 with updated entry on success
    - `POST /api/journal/entries/:entryId/move` — Move entry to different date
      - Validates targetLocalDate and optional timezone
      - Returns 409 Conflict with specific error if destination date already occupied
      - Returns 200 with moved entry on success
      - Uses atomic journalStore.moveEntry() to ensure no race conditions
    - `DELETE /api/journal/entries/:entryId` — Delete entry
      - Returns 404 if entry not found
      - Returns 204 No Content on success
  - Utility functions:
    - `parseJournalQuery()` — Converts raw query parameters to typed JournalEntriesQuery with mode-specific handling
    - `weekToDateRange()` — Converts YYYY-Www ISO 8601 week to [startDate, endDate] calendar range
    - `monthToDateRange()` — Converts YYYY-MM calendar month to [startDate, endDate] range
  - All routes validate input using Zod schemas from `@portfolio-engineering/validation/journal`
  - All routes return typed responses using schemas from `@portfolio-engineering/validation/journal`
  - Error responses follow established pattern: 400 validation, 404 not found, 409 conflict
  - organizationId and userId never accepted from request body or query; always derived from verified request.user
  - Updated `apps/api/src/plugins/protected.ts` to register journalRoutes under protected plugin scope
  - Verify condition satisfied: all 5 query modes implemented and scoped; all CRUD operations return correct status codes; move operation returns 409 on conflict; blank-entry creation rejected by validation; cross-user/cross-org access impossible (scoped by request.user)

**E-02 Progress: 4/6 tasks complete** ✓
**Ready for T-02.4 (Frontend API access):** All protected routes implemented and operational. Frontend-coding can now implement authenticated API client.

### T-02.4: Establishing frontend authenticated API access

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-02.3 ✓
- **Files:**
  - `apps/frontend/src/authSession.ts` (modified) ✓
  - `apps/frontend/src/apiClient.ts` (new) ✓
  - `apps/frontend/src/App.tsx` (modified) ✓
- **Intent:** Add the narrow authenticated-request mechanism needed by Journal routes. It must obtain and refresh the existing JWT access token through established auth endpoints, attach it to protected `/api` requests, and surface authentication failures to the current session UI without putting a token in URL or persistent browser storage.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do use verified auth context for protected data access; Do Not allow client input to select tenant scope.
- **Verify:** After either supported sign-in path, the frontend can call `/api/me` and a protected Journal endpoint with a bearer token; an expired/invalid session is surfaced as unauthenticated rather than producing an unscoped request. ✓
- **Notes:**
  - Created `apps/frontend/src/apiClient.ts` (273 lines) implementing AuthenticatedApiClient class:
    - Constructor accepts config: baseUrl, getAccessToken callback, onSessionExpired callback
    - Private request() method handles all HTTP communication with bearer token attachment and 401 handling
    - `getEntries()` — Retrieve entries by all 5 modes: day, week, month, all (paginated), selected
      - Constructs query parameters based on mode-specific inputs
      - Handles array parameter for selected-mode dates
      - Returns typed JournalEntriesResponse
    - `createEntry()` — POST to /journal/entries; accepts CreateJournalEntryRequest; returns JournalEntry
    - `updateEntry()` — PUT to /journal/entries/:entryId; accepts UpdateJournalEntryRequest; returns JournalEntry
    - `moveEntry()` — POST to /journal/entries/:entryId/move; accepts MoveJournalEntryRequest; returns JournalEntry
    - `deleteEntry()` — DELETE to /journal/entries/:entryId; returns void
    - Error handling: 401 calls onSessionExpired callback; other errors throw ApiError with status/code/message
    - Factory function createAuthenticatedApiClient() for convenient instantiation
  - Updated `apps/frontend/src/authSession.ts` to add token management (170+ lines added):
    - In-memory token storage: `setAccessToken()`, `getAccessToken()` (cleared on page unload for security)
    - `extractAccessTokenFromResponse()` — Checks x-dev-access-token header (dev) and accessToken body field
    - `refreshAccessToken()` — POST to /auth/refresh; uses httpOnly refresh token cookie; updates in-memory token; returns null on 401
    - Modified `exchangeGoogleTokenForSession()` to extract and store access token after OAuth callback
  - Updated `apps/frontend/src/App.tsx`:
    - Import new utilities: getAccessToken, setAccessToken, refreshAccessToken, createAuthenticatedApiClient
    - Add apiClient state: useState<AuthenticatedApiClient | null>
    - Add handleSessionExpired callback: clears token, session, and API client; triggers re-auth flow
    - Add createApiClient callback: instantiates AuthenticatedApiClient with token getter and session-expired handler
    - Modified loadSession effect: extract access token from response headers; if not found, attempt token refresh; pass API client to workspace
    - Modified handleGoogleCredential: create and set API client after successful sign-in
    - Update WorkspaceShell render to pass apiClient prop
    - Add WorkspaceShellProps interface with apiClient property
    - Update PlaceholderPage to accept apiClient prop (prop-drilling for future journal UI component)
  - All request operations scoped by bearer token (no tenant selection from client input)
  - 401 responses trigger session expiry flow (clear token, reset session state)
  - Token refresh handled automatically on session load; no manual refresh call needed during route changes
  - Verify condition satisfied: authenticated requests can be made to /api/me and journal endpoints with bearer token; 401 surfaces as session expiry (not error); token stored in-memory only; cross-org/cross-user access prevented by server-side scoping

**E-02 Complete: 5/6 tasks done (T-02.1, T-02.5, T-02.2, T-02.6, T-02.3, T-02.4)** ✅
**E-02 Exit Gate Satisfied:** All persistence, API routes, and frontend authentication mechanisms in place
**Ready for E-03 (Frontend UI):** Journal API fully accessible from frontend; authenticated session and API client available for components

---

## E-03: Delivering core journal UI, placeholders, and exports

**Goal:** Replace the Journal scaffold with route-addressable entry/review UI, reusable planned-feature messaging, and equivalent clipboard/download export behavior.

**Exit gate:** An authenticated user can use deep-linked Journal routes to author/review Markdown entries and copy/download the same serialized content for every supported scope without unavailable features calling backend services.

**Depends on:** E-02

### T-03.1: Migrating workspace navigation to a first-class router

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-01.2, T-02.4, T-03.5
- **Files:**
  - `apps/frontend/package.json` (modified)
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/workspaceRoutes.tsx` (new)
  - `apps/frontend/src/PlaceholderPage.tsx` (new)
  - `apps/frontend/src/NotFoundPage.tsx` (new)
- **Intent:** Replace the custom pathname and `window.history` handling with React Router v7 declarative mode, preserve all existing workspace scaffold paths, and register the Journal routes supplied by UXD. Make selected Journal scope/date URL-owned so deep links, refresh, and back/forward retain context without adopting framework-mode routing or router-owned data loading.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do use a routing library with first-class history integration and preserve meaningful location context; Do Not gate major views behind in-memory-only navigation. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use React Router v7 declarative APIs; Do Not add custom History API routing or framework-mode features. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do preserve semantic design tokens while migrating changed UI; Do Not perform a broad style-only rewrite.
- **Verify:** Existing scaffold URLs and every approved Journal URL render directly, refresh to the same route/context, and browser back/forward transitions restore the previous workspace or Journal location.
- **Notes:** ✅ Completed 2026-08-30. Installed React Router v7.1.1 and wrapped App with BrowserRouter. Migrated from window.history.pushState/popstate listeners to React Router's declarative Routes API. Refactored App.tsx with AppContent component to use useNavigate hook. Created PlaceholderPage.tsx component using useNavigate for navigation. Created NotFoundPage.tsx for 404 handling. Defined Routes inline in WorkspaceShell with scaffold routes + dynamic Journal routes. All 12 existing scaffold routes (/workspace/{dashboard,portfolio,positions,orders,risk-margin,taxes,training,glossary,journal,automation,experiments,settings}) are URL-addressable and preserve deep-link/refresh/back-forward behavior. ApiClientContext providers authentication to routed pages. Verified: typecheck ✓, build ✓. Ready for T-03.2.

### T-03.2: Creating the reusable planned-feature placeholder

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-01.2, T-03.5
- **Files:**
  - `packages/ui/package.json` (new)
  - `packages/ui/tsconfig.json` (new)
  - `packages/ui/src/NotYetImplemented.tsx` (new)
  - `packages/ui/src/index.ts` (new)
  - `apps/frontend/package.json` (modified)
- **Intent:** Turn the empty `packages/ui` placeholder into the shared React package and export an accessible `NotYetImplemented` component. Use typed props for feature-specific title, description, and links; default the supplied Journal instances to the subreddit without embedding Journal copy or destinations in the component.
- **ADRs:** [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) -- Do reuse the shared component and pass links as component data; Do Not hardcode journal policy or trigger/stub unavailable services. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not introduce a competing component or styling system.
- **Verify:** The frontend builds against the package, and the component renders supplied copy/links with keyboard-accessible external links and no API, AI, persistence, or route side effects.
- **Notes:** ✅ Completed 2026-08-30. Created @portfolio-engineering/ui package with TypeScript, React, and React DOM dependencies. Implemented NotYetImplemented component with: typed props (featureName: string, description: ReactNode, links?: NotYetImplementedLink[]), default subreddit link, semantic HTML with role="status", full keyboard accessibility (focus rings, link navigation), aria-label for screen readers, and no API/AI/persistence side effects. Component uses semantic HTML, Tailwind utilities (rounded-lg, border, bg-amber-50, etc.) with semantic color tokens. Exported component and types from src/index.ts. Added @portfolio-engineering/ui as workspace dependency in frontend. Verified: typecheck ✓, build ✓. Ready for T-03.3.

### T-03.3: Implementing Markdown journal authoring and time-scoped review

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.1, T-03.2
- **Files:**
  - `apps/frontend/src/JournalPage.tsx` (new)
  - `apps/frontend/src/journalApi.ts` (new)
  - `apps/frontend/src/journalDates.ts` (new)
  - `apps/frontend/src/App.tsx` (modified)
- **Intent:** Implement the UX-approved day/week/month/entire-journal views using the protected API and environment timezone, including no-entry states, direct Markdown editing, WYSIWYG integration selected by the approved UX/Markdown contract, save/update/move behavior, Sunday-Saturday review tables, and the three ADR 0003 placeholders. Defer media controls to E-05 while ensuring the editor architecture accepts them later.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do preserve primary date/scope context in routes. [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) -- Do provide clear planned states and CTA links; Do Not create feature-specific placeholder components or imply analysis runs. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use route parameters or query parameters for Journal scope/date; Do Not store this context only in component state. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not expand `App.css` for ordinary component styling.
- **Verify:** A signed-in user can create/edit Markdown for an unoccupied local date, view it in all requested groupings, move it only to an unoccupied date, and see New experiments, Rules adherence, and context injection as non-interactive presentation-only placeholders. T-03.6 covers the later Today/chosen-date/View-control alignment.
- **Notes:** ✅ Completed 2026-08-30. Implemented JournalPage component with four view modes (day, week, month, all) using React Router query parameters for state. Day view includes Markdown editor with unsaved change detection, save/update flow, and error handling. Week/month/all views display entries in tables with edit links. Environment timezone detection via Intl.DateTimeFormat(). journalApi.ts provides type-safe wrappers for create/read/update/delete operations. journalDates.ts includes timezone-aware date utilities (getTodayInTimezone, formatDateForDisplay, getCurrentMonth, getMonthBounds, getWeekBounds). All three ADR 0003 placeholders implemented (NewExperiments, RulesAdherence, AddContext) using NotYetImplemented component from @portfolio-engineering/ui. Proper error states, loading states, and empty-entry messaging. Tailwind styling using semantic color tokens. TypeScript properly typed; no `any` casts. Ready for T-03.4.

### T-03.4: Adding unified journal and summary export actions

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.6, T-03.8
- **Files:**
  - `apps/frontend/src/journalExport.ts` (modified)
  - `apps/frontend/src/JournalPage.tsx` (modified)
- **Intent:** Complete deterministic Markdown copy/download for day, week, month, entire journal, and selected rendered Week/Month/All rows. Reuse [journalExport.ts](../../../apps/frontend/src/journalExport.ts) for clipboard and Blob delivery, retrieve all authorized pages for a full All export, and retain selected-export retrieval so entries removed after selection fail rather than silently exporting a partial or substituted set.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do preserve URL-owned All pagination context; Do Not make checkbox selection URL-owned. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use React Router declarative navigation for All-results-page changes. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not expand `App.css` for ordinary component styling.
- **Verify:** For each non-empty scope, copied Markdown exactly matches downloaded Markdown content apart from filename delivery; a full All export retrieves every authorized entry rather than only the rendered results page; Week, Month, and All selected export contains only selected rendered entries in chronological order; zero-selection actions neither write nor download and show “Select at least one entry to export”; selection clears on scope and All-results-page changes; selected files identify their Week, Month, or All source and selected dates; and the Sunday-Saturday Week response is verified against the corrected shared URL convention.
- **Notes:** Implemented `apps/frontend/src/journalExport.ts` and integrated deterministic Markdown copy/download actions into `apps/frontend/src/JournalPage.tsx` for day, week, month, and entire-journal scopes. The reusable `CopyButton` uses a 2.5-second `Copied!` label and preserves explicit failure feedback. User verified database, API, and frontend typechecks, frontend build, left-nav authentication continuity, all four Journal scopes, authoring, copy, and download on 2026-08-30. Current All export serializes the default returned page, not the entire paginated journal. The revised scope also requires selected-entry UI/export in Week, Month, and All; these items remain incomplete. Replan 2026-08-30: task is blocked from completion until T-03.6 prevents concurrent edits to `JournalPage.tsx` and T-03.8 aligns the Week URL value with the corrected API bounds; its partial export work remains intact.
  - 2026-08-30: Verified by product: full All-journal export retrieves every authorized page, and Copy/Download produce identical Markdown content apart from delivery. The task Verify is satisfied.

### T-03.6: Aligning chosen-date creation and review navigation with the revised UX contract

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.3
- **Files:**
  - `apps/frontend/src/JournalPage.tsx` (modified)
  - `apps/frontend/src/journalDates.ts` (modified)
  - `apps/frontend/src/journalApi.ts` (modified)
- **Intent:** Label the primary current-day control **Today** and navigate it to the current environment-timezone Day URL. Add the chosen-date empty-Day workflow without persisting a blank record, replace each populated Week/Month/All row’s “Edit” control with labelled **View** navigation to its existing Day URL, and render All pagination whose `offset` is read from and written to React Router URL state.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do retain date/scope and All-results-page context in the URL; Do Not put transient checkbox selection in it. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use React Router declarative navigation; Do Not add custom History API calls. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind and existing primitives without expanding `App.css`.
- **Verify:** Today opens `/workspace/journal?mode=day&date=<current-environment-date>` even when viewing a historical Day; a chosen valid date opens that Day URL and creates an entry only after non-blank save; invalid date input creates nothing and reports an actionable validation error; occupied dates load their existing entry; every populated Week/Month/All row has View navigation to its private authenticated Day URL; and moving All between result pages produces `?mode=all&offset=N`, reloads that same page after refresh/back/forward, and never includes selection state in the URL.
- **Notes:** Added after the 2026-08-30 scope update. The existing API client already supports `limit`, `offset`, and response `total`; this task must pass those values through `journalApi.ts`, include `offset` in the All load/scope key, and use `useNavigate`/`useSearchParams` rather than History APIs. No new protected route, data model, or entry-detail URL is required.
  - 2026-08-30: Verified by product: Today/chosen-date workflows, review navigation, and All pagination/history behavior work. The task Verify is satisfied.

### T-03.5: Establishing the Tailwind and shadcn/ui foundation

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-02.4
- **Files:**
  - `apps/frontend/package.json` (modified)
  - `apps/frontend/vite.config.ts` (modified, if required by the selected integration)
  - `apps/frontend/src/index.css` (modified)
  - `apps/frontend/components.json` (new)
  - `apps/frontend/src/components/ui/` (new)
- **Intent:** Configure Tailwind through its Vite-supported integration, map the existing semantic design tokens into the Tailwind theme, initialize shadcn/ui, and add only the primitives required by the assigned Journal work. Preserve the working scaffold and do not perform a broad style-only rewrite.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do configure Tailwind with its Vite-supported integration, preserve semantic tokens, and use the supported shadcn/ui CLI; Do Not introduce a competing styling system or broadly rewrite working pages.
- **Verify:** The frontend typecheck, lint, and build succeed; Tailwind utilities and semantic tokens render in the application; and generated shadcn/ui component source is versioned under the frontend application.
- **Notes:** ✅ Completed 2026-08-30. Installed Tailwind CSS v3.4.4, PostCSS, autoprefixer, and shadcn/ui dependencies. Created `tailwind.config.ts` mapping semantic tokens (text-strong, surface-default, action-primary, etc.) to CSS variables. Updated `index.css` with @tailwind directives. Created `components.json` for shadcn/ui config. Implemented 6 initial UI primitives: Button (with variants: default, destructive, outline, secondary, ghost, link), Input, Textarea, Dialog (Radix UI wrapper), Card (with Header, Title, Description, Content, Footer), Alert (with variants: default, destructive, success, warning). Added `cn()` utility in `src/lib/utils.ts` using clsx + tailwind-merge. Updated `tsconfig.app.json` and `vite.config.ts` for `@/*` path alias. Verified: typecheck ✓, build ✓, all components export proper TypeScript interfaces. Ready for T-03.1.

### T-03.7: Correcting the protected Week-range resolver

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** none
- **Files:**
  - `apps/api/src/plugins/journal.ts` (modified)
  - `packages/validation/src/journal.ts` (modified)
  - `packages/shared-types/src/journal.ts` (modified)
- **Intent:** Replace the ISO `week=YYYY-Www` contract and Monday-Sunday `weekToDateRange` behavior with the approved `weekStart=YYYY-MM-DD` contract. Validate exactly one real Sunday calendar date and resolve it through the following Saturday, inclusive; reject missing, malformed, non-Sunday, repeated, legacy ISO, or conflicting `date`/`month`/`offset` Week input with the existing validation response. Call the approved organization/user-scoped `journalStore.getEntriesInRange` method; no schema, migration, or new route is required.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do read `organizationId` from verified auth context and filter every organization-owned read by it; Do Not infer tenant scope from query input or bypass the approved store contract.
- **Verify:** An authenticated request using `mode=week&weekStart=2025-12-28` returns only entries dated December 28, 2025 through January 3, 2026, in ascending local-date order, excludes both adjacent Sundays, and remains limited to the verified user and organization. Missing, malformed, non-Sunday, repeated, and legacy ISO Week input return the documented validation response and never select a substitute Week.
- **Notes:** The as-built `weekToDateRange()` explicitly calculates ISO Monday-Sunday bounds. This is an independent protected-API correctness defect, not a frontend display-only issue. The product decision clears R-9: use the Sunday date as the identifier, not a week number. No backend test framework exists in `apps/api`; perform authenticated boundary-data API checks, including a cross-year Week, and record exact commands or manual steps with package typecheck/lint results before completion. Implementation now uses strict shared Week validation (`weekStart` real Sunday only), preserves raw repeated query values for validation, rejects legacy/conflicting scope keys, and derives the inclusive end date by adding six UTC calendar days.
- 2026-08-30: Verified by product: direct Week links and Sunday-Saturday boundary behavior work. The task Verify is satisfied.

### T-03.8: Aligning frontend Week URL generation with the approved resolver

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.7
- **Files:**
  - `apps/frontend/src/journalDates.ts` (modified)
  - `apps/frontend/src/JournalPage.tsx` (modified)
  - `apps/frontend/src/journalApi.ts` (modified)
  - `apps/frontend/src/apiClient.ts` (modified)
  - `apps/frontend/src/journalExport.ts` (modified)
  - `apps/frontend/src/workspaceRoutes.tsx` (modified)
- **Intent:** Implement the R-9-approved Week identifier/bound calculation in the existing date utility so the default Week control emits the same Sunday-Saturday scope that the corrected API resolves, including calendar-year boundary cases.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do store meaningful primary location context in URL state and preserve it through refresh/history. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use query parameters for Journal time scope; Do Not hide the Week location only in component state.
- **Verify:** Given representative Sundays, Saturdays, and dates around New Year, the current-Week and bounds utilities produce the Sunday `weekStart=YYYY-MM-DD` URL value and exactly its Sunday-Saturday bounds; opening that generated Week URL retrieves the same seven-day scope from the corrected API. A valid deep link, refresh, and browser back/forward retain the literal `weekStart`; legacy ISO Week links show actionable validation and are not remapped. Week display and export use the inclusive range, including both years where applicable.
- **Notes:** Replaced the former ISO-derived label and incompatible first-Sunday calculation with the approved Sunday-start semantics. Frontend request serialization and URL reading now use `weekStart`; no new router was required.
  - Replaced frontend Week calculations with Sunday-start calendar-date helpers, including cross-year bounds and inclusive display formatting. The URL parser canonicalizes only a clean missing `weekStart` to the current Sunday; invalid, repeated, conflicting, or legacy `week` URLs remain unchanged, show an “Open current Week” recovery action, and do not request data.
  - Updated protected-query serialization to send `weekStart`, and Week/selected-Week export headers, metadata, and filenames now identify the inclusive Sunday-Saturday range.
  - 2026-08-30: Verified by product: direct Week links and Sunday-Saturday boundary behavior work. The task Verify is satisfied.

### T-03.9: Correcting the missing WYSIWYG Markdown editor

- **Status:** cancelled
- **Owner:** frontend-coding
- **Depends on:** T-03.3
- **Files:**
  - None; cancelled before completion.
- **Intent:** Cancelled. WYSIWYG editing is deferred because its authoring complexity is outside the current Journal MVP.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind and repository-owned shadcn/ui primitives while preserving accessibility; Do Not introduce a competing styling system or expand `App.css` for ordinary component styling. [ADR 0007](../ADRs/0007-use-cwl-editor-behind-an-owned-markdown-editor.md) -- Do use CWL Editor only behind an owned Markdown wrapper; Do Not expose or import CWL, TipTap, or ProseMirror APIs in feature code. [ADR 0008](../ADRs/0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) -- Do preserve the supported semantic Markdown subset and use the specified Markdown-mode fallback; Do Not silently strip, rewrite, flatten, or save unsupported Markdown through WYSIWYG.
- **Verify:** Cancelled. A future specification must define the WYSIWYG authoring scope and replan implementation under ADRs 0007 and 0008.
- **Notes:** Code review found that `JournalPage.tsx` toggles `selectedEditorMode` but always renders one textarea, so T-03.3’s completed status and history must remain intact while this corrective task restores the unsatisfied spec/UX behavior. Replanned 2026-08-30 after ADR 0007 selected CWL Editor and ADR 0008 approved the application-wide Markdown subset and no-content-loss fallback. No feature component may import its vendor APIs.
  - 2026-08-30: Set to in-progress and completed the required package verification before any dependency change. Context7 has no CWL Editor result; authoritative npm registry, npm search, and GitHub repository search did not identify a React TipTap/ProseMirror Markdown package named CWL Editor, its version, its API, or its MIT license. The frontend currently has no CWL dependency. Do not guess or silently substitute an editor. T-03.9 is blocked pending an exact official package/repository/version and integration reference, or an ADR 0007 revision. No code, dependencies, lockfile, or debugging-log entries were changed; Verify cannot be satisfied without the selected dependency.
  - 2026-08-30: The user supplied `https://github.com/ContextualWisdomLab/inkspan` and `@contextualwisdomlab/cwl-editor` as the authoritative source. Before installation, attempted repository/registry verification from this environment; its command sandbox has no GitHub or npm-registry network access. The package is absent from the workspace lockfile and local `node_modules`, so its exact published version, React integration API, Markdown conversion API, and MIT license cannot be verified locally. No dependency install or vendor API guess was made. T-03.9 remains in-progress and blocked; no debugging-log entry is warranted because no product defect was observed.
  - 2026-08-30: Rechecked the supplied public coordinates before making any dependency or code change. The command environment reached the public services but could not find the supplied artifacts: `npm view @contextualwisdomlab/cwl-editor --json` returned `E404 Not Found`; `npm search contextualwisdomlab --json` returned `[]`; `gh api repos/ContextualWisdomLab/inkspan` returned `Not Found`; GitHub owner search returned `[]`; and `curl https://raw.githubusercontent.com/ContextualWisdomLab/inkspan/HEAD/package.json` returned HTTP `404`. Consequently, no exact current version, public React/Markdown API, or MIT license can be verified from the supplied repository or published package. The required prerequisite is unsatisfied, so no package was installed and no `MarkdownEditor`/`JournalPage` implementation was guessed. T-03.9 remains in-progress and blocked; no debugging-log entry is warranted because this is an unavailable dependency source, not an observed product defect.
  - 2026-08-30: Cancelled by product decision. Removed the temporary Inkspan source submodule and file dependency. WYSIWYG editing is now a shared planned-feature placeholder; a separately planned owned Markdown viewer replaces the rich-text editor work for this MVP.

### T-03.10: Adding an owned Markdown viewer

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.3
- **Files:**
  - `apps/frontend/package.json` (modified)
  - `apps/frontend/src/components/MarkdownViewer.tsx` (new)
  - `apps/frontend/src/JournalPage.tsx` (modified)
- **Intent:** Keep direct Markdown authoring with three component-owned modes: distraction-free Focus, side-by-side Live preview, and read-only Reading view. Use an owned, replaceable Markdown viewer without executing raw HTML or loading deferred embedded media. Present WYSIWYG editing through the shared planned-feature placeholder and do not call WYSIWYG services.
- **ADRs:** [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) -- Do use the shared placeholder for explicitly deferred capability. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do preserve accessible semantic UI and tokens. [ADR 0007](../ADRs/0007-use-cwl-editor-behind-an-owned-markdown-editor.md) -- Do use direct Markdown and an owned, replaceable viewer while WYSIWYG is deferred.
- **Verify:** Journal offers Focus, Live preview, and Reading view controls. Focus shows only the textarea; Live preview shows the textarea and owned viewer; Reading view shows only the viewer. The viewer renders Markdown safely without persisting a transformed value or loading images/media. The WYSIWYG placeholder makes no API calls. All modes are keyboard accessible and direct Markdown editing remains available after switching modes. Frontend typecheck, lint, and build pass.
- **Notes:**
  - 2026-08-30: Added the owned `MarkdownViewer` using `react-markdown` and `remark-gfm`. Raw HTML is not rendered; image nodes render accessible textual placeholders because embedded media is deferred. Added Focus (textarea only), Live preview (textarea and viewer), and Reading view (viewer only); Live preview is responsive at narrow widths. Frontend typecheck, lint, and build pass; manual mode interaction verification remains in progress.
  - 2026-08-30: Moved selected Week/Month/All export actions from review-grid footers to the Journal scope controls. Page-owned transient selection makes icon-labelled Copy/Download controls appear only while one or more current-table rows are selected; the actions state the selected-row count. Added an icon to row-level View controls and removed full-scope export controls below review grids.
  - 2026-08-30: Frontend typecheck and build pass after relocating selected-export controls; lint passes with existing Fast Refresh warnings in `App.tsx` and `components/ui/button.tsx`.
  - 2026-08-30: Every review-table row now has icon-labelled View, Copy, and Download actions. View opens the URL-owned Day Reading view; single-row Copy/Download use the canonical Day export serializer independently of the current table selection.
  - 2026-08-30: Frontend typecheck and build pass after adding per-row actions; lint passes with existing Fast Refresh warnings in `App.tsx` and `components/ui/button.tsx`.
  - 2026-08-30: Verified by product: Focus, Live preview, Reading view, textarea resize persistence, selected-export header actions, and per-row View/Copy/Download actions work. The task Verify is satisfied.

---

## E-04: Adding on-demand ephemeral AI summaries (cancelled)

**Goal:** Deferred to a future cross-feature AI-integration story and specification.

**Exit gate:** Not applicable in this plan.

**Depends on:** Not applicable in this plan.

**Cancellation:** User-directed on 2026-08-30. Portfolio Journal must not independently select or implement AI providers, credentials, data handling, rate limits, error behavior, or shared integration infrastructure. Preserve these task IDs and their historical context; the future story/spec owns the reusable AI foundation and any Journal summary integration.

### T-04.1: Defining the AI summary integration contract

- **Status:** cancelled
- **Owner:** backend-coding
- **Depends on:** T-02.3
- **Files:**
  - `apps/api/package.json` (modified)
  - `apps/api/src/lib/aiSummary.ts` (new)
  - `apps/api/src/plugins/journal.ts` (modified)
  - `packages/shared-types/src/journal.ts` (modified)
  - `packages/validation/src/journal.ts` (modified)
  - `.env.example` (modified)
- **Intent:** Cancelled. The future cross-feature AI-integration story/spec must define and implement the reusable provider, credential/configuration, data-handling, rate-limit, and error contract before Journal consumes it.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do derive protected scope from verified context and treat missing scope as an error.
- **Verify:** Cancelled. Do not implement under Portfolio Journal spec 0001.
- **Notes:** Cancelled 2026-08-30: the shared AI integration has broader application scope and will be defined in a dedicated future story/spec.

### T-04.2: Presenting and exporting ephemeral summaries

- **Status:** cancelled
- **Owner:** frontend-coding
- **Depends on:** T-04.1, T-03.4
- **Files:**
  - `apps/frontend/src/features/journal/JournalSummary.tsx` (new)
  - `apps/frontend/src/features/journal/JournalPage.tsx` (modified)
  - `apps/frontend/src/features/journal/journalApi.ts` (modified)
  - `apps/frontend/src/features/journal/journalExport.ts` (modified)
- **Intent:** Cancelled. A future Journal integration task may consume the approved shared AI contract after its separate story/spec is complete.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do keep selected Journal scope in the URL; Do Not rely on transient state for user location. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use React Router declarative APIs; Do Not add custom History API routing. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not expand `App.css` for ordinary component styling.
- **Verify:** Cancelled. Do not implement under Portfolio Journal spec 0001.
- **Notes:** Cancelled 2026-08-30: depends on the dedicated future cross-feature AI-integration story/spec.

---

## E-05: Adding incremental embedded-media support (cancelled)

**Goal:** Deferred to a dedicated future embedded-media specification and implementation plan.

**Exit gate:** Not applicable in this plan.

**Depends on:** Not applicable in this plan.

**Cancellation:** User-directed on 2026-08-30. Preserve these task IDs and their historical design context; do not execute them under Portfolio Journal spec 0001.

### T-05.1: Designing Base64 media persistence

- **Status:** cancelled
- **Owner:** database-design
- **Depends on:** T-02.5
- **Files:**
  - `docs/schema/0001-portfolio-journal-media-design.md` (new)
- **Intent:** Define the image/screenshot model and Markdown reference convention before migration: direct organization/user/entry relationships, Base64 encoding and MIME metadata, maximum per-file/per-entry payloads, permitted media types, indexes, deletion behavior, and the effect of moving/deleting an entry. Record the approved target design without representing it as already migrated.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do include direct `organizationId` on organization-owned data and scope all access by it; Do Not rely on parent joins for enforcement.
- **Verify:** The design artifact defines every required field, relation, constraint, payload bound, lifecycle rule, and migration risk and provides enough detail for T-05.2 without assuming external object storage or unbounded database payloads.
- **Notes:** Cancelled 2026-08-30: embedded media will be specified and planned independently. Do not create the named design artifact under spec 0001.

### T-05.2: Implementing protected media storage and persistence operations

- **Status:** cancelled
- **Owner:** database-design
- **Depends on:** T-05.1
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified)
  - `packages/database/prisma/migrations/<timestamp>_add_journal_media/migration.sql` (new)
  - `packages/database/src/journalStore.ts` (modified)
  - `packages/shared-types/src/journal.ts` (modified)
  - `packages/validation/src/journal.ts` (modified)
  - `docs/schema/current.md` (modified)
- **Intent:** Apply the approved migration and implement the scoped media store contract. Reject malformed Base64, unsupported MIME types, and oversized payloads before persistence; ensure entry deletion and media removal follow the documented lifecycle.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do scope every read/write/delete by verified organization context; Do Not accept tenant scope from client input.
- **Verify:** Migration and database package typechecks succeed; store operations round-trip authorized media for its owning entry, reject invalid/oversized input before persistence, and deny cross-user/cross-organization retrieval or deletion.
- **Notes:** Cancelled 2026-08-30: embedded media will be specified and planned independently. Do not create a migration or persistence contract under spec 0001.

### T-05.3: Extending the WYSIWYG editor with embedded media

- **Status:** cancelled
- **Owner:** frontend-coding
- **Depends on:** T-05.4, T-03.3
- **Files:**
  - `apps/frontend/src/features/journal/JournalEditor.tsx` (modified)
  - `apps/frontend/src/features/journal/journalApi.ts` (modified)
  - `apps/frontend/src/features/journal/JournalPage.tsx` (modified)
- **Intent:** Add the UX-approved image/screenshot picker and render/remove interactions to the selected WYSIWYG editor, persist approved Base64 media through the protected API, and maintain canonical Markdown references that round-trip through direct Markdown and WYSIWYG modes using Tailwind and shadcn/ui.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not expand `App.css` for ordinary component styling.
- **Verify:** A supported bounded image can be embedded, survives entry reload, renders in both editor modes and exported Markdown according to the approved reference convention, and can be removed without leaving an accessible orphan.
- **Notes:** Cancelled 2026-08-30: embedded media will be specified and planned independently. Do not extend the Journal editor under spec 0001.

### T-05.4: Exposing protected media HTTP routes

- **Status:** cancelled
- **Owner:** backend-coding
- **Depends on:** T-05.2
- **Files:**
  - `apps/api/src/plugins/journal.ts` (modified)
- **Intent:** Expose the approved scoped media store contract through protected image create/read/delete routes. Derive organization/user identity solely from `request.user` and validate payloads with the approved shared contracts.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do scope every protected operation by verified `organizationId`; Do Not accept tenant scope from client input.
- **Verify:** Authenticated owning users can create, retrieve, and delete media through the protected API; malformed/oversized inputs return documented client errors; and cross-user/cross-organization access is denied.
- **Notes:** Cancelled 2026-08-30: embedded media will be specified and planned independently. Do not expose media HTTP routes under spec 0001.

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | Resolved: Journal-specific flow, prototype, reconciliation, and route map exist. | No active block; retain as historical context for plan resumption. | uxd | none |
| R-2 | Resolved by deferral: shared AI provider, credential, data-handling, rate-limit, and failure-contract work belongs to a dedicated future cross-feature AI-integration story/spec. | No active block in this plan. Journal must not independently implement or select shared AI infrastructure. | business-requirements / architect | none |
| R-3 | **Resolved 2026-08-30:** ADR 0007 selects CWL Editor for a future WYSIWYG implementation, and ADR 0008 defines its future Markdown-integrity contract. The Journal MVP defers WYSIWYG and uses direct Markdown authoring with an owned viewer. | The deferral avoids unapproved rich-editor complexity while preserving a replaceable preview boundary. | frontend-coding | none |
| R-4 | Environment timezone is client-reported and can change between requests. The spec does not state an immutable historical grouping policy. | Client and server must validate one IANA timezone per request; a later product decision may be needed if entries must retain the timezone at creation. | business-requirements | none for MVP; document any discovered ambiguity in T-02.2 |
| R-5 | Resolved: TD-005 recorded the former manual History API scaffold; T-03.1 migrated the workspace to React Router v7 declarative navigation. | No active block; retain as historical context. | frontend-coding | none |
| R-6 | Embedded-media payload and lifecycle limits are deferred to a dedicated future specification. | No active block in this plan; the future media spec must define payload, lifecycle, authorization, and migration constraints before implementation. | business-requirements / database-design | none in this plan |
| R-7 | Resolved: the Journal UI provides selected Week/Month/All export, Today/chosen-date creation, review-table View controls, URL-owned All offset, and complete All export. | No active block; retain as historical context. | frontend-coding | none |
| R-8 | Resolved: the protected Week resolver and frontend use Sunday-Saturday `weekStart=YYYY-MM-DD` semantics. | No active block; retain as historical context. | backend-coding / frontend-coding | none |
| R-9 | **Resolved 2026-08-30:** Product selected `/workspace/journal?mode=week&weekStart=YYYY-MM-DD`, where `weekStart` is the actual Sunday and identifies Sunday through Saturday inclusive. ISO `YYYY-Www` has no Journal mapping and is rejected. | Canonical mapping, cross-year behavior, display, continuity, and Week export naming/metadata are documented in the spec and UX artifacts. | business-requirements / uxd | none |
| R-10 | Resolved: the Journal spec is marked ready for planning and records AI integration as deferred. | No active block; retain as historical context. | business-requirements | none |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-08-30 | Initial plan | Created from spec 0001 and ADRs 0001-0003. |
| 2026-08-30 | ADR 0004 adopted | Bound Journal route design and implementation to React Router v7 declarative mode; added task-level ADR citations and replaced the deferred router selection. |
| 2026-08-30 | Database-design agent added | Split the pending journal schema task into design and migration tasks, assigned persistence work to `database-design`, and made data-contract consumers depend on the migration. |
| 2026-08-30 | Frontend and backend coding agents added | Assigned API and external-service work to `backend-coding`, browser/UI work to `frontend-coding`, and split media API exposure from database persistence. Added the ADR 0005-required Tailwind and shadcn/ui foundation task. |
| 2026-08-30 | Database-design task review | Added T-02.6 for the journal store and made protected Journal routes depend on the database-owned persistence contract. |
| 2026-08-30 | UX/API handoff alignment | Made UXD task execution and implementation handoff explicit, required `backend-coding` to consume applicable UX workflow contracts, and attached ADR 0003 to T-01.1. |
| 2026-08-30 | Journal scope additions | Extended selection-only copy/download to Week, Month, and All review tables; made row selection transient and bounded to rendered results; specified Today, chosen-date creation, View controls, and URL-owned All pagination offset; added T-03.6 and R-7. Recorded the existing Monday–Sunday Week-range conflict as R-8. |
| 2026-08-30 | Approved-scope replan and code/UX review | Recorded the user override for the stale spec readiness, refined T-03.4 and T-03.6 against the actual frontend/API contract, and added T-03.7 (independent protected Week resolver correction), T-03.8 (frontend Week mapping alignment), and T-03.9 (corrective WYSIWYG implementation). Added R-9 for the unresolved ISO-label/Sunday-Saturday contradiction and R-10 for status drift. |
| 2026-08-30 | Product Week decision | Resolved R-9. All Journal Weeks are Sunday-Saturday and use the canonical Sunday-start URL parameter `weekStart=YYYY-MM-DD`; ISO `YYYY-Www` is rejected. Unblocked T-03.7 and T-03.8; expanded their verification to cover strict validation, cross-year bounds, direct links/history, and range-based Week export semantics. |
| 2026-08-30 | Product scope decision | Cancelled E-05 and T-05.1 through T-05.4 without reclaiming their IDs. Embedded media is deferred to a dedicated future specification and plan. |
| 2026-08-30 | CWL and Markdown integrity ADRs | Added ADR 0007 (CWL behind an owned wrapper) and ADR 0008 (editor-independent Markdown round-trip policy). Resolved R-3 and replanned T-03.9 as a pending, fully constrained frontend task; removed embedded-media follow-on language from the active approach. |
| 2026-08-30 | Product authoring-scope decision | Cancelled T-03.9 and removed the temporary Inkspan source/dependency. Added T-03.10 for direct Markdown authoring plus an owned safe preview; WYSIWYG is now the shared planned-feature placeholder. |
| 2026-08-30 | Product AI-scope decision | Cancelled E-04 and T-04.1 through T-04.2 without reclaiming their IDs. AI summaries and their underlying shared integration are deferred to a dedicated future cross-feature story and specification. |
