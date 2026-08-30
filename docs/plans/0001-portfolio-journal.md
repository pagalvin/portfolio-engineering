# Plan 0001: Portfolio Journal

- Status: draft
- Date: 2026-08-30
- Spec: [0001-portfolio-journal](../specs/0001-portfolio-journal.md)
- Audience: [frontend-coding, backend-coding, database-design, uxd, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: E-02
- Completed efforts: E-01 (UX contract)
- Blocked tasks: T-04.1 -- no AI provider, server-side credential/configuration contract, or summary-generation contract exists in the repository.
- Next recommended task: T-02.2 (backend-coding: domain types/validation), or parallel T-02.6 (database-design: store implementation) after T-02.2 done
- Last updated: 2026-08-30

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Producing the journal UX contract | 2 | 2 | done |
| E-02 | Establishing journal persistence and protected APIs | 6 | 2 | in-progress |
| E-03 | Delivering core journal UI, placeholders, and exports | 5 | 0 | pending |
| E-04 | Adding on-demand ephemeral AI summaries | 2 | 0 | blocked |
| E-05 | Adding incremental embedded-media support | 4 | 0 | pending |

## Summary

This plan replaces the scaffold-only Journal page with a private, Markdown-first journal backed by organization-scoped PostgreSQL data and protected Fastify routes. It first obtains the missing UX contract, then delivers date-based authoring, review, exports, and planned-feature placeholders; AI summaries and embedded media follow as isolated increments so their unresolved provider and storage details do not block core journaling.

## Inputs

- Spec readiness at planning time: `Ready for planning` in [0001-portfolio-journal.md](../specs/0001-portfolio-journal.md).
- ADRs reviewed: [0001-organization-aware-data-access.md](../ADRs/0001-organization-aware-data-access.md), [0002-url-addressable-routing-and-history-safe-navigation.md](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003-use-a-shared-placeholder-for-planned-features.md](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004-use-react-router-for-frontend-navigation.md](../ADRs/0004-use-react-router-for-frontend-navigation.md), and [0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md).
- UX artifacts used: [ui-scaffold-contract.json](../uxd/flows/ui-scaffold-contract.json). It supplies the existing `/workspace/journal` scaffold route and global visual/routing constraints; no Journal-specific UX handoff exists yet.
- Schema reference: [current.md](../schema/current.md), with source of truth in [schema.prisma](../../packages/database/prisma/schema.prisma).
- Intersecting tech debt: TD-005 in [checklist.md](../tech-debt/checklist.md). The existing manual History API routing in [App.tsx](../../apps/frontend/src/App.tsx) must be replaced with React Router v7 declarative mode while introducing Journal routes, as required by ADRs 0002 and 0004.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0001](../ADRs/0001-organization-aware-data-access.md) | Journal entries, media, and APIs are protected organization-owned data. | E-02, E-04, E-05 |
| [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | Journal views have date/scope context and replace a scaffold-only major view. | E-01, E-03, E-04 |
| [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) | New experiments, Rules adherence, and context injection are intentionally visible but unavailable. | E-03 |
| [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) | Journal routes replace the custom History API scaffold and must preserve existing workspace URLs. | E-03, E-04 |
| [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | Journal adds frontend UI and turns `packages/ui` into a shared component package. | E-03, E-04, E-05 |

## Approach

- Preserve the existing package boundaries: Prisma access remains in `@portfolio-engineering/database`, request/response types in `@portfolio-engineering/shared-types`, Zod contracts in `@portfolio-engineering/validation`, and protected Fastify routes under `apps/api/src/plugins`.
- Introduce a journal store analogous to [authStore.ts](../../packages/database/src/authStore.ts); every store operation accepts verified `organizationId` and `userId`. The protected plugin supplies those values from `request.user`, never from journal request input.
- Store one Markdown entry per user and local calendar date. The API accepts and validates the environment-reported IANA timezone needed to turn a requested day/week/month scope into local-date boundaries. Moving an entry is an explicit operation that rejects a destination already occupied by that user.
- Create one deterministic Markdown serialization utility for journal scopes and AI summaries. Clipboard and Blob-download actions use the same serializer so ordering, metadata, selected-week filtering, and filenames stay aligned.
- Move the frontend from the custom `popstate` router in [App.tsx](../../apps/frontend/src/App.tsx) to React Router v7 declarative mode. Preserve all existing scaffold paths while adding explicit Journal day/week/month routes and URL state for selected context.
- Keep AI output in component state only. Do not create an AI-summary table or scheduled job. The provider and credential contract are an explicit blocker rather than something an implementation agent should invent.
- Treat Base64-in-PostgreSQL media as a separate follow-on increment. A database agent must first document the model, relationship, payload validation, and size constraints; core journal authoring must not wait for it.

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
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do create explicit routes and store meaningful location context in URL state; Do Not hide core workflow context only in transient state. [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) -- Do define clear, accessible presentation-only placeholder messaging and prioritization links; Do Not design API calls or simulated results for unavailable capabilities. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use route parameters or query parameters for Journal context; Do Not introduce custom History API routing.
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
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do ensure deep links, refresh, and browser history preserve major-view context. [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) -- Do supply feature-specific copy and community links; Do Not imply unavailable analysis is active. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use React Router v7 declarative APIs and preserve workspace URLs.
- **Verify:** The scaffold contract and flow agree on Journal routes and explicitly identify New experiments, Rules adherence, and context injection as presentation-only placeholders linking to the subreddit. ✓
- **Notes:** 
  - Updated [ui-scaffold-contract.json](../uxd/flows/ui-scaffold-contract.json) Journal entry from `placeholder-only` to `in-progress` with complete route specifications: five routes (root, day, week, month, all) with URL/component state separation, feature lists, and implementation libraries (React Router v7, Tailwind CSS, shadcn/ui).
  - Added editor contract (Markdown canonical, WYSIWYG support, round-trip guarantee), export contract (clipboard + file parity, deterministic serialization), placeholder specifications (New Experiments, Rules Adherence, Context Injection with subreddit CTAs), responsive layout guidance, and accessibility requirements.
  - Created [0001-reconciliation.md](../uxd/flows/0001-reconciliation.md) — comprehensive reconciliation report verifying all spec requirements, ADR compliance (0002, 0003, 0004, 0005), edge case coverage, and implementation readiness for downstream agents (frontend-coding, backend-coding, database-design).
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
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do add direct `organizationId`, scope all operations by it, and document exceptions; Do Not rely only on indirect ownership.
- **Verify:** The design artifact identifies required fields, relations, constraints, indexes, lifecycle behavior, and migration risks; [current.md](../schema/current.md) distinguishes the approved target from the current as-built schema; and the design contains enough detail for T-02.5 without schema assumptions. ✓
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

- **Status:** pending
- **Owner:** backend-coding
- **Depends on:** T-02.5
- **Files:**
  - `packages/shared-types/src/journal.ts` (new)
  - `packages/shared-types/src/index.ts` (modified)
  - `packages/shared-types/package.json` (modified)
  - `packages/validation/src/journal.ts` (new)
  - `packages/validation/src/index.ts` (modified)
  - `packages/validation/package.json` (modified)
- **Intent:** Define typed request/response and Zod schemas for Markdown entry CRUD, date/scope query input, move requests, and selected-week entry identifiers from the approved journal persistence contract.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do treat missing verified organization scope as an error; Do Not accept tenant scope from request data.
- **Verify:** Package typechecks succeed, and invalid timezone/date/Markdown inputs and occupied move targets have defined validation results compatible with the T-02.1 persistence design.
- **Notes:** _(appended by executing agents)_

### T-02.6: Implementing the scoped journal persistence contract

- **Status:** pending
- **Owner:** database-design
- **Depends on:** T-02.2, T-02.5
- **Files:**
  - `packages/database/src/journalStore.ts` (new)
  - `packages/database/src/index.ts` (modified)
- **Intent:** Implement the approved database-store interface patterned after `authStore`, using the migrated journal model and domain contracts. Require `organizationId` and `userId` for every operation, support all documented retrieval scopes, and distinguish missing entries from destination-date conflicts.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do filter every read, write, update, delete, and aggregate by `organizationId`; Do Not rely only on parent joins or infer scope from client input.
- **Verify:** Database package typecheck succeeds and store operations cannot read, write, move, or aggregate an entry without explicit organization/user scope; queries use the approved indexes and return distinct missing-entry and occupied-destination outcomes.
- **Notes:** _(appended by executing agents)_

### T-02.3: Exposing protected Journal HTTP routes

- **Status:** pending
- **Owner:** backend-coding
- **Depends on:** T-02.6
- **Files:**
  - `apps/api/src/plugins/journal.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified)
  - `apps/api/src/types/fastify-jwt.d.ts` (modified, if route typing requires it)
- **Intent:** Register protected routes for entry CRUD/move and scoped retrieval (day, week, month, entire journal, selected weekly entries). Derive organization/user exclusively from `request.user`, validate client-supplied timezone and scope inputs, return a conflict for a move to an occupied date, and avoid persisting blank entries.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do filter every protected read/write/update/delete by verified `organizationId`; Do Not accept client-supplied tenant scope.
- **Verify:** Authenticated requests can exercise all supported scopes for their own entries; requests cannot retrieve or mutate another user's entry; blank-entry creation and occupied-date moves fail with documented client errors.
- **Notes:** _(appended by executing agents)_

### T-02.4: Establishing frontend authenticated API access

- **Status:** pending
- **Owner:** frontend-coding
- **Depends on:** T-02.3
- **Files:**
  - `apps/frontend/src/authSession.ts` (modified)
  - `apps/frontend/src/apiClient.ts` (new)
  - `apps/frontend/src/App.tsx` (modified)
- **Intent:** Add the narrow authenticated-request mechanism needed by Journal routes. It must obtain and refresh the existing JWT access token through established auth endpoints, attach it to protected `/api` requests, and surface authentication failures to the current session UI without putting a token in URL or persistent browser storage.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do use verified auth context for protected data access; Do Not allow client input to select tenant scope.
- **Verify:** After either supported sign-in path, the frontend can call `/api/me` and a protected Journal endpoint with a bearer token; an expired/invalid session is surfaced as unauthenticated rather than producing an unscoped request.
- **Notes:** _(appended by executing agents)_

---

## E-03: Delivering core journal UI, placeholders, and exports

**Goal:** Replace the Journal scaffold with route-addressable entry/review UI, reusable planned-feature messaging, and equivalent clipboard/download export behavior.

**Exit gate:** An authenticated user can use deep-linked Journal routes to author/review Markdown entries and copy/download the same serialized content for every supported scope without unavailable features calling backend services.

**Depends on:** E-02

### T-03.1: Migrating workspace navigation to a first-class router

- **Status:** pending
- **Owner:** frontend-coding
- **Depends on:** T-01.2, T-02.4, T-03.5
- **Files:**
  - `apps/frontend/package.json` (modified)
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/scaffoldRoutes.ts` (modified)
  - `apps/frontend/src/workspaceRoutes.tsx` (new)
- **Intent:** Replace the custom pathname and `window.history` handling with React Router v7 declarative mode, preserve all existing workspace scaffold paths, and register the Journal routes supplied by UXD. Make selected Journal scope/date URL-owned so deep links, refresh, and back/forward retain context without adopting framework-mode routing or router-owned data loading.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do use a routing library with first-class history integration and preserve meaningful location context; Do Not gate major views behind in-memory-only navigation. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use React Router v7 declarative APIs; Do Not add custom History API routing or framework-mode features. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do preserve semantic design tokens while migrating changed UI; Do Not perform a broad style-only rewrite.
- **Verify:** Existing scaffold URLs and every approved Journal URL render directly, refresh to the same route/context, and browser back/forward transitions restore the previous workspace or Journal location.
- **Notes:** _(appended by executing agents)_

### T-03.2: Creating the reusable planned-feature placeholder

- **Status:** pending
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
- **Notes:** _(appended by executing agents)_

### T-03.3: Implementing Markdown journal authoring and time-scoped review

- **Status:** pending
- **Owner:** frontend-coding
- **Depends on:** T-03.1, T-03.2
- **Files:**
  - `apps/frontend/src/features/journal/JournalPage.tsx` (new)
  - `apps/frontend/src/features/journal/JournalEditor.tsx` (new)
  - `apps/frontend/src/features/journal/JournalReview.tsx` (new)
  - `apps/frontend/src/features/journal/journalApi.ts` (new)
  - `apps/frontend/src/features/journal/journalDates.ts` (new)
- **Intent:** Implement the UX-approved day/week/month/entire-journal views using the protected API and environment timezone, including no-entry states, direct Markdown editing, WYSIWYG integration selected by the approved UX/Markdown contract, save/update/move behavior, Sunday-Saturday selection tables, and the three ADR 0003 placeholders. Defer media controls to E-05 while ensuring the editor architecture accepts them later.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do preserve primary date/scope context in routes. [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) -- Do provide clear planned states and CTA links; Do Not create feature-specific placeholder components or imply analysis runs. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use route parameters or query parameters for Journal scope/date; Do Not store this context only in component state. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not expand `App.css` for ordinary component styling.
- **Verify:** A signed-in user can create/edit Markdown for an unoccupied local date, view it in all requested groupings, select week rows, move it only to an unoccupied date, and see New experiments, Rules adherence, and context injection as non-interactive presentation-only placeholders.
- **Notes:** _(appended by executing agents)_

### T-03.4: Adding unified journal and summary export actions

- **Status:** pending
- **Owner:** frontend-coding
- **Depends on:** T-03.3
- **Files:**
  - `apps/frontend/src/features/journal/journalExport.ts` (new)
  - `apps/frontend/src/features/journal/JournalPage.tsx` (modified)
  - `apps/frontend/src/features/journal/JournalReview.tsx` (modified)
- **Intent:** Serialize day, week, month, entire-journal, and selected-weekly-entry scopes into canonical Markdown with deterministic date ordering, date/section metadata, and descriptive filenames. Reuse this serializer for browser clipboard writes and Markdown Blob downloads; expose the same actions for ephemeral summaries once E-04 supplies one.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not expand `App.css` for ordinary component styling.
- **Verify:** For each non-empty scope, copied Markdown exactly matches downloaded Markdown content apart from filename delivery; selected-week export contains only selected entries; empty-period actions follow the UX-approved response; and filenames match the scope/date range.
- **Notes:** _(appended by executing agents)_

### T-03.5: Establishing the Tailwind and shadcn/ui foundation

- **Status:** pending
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
- **Notes:** _(appended by executing agents)_

---

## E-04: Adding on-demand ephemeral AI summaries

**Goal:** Add only the explicit, eligible, non-persistent AI-summary workflow after its server integration is defined.

**Exit gate:** Eligible user-selected content produces an ephemeral summary that can be copied, inserted into an entry, or downloaded; no summary runs automatically or persists unless the user saves it.

**Depends on:** E-03

### T-04.1: Defining the AI summary integration contract

- **Status:** blocked
- **Owner:** backend-coding
- **Depends on:** T-02.3
- **Files:**
  - `apps/api/package.json` (modified)
  - `apps/api/src/lib/aiSummary.ts` (new)
  - `apps/api/src/plugins/journal.ts` (modified)
  - `packages/shared-types/src/journal.ts` (modified)
  - `packages/validation/src/journal.ts` (modified)
  - `.env.example` (modified)
- **Intent:** After the product/architecture owner selects an AI provider and credential/configuration model, implement a server-side provider adapter and validated request/response contract for one explicitly selected Journal scope. Enforce the 100-character minimum server-side and return only ephemeral generated text.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do derive protected scope from verified context and treat missing scope as an error.
- **Verify:** With configured provider credentials, an authenticated request below 100 characters is rejected before provider invocation; an eligible request returns a summary without database writes or scheduled execution.
- **Notes:** Blocked: the spec requires summaries but does not identify an AI provider, credential source, data-handling policy, model, rate/usage limits, or error contract. Product/architecture must supply these decisions before implementation.

### T-04.2: Presenting and exporting ephemeral summaries

- **Status:** pending
- **Owner:** frontend-coding
- **Depends on:** T-04.1, T-03.4
- **Files:**
  - `apps/frontend/src/features/journal/JournalSummary.tsx` (new)
  - `apps/frontend/src/features/journal/JournalPage.tsx` (modified)
  - `apps/frontend/src/features/journal/journalApi.ts` (modified)
  - `apps/frontend/src/features/journal/journalExport.ts` (modified)
- **Intent:** Add the explicit summary action for every supported Journal scope, use the API contract, present loading/error/ineligible states, retain output only in live component state, and use the existing export utility to copy/download or insert the result into the chosen journal entry on user action.
- **ADRs:** [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) -- Do keep selected Journal scope in the URL; Do Not rely on transient state for user location. [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) -- Do use React Router declarative APIs; Do Not add custom History API routing. [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not expand `App.css` for ordinary component styling.
- **Verify:** Eligible day/week/month/entire/selected-week requests generate only after user action; summary output disappears on reload unless the user inserted it into an entry; copy/download/save work; and no background request runs on navigation, reload, or a schedule.
- **Notes:** _(appended by executing agents)_

---

## E-05: Adding incremental embedded-media support

**Goal:** Add the required image/screenshot capability only after its PostgreSQL Base64 design has explicit payload and lifecycle constraints.

**Exit gate:** Authorized users can add, render, and remove supported bounded Base64 media from their own entries without weakening organization scoping or Markdown canonicality.

**Depends on:** E-03

### T-05.1: Designing Base64 media persistence

- **Status:** pending
- **Owner:** database-design
- **Depends on:** T-02.5
- **Files:**
  - `docs/schema/0001-portfolio-journal-media-design.md` (new)
- **Intent:** Define the image/screenshot model and Markdown reference convention before migration: direct organization/user/entry relationships, Base64 encoding and MIME metadata, maximum per-file/per-entry payloads, permitted media types, indexes, deletion behavior, and the effect of moving/deleting an entry. Record the approved target design without representing it as already migrated.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do include direct `organizationId` on organization-owned data and scope all access by it; Do Not rely on parent joins for enforcement.
- **Verify:** The design artifact defines every required field, relation, constraint, payload bound, lifecycle rule, and migration risk and provides enough detail for T-05.2 without assuming external object storage or unbounded database payloads.
- **Notes:** _(appended by executing agents)_

### T-05.2: Implementing protected media storage and persistence operations

- **Status:** pending
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
- **Notes:** _(appended by executing agents)_

### T-05.3: Extending the WYSIWYG editor with embedded media

- **Status:** pending
- **Owner:** frontend-coding
- **Depends on:** T-05.4, T-03.3
- **Files:**
  - `apps/frontend/src/features/journal/JournalEditor.tsx` (modified)
  - `apps/frontend/src/features/journal/journalApi.ts` (modified)
  - `apps/frontend/src/features/journal/JournalPage.tsx` (modified)
- **Intent:** Add the UX-approved image/screenshot picker and render/remove interactions to the selected WYSIWYG editor, persist approved Base64 media through the protected API, and maintain canonical Markdown references that round-trip through direct Markdown and WYSIWYG modes using Tailwind and shadcn/ui.
- **ADRs:** [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) -- Do use Tailwind utilities and shadcn/ui primitives; Do Not expand `App.css` for ordinary component styling.
- **Verify:** A supported bounded image can be embedded, survives entry reload, renders in both editor modes and exported Markdown according to the approved reference convention, and can be removed without leaving an accessible orphan.
- **Notes:** _(appended by executing agents)_

### T-05.4: Exposing protected media HTTP routes

- **Status:** pending
- **Owner:** backend-coding
- **Depends on:** T-05.2
- **Files:**
  - `apps/api/src/plugins/journal.ts` (modified)
- **Intent:** Expose the approved scoped media store contract through protected image create/read/delete routes. Derive organization/user identity solely from `request.user` and validate payloads with the approved shared contracts.
- **ADRs:** [ADR 0001](../ADRs/0001-organization-aware-data-access.md) -- Do scope every protected operation by verified `organizationId`; Do Not accept tenant scope from client input.
- **Verify:** Authenticated owning users can create, retrieve, and delete media through the protected API; malformed/oversized inputs return documented client errors; and cross-user/cross-organization access is denied.
- **Notes:** _(appended by executing agents)_

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | No Journal-specific UX flow/prototype or approved route map exists; the generic scaffold contract leaves date routes, editor-mode interactions, export feedback, and state handling unspecified. | Frontend and backend agents could choose route and interaction semantics that drift from product intent. | uxd | T-02.1 through T-03.4 |
| R-2 | No AI provider, model, credential source, data-handling policy, rate/usage limit, or failure contract is in the spec or codebase. | AI summary must remain blocked; inventing an integration would create an unapproved security/product decision. | business-requirements / architect | T-04.1, T-04.2 |
| R-3 | The spec requires WYSIWYG Markdown round-tripping but no editor/parser dependency or supported-Markdown normalization contract exists. | Editor choice can affect Markdown compatibility and media reference format. T-01.1 must resolve the user-facing contract before T-03.3 selects and integrates a library. | uxd / frontend-coding | T-03.3, T-05.3 |
| R-4 | Environment timezone is client-reported and can change between requests. The spec does not state an immutable historical grouping policy. | Client and server must validate one IANA timezone per request; a later product decision may be needed if entries must retain the timezone at creation. | business-requirements | none for MVP; document any discovered ambiguity in T-02.2 |
| R-5 | TD-005 records the current manual History API scaffold. | Journal cannot comply with ADRs 0002 and 0004 without migrating every scaffold route to React Router v7 declarative mode. | frontend-coding | T-03.1 through T-03.4 |
| R-6 | Base64 database media has no payload/lifecycle limits yet. | Unbounded payloads can exceed request/database limits and make export/editor behavior unreliable. | database-design | T-05.2 through T-05.4 |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-08-30 | Initial plan | Created from spec 0001 and ADRs 0001-0003. |
| 2026-08-30 | ADR 0004 adopted | Bound Journal route design and implementation to React Router v7 declarative mode; added task-level ADR citations and replaced the deferred router selection. |
| 2026-08-30 | Database-design agent added | Split the pending journal schema task into design and migration tasks, assigned persistence work to `database-design`, and made data-contract consumers depend on the migration. |
| 2026-08-30 | Frontend and backend coding agents added | Assigned API and external-service work to `backend-coding`, browser/UI work to `frontend-coding`, and split media API exposure from database persistence. Added the ADR 0005-required Tailwind and shadcn/ui foundation task. |
| 2026-08-30 | Database-design task review | Added T-02.6 for the journal store and made protected Journal routes depend on the database-owned persistence contract. |
| 2026-08-30 | UX/API handoff alignment | Made UXD task execution and implementation handoff explicit, required `backend-coding` to consume applicable UX workflow contracts, and attached ADR 0003 to T-01.1. |
