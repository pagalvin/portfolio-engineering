# Plan 0009: In-App Change Log

- Status: `done`
- Date: 2026-09-28
- Spec: [0009-in-app-changelog](../../specs/0009-in-app-changelog.md)
- Audience: [coding-agents, database-agents, uxd, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: none (plan complete)
- Completed efforts: E-01, E-02, E-03, E-04, E-05, E-06
- Blocked tasks: none
- Next recommended task: none; run the closeout changelog/bundle synchronization test before final diff review, commit, rebase, and PR
- Last updated: 2026-09-29

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Acknowledgment persistence design | 1 | 1 | complete |
| E-02 | Acknowledgment persistence implementation | 1 | 1 | complete |
| E-03 | Canonical source and runtime content | 2 | 2 | complete |
| E-04 | Authenticated API boundary | 2 | 2 | complete |
| E-05 | System navigation and Change Log page | 2 | 2 | complete |
| E-06 | Governance and acceptance review | 2 | 2 | complete |

## Summary

Move the README changelog into root `CHANGELOG.md` and expose it as an authenticated System page using the existing validated GitHub runtime-content pipeline and Markdown viewer. Add a durable, user-owned set of acknowledged dated-section identities, with authenticated unread/acknowledgment APIs, idempotent writes, and profile-deletion cleanup.

## Inputs

- Spec readiness at planning time: `Ready for implementation planning`; product, UX, and architecture decisions are recorded.
- ADRs reviewed: [ADR 0001](../../ADRs/0001-organization-aware-data-access.md), [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md), [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md), [ADR 0014](../../ADRs/0014-require-delete-backup-review-for-profile-related-data.md), [ADR 0015](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md).
- UX artifacts used: [Spec 0009 Change Log UX flow](../../uxd/flows/0009-in-app-changelog.md), [UI scaffold contract](../../uxd/flows/ui-scaffold-contract.json).
- UX clarification incorporated: unread-state failures preserve only the active user's last confirmed state, expose an adjacent polite status, and do not create an extra control or notification surface.
- Architecture direction: Spec 0009 — existing channel-keyed runtime cache; one normalized acknowledgment per user and stable dated heading; authenticated `userId` + `organizationId` scope; idempotent per-section writes; excluded from backup and deleted with profile.
- Schema reference: [current schema](../../schema/current.md), [Prisma schema](../../../packages/database/prisma/schema.prisma), [migrations](../../../packages/database/prisma/migrations/).
- Existing patterns: [Help content loader](../../../apps/api/src/lib/helpContent.ts), [Help refresh](../../../apps/api/src/lib/helpRefresh.ts), [Help cache store](../../../packages/database/src/helpContentStore.ts), [Help routes](../../../apps/api/src/plugins/help.ts), [authenticated route boundary](../../../apps/api/src/plugins/protected.ts), [profile store and lifecycle](../../../packages/database/src/authStore.ts), [Markdown viewer](../../../apps/frontend/src/components/MarkdownViewer.tsx), and authenticated workspace in [App.tsx](../../../apps/frontend/src/App.tsx).
- Intersecting tech debt: TD-014 requires explicit backup/deletion review for new profile-owned records; this plan includes it. TD-003 covers generated Prisma-client commit policy; follow existing generated-client and migration scripts without expanding that policy. Existing frontend tests use Node tests and static markup/route contracts; do not add a new test framework for this feature.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) | Acknowledgment rows are user-owned and organization-scoped. Its Do rules require verified auth scope, direct `organizationId`, scope in every read/write/delete predicate, and cross-scope tests. | E-01, E-02, E-04 |
| [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | Change Log is a major page that must survive direct load, refresh, and browser history. | E-05 |
| [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) | `/change-log` is added to declarative React Router navigation. Use `Link`/`NavLink`; do not add History API routing. | E-05 |
| [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | New UI must use existing semantic tokens and frontend component conventions, preserving accessibility and responsive behavior. | E-05 |
| [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) | Changelog content is a public runtime-content channel. Fetch server-side from the repository `main`, validate, cache successful content, provide bundled fallback, and do not expose raw content or add a second fetcher. | E-01, E-03, E-04, E-05 |
| [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) | User identity is the hosted authenticated account or local household profile; local profiles remain isolated and hosted state follows the account. | E-01, E-02, E-04 |
| [ADR 0014](../../ADRs/0014-require-delete-backup-review-for-profile-related-data.md) | New profile-owned persistence requires explicit backup/export and deletion review. Acknowledgments are excluded from backup but must be deleted transactionally with the profile. | E-01, E-02, E-06 |
| [ADR 0015](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) | The new user-facing System route requires an explicit review of whether official Help content is needed; record any deferral, without unrelated Help changes. | E-05, E-06 |

## Approach

- Reuse the existing raw-GitHub transport, validated runtime payload cache keyed by channel, refresh failure preservation, and bundled fallback conventions. Add one `changelog` channel and an exact root `CHANGELOG.md` allowlisted source. Keep Help behavior stable and avoid a broad Help refactor.
- Parse/validate the changelog's stable top-level dated headings alongside its Markdown. The section identity list returned to the client must be derived from the exact same validated content snapshot as the rendered Markdown.
- Use a normalized user-owned acknowledgment set rather than browser storage, organization preferences, or `InvestorProfile`. The database design task must finalize relations, uniqueness, indexes, lifecycle behavior, migration, and confirm that the existing runtime cache can hold the channel payload.
- Use the existing authenticated Fastify plugin boundary and frontend authenticated API client. Backend ownership comes only from verified request context. Insert acknowledgments idempotently per user and section so concurrent requests merge.
- Reuse `scaffoldRoutes`, React Router, `MarkdownViewer`, and Help freshness/status presentation for the frontend. The visible `New` text badge is personal and clears only after rendered section identities are acknowledged successfully.
- Profile export remains unchanged and excludes acknowledgment rows. Profile deletion must include acknowledgment cleanup in its existing transaction. Record and test the ADR-0014 exclusion rationale.

## Non-goals

- A new GitHub client/fetcher, new runtime cache architecture, or a changelog cache table unless database-design demonstrates the existing cache cannot represent this channel and escalates that blocker.
- A generalized user-preferences service, localStorage-based substitute for durable user state, or organization-wide acknowledgment.
- A separate notification subsystem, refresh UI, search, subscriptions, changelog editing, or new Markdown capabilities.
- Unrelated Help route, content, refresh-control, or renderer refactors.
- Changes to profile-backup contents beyond explicitly keeping acknowledgment state excluded.

---

## E-01: Acknowledgment persistence design

**Goal:** Finalize the user-owned persistence contract and confirm existing runtime-cache compatibility before any schema or persistence implementation begins.

**Exit gate:** The design artifact defines the user relation, direct organization scope, unique per-user section identity, indexes, idempotent write contract, lifecycle behavior, migration safety, and explicitly confirms whether `HelpRuntimeCache` can hold the validated changelog payload without a new cache table. Any incompatibility is recorded as a blocker before dependent tasks proceed.

**Depends on:** none

### T-01.1: Design changelog acknowledgment persistence

- **Status:** done
- **Owner:** database-design
- **Depends on:** none
- **Files:**
  - `docs/schema/0009-in-app-changelog-design.md` (new)
  - `packages/database/prisma/schema.prisma` (reference)
  - `packages/database/prisma/migrations/` (reference)
  - `docs/schema/current.md` (reference)
  - `packages/database/src/authStore.ts` (reference)
  - `packages/database/src/helpContentStore.ts` (reference)
- **Intent:** Define the normalized per-user acknowledgment record and application-facing store contract. Specify its direct `organizationId` and user relation, uniqueness for `(organizationId, userId, dated-section identity)`, query indexes, idempotent insert/read behavior, and deletion lifecycle. Review the current channel-keyed JSON payload/metadata contract and confirm it can store the changelog snapshot plus its derived section identities without adding a changelog-specific cache table. Define migration and generated-client steps, but do not modify schema or implementation in this design task.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do: direct `organizationId`, verified scope, and scope in every mutation predicate; Do Not: rely on body/headers or pre-read-only scoping. [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — Do: cache validated runtime payloads by explicit channel; keep global content cache distinct from user state. [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — use the same authenticated `User` identity for local profiles and hosted accounts. [ADR 0014](../../ADRs/0014-require-delete-backup-review-for-profile-related-data.md) — document and review the intentional backup exclusion and required deletion cleanup.
- **Verify:** The design artifact specifies model cardinality, foreign keys/delete behavior, direct tenant scope, uniqueness, indexes tied to read/write paths, idempotent concurrent acknowledgment semantics, explicit backup exclusion, profile deletion cleanup, migration safety, and generated-client handling. It explicitly concludes whether the existing `HelpRuntimeCache` can hold the channel payload without a new cache table. No persistence design question remains unresolved.
- **Notes:** Added [the T-01.1 persistence design](../../schema/0009-in-app-changelog-design.md). It defines one row per `(organizationId, userId, sectionIdentity)`, a tenant-consistent composite user foreign key and scoped unique index, idempotent inserts, backup exclusion, transactional deletion, and an additive migration/generation workflow. Confirmed the existing channel-keyed `HelpRuntimeCache` can store validated Markdown and identities from the same snapshot; no new cache table is required. No migration or runtime code was changed. Exit gate satisfied; T-02.1 is unblocked, and T-03.2 is unblocked after T-03.1.

---

## E-02: Acknowledgment persistence implementation

**Goal:** Implement the approved persistence contract and integrate profile deletion without exporting presentation state.

**Exit gate:** The schema/migration and database store enforce per-user, per-section idempotency and organization scoping; profile deletion removes rows atomically; export excludes the state; targeted persistence tests pass.

**Depends on:** E-01

### T-02.1: Add acknowledgment schema, store, and lifecycle coverage

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.1
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified)
  - `packages/database/prisma/migrations/<timestamp>_add_changelog_acknowledgments/migration.sql` (new; timestamp assigned using repository convention)
  - `packages/database/src/changelogAcknowledgmentStore.ts` (new)
  - `packages/database/src/changelogAcknowledgmentStore.test.ts` (new)
  - `packages/database/src/authStore.ts` (modified)
  - `packages/database/src/authStore.test.ts` (modified)
  - `packages/database/src/index.ts` (modified)
  - `packages/database/src/generated/prisma/` (generated)
  - `docs/schema/current.md` (modified)
  - `docs/schema/0009-in-app-changelog-design.md` (reference)
- **Intent:** Implement only the approved database design. Add store operations that derive user and organization scope from their caller, read the authenticated user's acknowledged identities, and insert acknowledgments idempotently per section. Extend the existing transactional profile-deletion path to remove the new rows explicitly; keep `getProfileBackup` and the typed backup payload free of acknowledgment data. Regenerate Prisma client output and update canonical schema documentation after migration verification.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do: put `organizationId` in each protected read/write/delete predicate and test cross-organization records remain unchanged; Do Not: write using an ID-only predicate after a scoped pre-read. [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — preserve the same per-user identity semantics in local and hosted modes. [ADR 0014](../../ADRs/0014-require-delete-backup-review-for-profile-related-data.md) — Do: explicitly review backup/export completeness and deletion coverage, documenting why this state is excluded from backup and adding cleanup tests.
- **Verify:** Apply the new migration using repository scripts; Prisma generation and database package typecheck pass. Store tests prove two users in one organization and users in different organizations cannot observe or alter each other's acknowledgments; duplicate/concurrent per-section insert attempts retain one acknowledged identity without error or lost rows; profile deletion removes acknowledgments within the existing transaction; profile backup schema/output does not include them. `docs/schema/current.md` matches the verified schema.
- **Notes:** Local verification is complete: Prisma validation and migration status passed; the database is up to date; Prisma Client generation and database typecheck passed; all 40 database tests passed, including scoped acknowledgment reads/writes, duplicate/concurrent inserts, transactional deletion cleanup, backup exclusion, and the profile-deletion failure/rollback assertion. The user applied `20260928153000_add_changelog_acknowledgments`; Prisma generated and applied `20260928153343_add_changelog_acknowledgments` to rename the overlong acknowledgment index to the PostgreSQL-63-byte/Prisma-expected identifier and reconcile the same naming mismatch for the preexisting securities unique index. Both applied migration directories remain; neither was edited or removed, and the local database was not reset. Updated [current schema documentation](../../schema/current.md) to the verified state. E-02 exit gate is satisfied. T-03.1 is independently executable; T-03.2 becomes executable after T-03.1 (T-01.1 is already complete). T-04.1's persistence dependency is satisfied; it remains gated by T-03.2.

---

## E-03: Canonical source and runtime content

**Goal:** Make `CHANGELOG.md` canonical and serve validated changelog Markdown and dated-section identities through the existing runtime-content pipeline.

**Exit gate:** The root source preserves current notes and ordering; the existing channel cache serves current, stale, and bundled content; parser validation derives stable dated identities from exactly the Markdown snapshot returned to clients; existing Help tests and behavior remain intact.

**Depends on:** T-01.1

### T-03.1: Move README changelog into the canonical source file

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** none
- **Files:**
  - `README.md` (modified)
  - `CHANGELOG.md` (new)
- **Intent:** Move all current changelog headings and notes out of `README.md` into a root `CHANGELOG.md`, preserving the existing content and reverse-chronological order. Replace the embedded README section with a link to the canonical file. Preserve exact top-level dated headings as stable, unique release-note identities.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — Do: store approved public product content in the repository `main` branch; Do Not: put secrets or user data in repo content.
- **Verify:** `README.md` links to root `CHANGELOG.md` and contains no duplicate changelog entries; `CHANGELOG.md` contains every previously embedded dated section and note in the same order, with unique stable dated headings.
- **Notes:** Moved all eight dated sections and their entries verbatim, in their original order, into root [`CHANGELOG.md`](../../../CHANGELOG.md); replaced the README content with a link. Manually compared the moved text with the prior README section and verified the dated headings are unchanged and unique, and README contains no duplicate changelog entries. T-03.2 is now unblocked.

### T-03.2: Extend the existing runtime-content path for the changelog channel

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.1, T-03.1
- **Files:**
  - `apps/api/src/lib/helpContent.ts` (modified only as needed to reuse its existing GitHub transport, allowlist, validation, and channel payload conventions)
  - `apps/api/src/lib/changelogContent.ts` (new; channel-specific parse/identity validation)
  - `apps/api/src/lib/bundledChangelog.ts` (new; bundled fallback following existing runtime-content convention)
  - `apps/api/src/lib/helpRefresh.ts` (modified only as needed to use the existing refresh/store boundary for the changelog channel)
  - `apps/api/src/server.ts` (modified only as needed to schedule the changelog channel refresh without blocking startup)
  - `apps/api/src/lib/helpContent.test.ts` (modified if shared loader contracts change)
  - `apps/api/src/lib/changelogContent.test.ts` (new)
  - `apps/api/src/lib/helpRefresh.test.ts` (modified if shared refresh handling changes)
  - `packages/database/src/helpContentStore.ts` (reference; modify only if required by the approved design, not to create a parallel cache)
- **Intent:** Add a `changelog` channel to the existing backend-owned repository-content pipeline, using its raw GitHub transport and existing channel-keyed validated cache. Allow only the exact root `CHANGELOG.md` source for this channel. Validate safe Markdown and unique top-level dated headings, and return those identities alongside the exact validated Markdown snapshot. Preserve last-valid-cache behavior and provide a bundled fallback synchronized with the canonical source. Keep Help channel behavior and APIs unchanged; do not add a second fetcher, cache table, or refresh UI.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — Do: fetch server-side from raw `main`, use explicit allowlisted source paths, cache successful validated payloads, provide bundled defaults, retain valid cache on failure, and keep startup non-blocking; Do Not: frontend-fetch GitHub or expose unvalidated content. [ADR 0015](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) — avoid unrelated Help content or behavior changes.
- **Verify:** Tests cover exact path allowlisting, valid Markdown plus extracted section identities, duplicate/malformed dated headings and unsafe Markdown rejection, source snapshot/identity consistency, cache success and last-valid preservation on failed/invalid refresh, bundled fallback, and non-blocking startup. Existing Help loader/refresh tests continue to pass. Database-design's cache-fit conclusion is satisfied without a new changelog cache table.
- **Notes:** Implemented channel-specific validation/loading in `changelogContent.ts`, using the existing raw GitHub URL base, `HelpFetcher`, raw fetch function, safe Markdown boundary, channel-keyed `HelpContentStore`, last-valid preservation, and bundled fallback. The cache content payload contains validated Markdown and its exact dated-section identity array together; cache reads re-parse Markdown and verify identities, content hash, channel, schema version, and allowlisted source path. Added the `changelog` startup refresh after listen, with fire-and-forget semantics matching Help, and bundled Markdown synchronized by a regression test to root `CHANGELOG.md`. Focused coverage includes exact path allowlisting, valid content/identity extraction, duplicate and malformed dates, unsafe Markdown, relative-link policy isolation from Help, same-snapshot consistency, cache replacement, failed/invalid refresh preservation, bundled fallback, startup non-blocking behavior, and existing Help regressions. Focused verification passed: `corepack pnpm --filter @portfolio-engineering/api exec tsx --test src/lib/changelogContent.test.ts src/lib/helpRefresh.test.ts` (14 passed, 0 failed); `corepack pnpm --filter @portfolio-engineering/api lint` (0 warnings, 0 errors). These satisfy the task's bounded Verify conditions, including existing Help loader/refresh behavior. Package-wide API typecheck/test remain blocked by the known pre-existing `helpRefresh.test.ts` typing issue present on `upstream/main`; the reported defect is unrelated and was not introduced by T-03.2. T-03.2 is done; T-04.1 is unblocked.

---

## E-04: Authenticated API boundary

**Goal:** Expose the changelog snapshot and unread/acknowledgment operations through the existing authenticated API boundary.

**Exit gate:** Authenticated clients can load validated content with section identities and user-specific unread state, record only identities represented by the rendered source snapshot, and trigger a controlled changelog refresh through the existing channel refresh/store boundary. The API trusts verified request identity, not client-provided user or organization identifiers. No Change Log page refresh control is added.

**Depends on:** E-02, E-03

### T-04.1: Add authenticated changelog read and acknowledgment operations

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.1, T-03.2
- **Files:**
  - `apps/api/src/plugins/changelog.ts` (new)
  - `apps/api/src/plugins/changelog.test.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified)
  - `packages/shared-types/src/changelog.ts` (new)
  - `packages/shared-types/src/index.ts` (modified)
  - `packages/validation/src/changelog.ts` (new)
  - `packages/validation/src/index.ts` (modified)
  - `packages/database/src/changelogAcknowledgmentStore.ts` (reference)
- **Intent:** Add authenticated application operations for reading the validated changelog snapshot, its dated-section identities and freshness metadata, the current user's unread identities, and recording acknowledgment for identities from the content snapshot. Use the existing database store and `request.user` identity. Validate request/response shapes and ensure posted identities cannot acknowledge sections absent from the referenced rendered snapshot. Return explicit errors for invalid input or persistence failures; do not add a public API.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do: take `organizationId` and `userId` from verified auth context and scope reads/writes by both; Do Not: trust tenant/user IDs from the body. [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — expose only validated content through backend APIs and include freshness/fallback status. [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — use the same verified user ownership in both deployment modes.
- **Verify:** Fastify injection tests prove unauthenticated access is denied; valid reads return Markdown and matching section identities from the same snapshot plus user-specific unread state; writes for user A do not alter user B; invalid or non-snapshot identities are rejected; concurrent writes merge idempotently; failed writes return a non-success response and do not report the identities as acknowledged. API/shared-types/validation checks pass.
- **Notes:** Added `GET /api/changelog` and `POST /api/changelog/acknowledgments` under the existing protected route plugin. The read response returns validated Markdown, identities from the same content snapshot, its SHA-256 content version, cache/bundled source and freshness metadata, and unread identities computed from the active verified user's scoped acknowledgment set. Acknowledgment requests require the exact snapshot content version and valid dated identities; mismatched snapshots return 409, malformed or absent identities are rejected, and duplicate requests are deduplicated before the existing idempotent store write. Both store operations use `request.user.organizationId` and `request.user.sub`; client-supplied scope is rejected. Fastify injection coverage verifies authentication, snapshot/identity consistency, per-user unread state, user/organization isolation, malformed/unknown/stale identities, concurrent duplicate writes, and safe persistence failures. Local verification passed: validation typecheck and build passed; API lint passed with 0 warnings and 0 errors; focused changelog API tests passed (7 passed, 0 failed). Package-wide API typecheck was attempted but remains blocked by the pre-existing `helpRefresh.test.ts` typing issue reported as present before T-04.1; the focused API seam and required lint passed. The bounded API seam is accepted for this task, so T-04.1 is done. T-04.2 and T-05.1 are now unblocked.

### T-04.2: Add authenticated manual changelog refresh

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/api/src/plugins/changelog.ts` (modified)
  - `apps/api/src/plugins/changelog.test.ts` (modified)
  - `apps/api/src/lib/helpRefresh.ts` (reference; reuse existing refresh/store boundary)
  - `packages/validation/src/changelog.ts` (modified only if a changelog refresh response contract is needed)
  - `packages/validation/src/index.ts` (modified only if exporting that response contract)
- **Intent:** Provide an authenticated, controlled manual refresh operation for the changelog channel using the same server-side loader, validation, channel-keyed store, and last-valid-cache behavior as automatic refresh. Follow the existing Help refresh route/result pattern; do not add a Change Log page refresh control, another fetcher, or another cache path.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — Do: support controlled manual refresh through the existing runtime-content channel; Do Not: fetch from the frontend or replace valid cached content after a failed/invalid refresh.
- **Verify:** Fastify injection tests prove unauthenticated refresh is denied and authenticated refresh returns the established refresh outcome/status shape; successful refresh writes the validated changelog payload to the existing channel cache; failed/invalid refresh preserves the last valid payload and reports failure without success-shaped content. The operation uses the existing refresh/store boundary and creates no new fetch/cache path or UI control. API validation/typecheck and focused tests pass.
- **Notes:** Added authenticated `POST /api/changelog/refresh` to the existing protected changelog plugin. It calls the existing `refreshChangelog` boundary, using the allowlisted GitHub loader, Markdown validation, channel-keyed `HelpContentStore`, and failure metadata update that preserves the last-valid payload. The response follows the Help refresh shape; no page control, fetcher, or cache path was added. Injection tests cover unauthenticated denial, successful validated payload persistence through the existing changelog channel, failed/invalid outcomes, and preservation/serving of the prior valid snapshot. Verification passed: validation typecheck and build passed; API lint passed with 0 warnings and 0 errors; focused changelog API tests passed (9 passed, 0 failed). The package-wide API typecheck now reports only the two pre-existing `src/lib/helpRefresh.test.ts` errors; the T-04.2 fixture diagnostics are resolved. The fixture correction and verification are documented in [the Spec 0009 debugging log](../../debugging/0009-in-app-changelog-debugging.md). These bounded results satisfy T-04.2's Verify condition. T-04.2 is done and E-04 is complete. T-05.1 is the next recommended task.

---

## E-05: System navigation and Change Log page

**Goal:** Add the accessible System navigation badge and a direct-loadable `/change-log` page that uses the existing Markdown and freshness components.

**Exit gate:** Authenticated users can discover the page, read current or stale valid Markdown, and acknowledge only rendered dated sections. New indicator and failure states match the UX flow and pass focused frontend tests.

**Depends on:** E-04

### T-05.1: Add frontend changelog client and user-specific navigation indicator

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/frontend/src/apiClient.ts` (modified)
  - `apps/frontend/package.json` (modified; register the new focused test in the existing `test` script)
  - `apps/frontend/src/changeLogApi.ts` (new)
  - `apps/frontend/src/changeLogTypes.ts` (new)
  - `apps/frontend/src/ChangeLogNavigation.tsx` (new)
  - `apps/frontend/src/scaffoldRoutes.ts` (modified)
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/changeLogApi.test.ts` (new)
  - `apps/frontend/src/ChangeLogNavigation.test.tsx` (new)
- **Intent:** Add typed methods/hooks for the authenticated changelog and acknowledgment API using the existing `AuthenticatedApiClient`. Add **Change Log** at `/change-log` under the existing **System** group and render a visible, assistive-technology-readable **New** label from the current user's unread state. For an initial unread-state request failure with no confirmed state for this user, omit **New** and show the adjacent polite status “New changelog status couldn't be checked.” For later failures in the same user session, preserve the last confirmed badge state and show that status. Clear confirmed state on profile/account switch and never reuse one user's state for another. The status is visible, accessible, non-interactive, and adds no keyboard focus stop. Do not add a retry control, icon, or notification surface.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — keep major location in the URL; [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — use `NavLink`/declarative route conventions; [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — use semantic tokens and visible focus; [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — reflect the active user's own state.
- **Verify:** Tests prove `/change-log` belongs to the System scaffold route; confirmed unread state renders visible **New**, confirmed read state omits it, and neither state crosses an account/profile switch. For an initial unread-state request failure with no confirmed state, the link has no **New** badge and the adjacent visible polite status reads “New changelog status couldn't be checked.” For a later failure in the same user session, the last confirmed badge state is preserved and the same status is shown; a previously unread **New** remains visible. Verify the status is exposed to assistive technology, is non-interactive, and adds no keyboard focus stop; no extra icon, retry control, or notification surface appears. API failure does not falsely acknowledge sections. The link retains one keyboard focus stop with visible focus. The `apps/frontend` test script executes both `changeLogApi.test.ts` and `ChangeLogNavigation.test.tsx`; frontend typecheck and the registered focused tests pass.
- **Notes:** Added authenticated typed read/acknowledgment client methods, System navigation at `/change-log`, user-scoped unread-state behavior, and an adjacent accessible unknown-state message. Keying the workspace by active user resets confirmed state on account/profile change. Added both focused tests to the existing frontend test script. Initial verification found a missing `useContext` import and two brittle test assertions against apostrophe-escaped static HTML; the import and test assertions were corrected without changing unread-state production behavior. Local verification then passed: frontend typecheck; focused changelog tests (10/10); registered frontend test suite (49/49); and production build. Frontend lint reported 0 errors and 6 warnings. All T-05.1 Verify conditions are satisfied; T-05.2 is unblocked.

### T-05.2: Build the Change Log Markdown page and acknowledgment flow

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-05.1
- **Files:**
  - `apps/frontend/package.json` (modified; register the new page test in the existing `test` script)
  - `apps/frontend/src/ChangeLogPage.tsx` (new)
  - `apps/frontend/src/ChangeLogPage.test.tsx` (new)
  - `apps/frontend/src/changeLogHelpers.ts` (new; reusable payload validation and acknowledgment helpers)
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/components/MarkdownViewer.tsx` (reference; modify only if a necessary accessible rendering gap is found)
  - `apps/frontend/src/components/HelpContentStatus.tsx` (reference; reuse)
  - `docs/uxd/flows/0009-in-app-changelog.md` (reference)
  - `docs/uxd/flows/ui-scaffold-contract.json` (reference)
  - `content/help/index.json` (review for ADR-0015 coverage; change only if an associated Help entry is required, otherwise document explicit deferral in task Notes)
- **Intent:** Register authenticated `/change-log` through React Router and render the complete page using the shared `MarkdownViewer` and Help freshness/status presentation. Implement loading, current, stale-cache, bundled, empty, unavailable, invalid-content, acknowledgment-pending, and acknowledgment-failure behavior from the UX flow. After valid content is rendered, acknowledge exactly its section identities; do not require scrolling or optimistically hide **New** before API confirmation. Refresh navigation unread state after successful acknowledgment. Review Help coverage under ADR-0015 without unrelated Help changes.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — direct load, refresh, back/forward; [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — React Router only; [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — semantic tokens, responsive/reflowing content, keyboard and status accessibility; [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — communicate stale/fallback status, do not fetch GitHub from the frontend; [ADR 0015](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) — review associated Help coverage and explicitly defer or update it.
- **Verify:** Route tests prove direct/refresh-safe `/change-log` and authenticated workspace placement. Static markup/component tests prove semantic heading, accessible Markdown region, visible status states, and accessible **New** state. Tests prove failed/unavailable content does not acknowledge, stale content acknowledges only included identities, later new sections remain unread, confirmed acknowledgment clears only rendered identities, and failed acknowledgment leaves the indicator visible. Review `content/help/index.json` for associated Help coverage and verify either the relevant Help update is included or an explicit deferral and rationale are recorded in task Notes per ADR-0015. The `apps/frontend` test script executes `ChangeLogPage.test.tsx`; existing Help and Markdown tests pass. Manual narrow/wide layout and keyboard/screen-reader review follows the UX contract.
- **Notes:** Implemented the authenticated `/change-log` page with the shared Markdown viewer and content-status pattern, content validation, loading/retry/empty/unavailable states, and post-render acknowledgment of only the returned snapshot identities. Successful acknowledgments refresh the navigation unread state; failed writes preserve **New** and show the specified non-blocking status. Reviewed `content/help/index.json`: it has no Change Log topic or tooltip. Deferred a separate Help entry because this route presents the complete official source and adds no workflow beyond reading it; revisit if System Help is expanded to explain release-note identity or freshness behavior. The focused tests are registered in the existing frontend test script. Moved the non-component helpers into `changeLogHelpers.ts` to eliminate the two new `react(only-export-components)` warnings. User confirmed final verification: frontend typecheck passed; focused changelog tests 22/22; registered frontend suite 61/61; lint 0 errors with 6 baseline warnings; production build passed. Manual wide/narrow review passed, including keyboard/focus order, visible focus, Markdown/content/status presentation, and acknowledgment behavior. All T-05.2 Verify conditions are satisfied; E-05 is complete and T-06.1 is unblocked.

---

## E-06: Governance and acceptance review

**Goal:** Verify the implementation remains within the approved specification, architecture, ADR lifecycle obligations, and UX contract.

**Exit gate:** Governance finds no blocking requirement/architecture drift; all targeted database, backend, and frontend verification is recorded; profile export excludes acknowledgment and profile deletion cleans it up transactionally.

**Depends on:** E-05

### T-06.1: Review changelog implementation against approved contracts

- **Status:** done
- **Owner:** governance
- **Depends on:** T-02.1, T-03.2, T-04.1, T-04.2, T-05.2, T-06.2
- **Files:**
  - `docs/specs/0009-in-app-changelog.md` (reference)
  - `docs/uxd/flows/0009-in-app-changelog.md` (reference)
  - `docs/uxd/flows/ui-scaffold-contract.json` (reference)
  - `docs/ADRs/0001-organization-aware-data-access.md` (reference)
  - `docs/ADRs/0009-use-github-repo-sourced-runtime-content.md` (reference)
  - `docs/ADRs/0013-deployment-modes-and-passwordless-local-profiles.md` (reference)
  - `docs/ADRs/0014-require-delete-backup-review-for-profile-related-data.md` (reference)
  - `docs/ADRs/0015-keep-help-content-synchronized-with-feature-changes.md` (reference)
- **Intent:** Review the final diff and recorded targeted verification against Spec 0009, the approved UX and architecture, and the applicable ADRs. Explicitly confirm that profile backup excludes acknowledgment with a documented rationale, transactional profile deletion removes it, all persisted operations are user/organization scoped, content and dated identities share one validated source snapshot, controlled manual refresh uses the existing channel path, Help coverage was updated or explicitly deferred, and no second content fetcher/cache/notification subsystem was introduced.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — confirm direct organization scope and cross-scope tests; [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — confirm one validated repository runtime-content pipeline and controlled manual refresh; [ADR 0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — confirm hosted account/local profile identity behavior; [ADR 0014](../../ADRs/0014-require-delete-backup-review-for-profile-related-data.md) — confirm backup exclusion is explicit and deletion is tested; [ADR 0015](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) — confirm Help coverage review/deferral is recorded.
- **Verify:** Governance review records no blocking drift, or records each finding with an owning agent and the relevant task blocked. All plan tasks meet their Verify conditions before this task is marked done.
- **Notes:** Initial final governance review found a blocking ADR 0001 conflict: acknowledgment cleanup is transactionally scoped, but the final parent `User` deletion used an ID-only predicate after a scoped pre-read. T-06.2 corrected the parent mutation and passed the database build, 13/13 focused authStore tests, and typecheck (user-reported). Final read-only governance rerun confirmed the `organizationId_id` parent delete and transactional scoped child cleanup; backup exclusion and rationale, scoped acknowledgment operations, validated snapshot identities, rendered-only stale/bundled acknowledgment, shared refresh pipeline, documented Help deferral, approved UX states, and recorded targeted verification all remain aligned. No blocking or non-blocking findings or requirement/ADR drift remain. Package-wide API typecheck still has the pre-existing `helpRefresh.test.ts` typing defect (TD-019); frontend lint remains at 0 errors and six baseline warnings. E-06 exit gate passed.

### T-06.2: Scope profile deletion mutation to organization and user

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/src/authStore.ts` (modified; use existing `organizationId_id` composite unique key for the final User delete predicate)
  - `packages/database/src/authStore.test.ts` (modified; assert the final User delete mutation includes organization and user identity)
- **Intent:** Close the ADR 0001 finding from T-06.1 by directly scoping the final parent `User` delete mutation to both `organizationId` and user identity through the existing composite unique key. Preserve the current transaction, backup behavior, acknowledgment cleanup, and deletion semantics; do not reopen unrelated persistence work or change changelog behavior.
- **ADRs:** [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — Do: include `organizationId` in the mutating statement predicate; Do Not: rely on a scoped pre-read followed by an ID-only mutation.
- **Verify:** Focused profile-deletion tests prove the final `User` delete mutation predicate contains both `organizationId` and the user identity, and existing transactional cleanup, backup exclusion, and rollback behavior remain passing. Run `corepack pnpm --filter @portfolio-engineering/database build`, `corepack pnpm --filter @portfolio-engineering/database exec node --test dist/authStore.test.js`, and `corepack pnpm --filter @portfolio-engineering/database typecheck`; all pass. No schema change is introduced.
- **Notes:** Changed the final `tx.user.delete` to use the existing `organizationId_id` selector with `organizationId: input.organizationId` and `id: user.id`. Updated the success and rollback deletion tests to capture and assert both fields in the final mutation predicate; the transaction, child cleanup, backup, and returned deletion result are unchanged. No shell execution tool was available during implementation, so verification was initially deferred. User-reported local verification on 2026-09-29: `corepack pnpm --filter @portfolio-engineering/database build` passed; `corepack pnpm --filter @portfolio-engineering/database exec node --test dist/authStore.test.js` passed (13/13); `corepack pnpm --filter @portfolio-engineering/database typecheck` passed. All Verify conditions are satisfied; T-06.1 can be rerun.

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | Cache compatibility is confirmed by [the T-01.1 design](../../schema/0009-in-app-changelog-design.md): the existing channel-keyed cache can store the validated Markdown and identities in one content snapshot. | No cache schema change or parallel cache is required; T-03.2 still owns channel-specific payload validation. | database-design | none |
| R-2 | Acknowledgment cleanup is now explicit in the transactional profile-deletion path and covered by passing scoped deletion and rollback tests. | Confirmed against ADR 0014 in the final governance rerun. | database-design | none |
| R-3 | Changelog section headings are the release identity; duplicate, malformed, or later-mutated headings could invalidate unread comparisons. | T-03.2 rejects invalid headings; future content authors must keep published identities stable. | backend-coding | none |
| R-4 | TD-003 leaves generated Prisma-client commit policy under review. | Schema task could produce a noisy or inconsistent generated artifact diff if existing repository convention is not followed. | database-design | none; follow current migration/build practice and record deviation if needed |
| R-5 | TD-014 tracks profile delete/backup review for new profile-owned data. | Backup exclusion and deletion completeness were confirmed by the final governance rerun. | governance | none |
| R-6 | Package-wide API typecheck remains blocked by two pre-existing errors in `apps/api/src/lib/helpRefresh.test.ts`; focused T-04.2 tests pass and report no T-04.2 typing diagnostics. | Tracked as TD-019 for separate correction; not new Spec 0009 drift. | backend-coding | none |
| R-7 | T-05.1 verification found a missing `useContext` import and two test assertions against escaped static HTML; the bounded corrections are verified and T-05.1 is complete. | No remaining blocker for the System navigation indicator; the Change Log page itself remains scoped to T-05.2. | frontend-coding | none |
| R-8 | T-05.2 helper exports initially triggered two new `react(only-export-components)` lint warnings; helpers were moved to a non-component module and final verification passed with only the six baseline warnings. | Resolved; no remaining T-05.2 verification blocker. | frontend-coding | none |
| R-9 | Initial governance review found the final parent `User` delete in `authStore.deleteProfile` was keyed only by ID after a scoped pre-read, contrary to ADR 0001. | T-06.2 changed the delete to use the existing composite organization/user unique key; success and rollback assertions cover both scope fields. User-reported build, 13/13 focused tests, and typecheck passed. Final governance confirmed resolution. | database-design | none |

No product or architecture decision is currently open. T-01.1 resolved the cache compatibility gate; implement the approved design without adding a second cache architecture.

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-28 | Initial plan | Created from ready Spec 0009, completed UXD flow, architecture direction, and existing runtime-content/profile lifecycle patterns. |
| 2026-09-28 | Governance review and UXD unread-state clarification | Added T-04.2 for authenticated manual refresh through the existing runtime-content boundary; made T-05.1 unknown-state behavior and test expectations explicit; registered new frontend tests in the package test script; required measurable ADR-0015 Help review evidence. |
| 2026-09-28 | T-01.1 database design completed | Added the approved persistence design, confirmed existing runtime-cache compatibility, completed E-01, and unblocked T-02.1. |
| 2026-09-28 | T-02.1 blocked pending local verification | Shell/Prisma CLI and repository PostgreSQL execution are unavailable in this session; no persistence changes were made because the approved overlapping relations must be validated before migration. |
| 2026-09-28 | T-02.1 implementation and verification completed | Recorded successful migration status, Prisma generation, typecheck, and 40 passing database tests; reconciled applied index-renaming migrations in task notes, updated the verified schema reference, completed E-02, and made T-03.1 the next recommended task. |
| 2026-09-28 | T-03.1 canonical changelog source created | Moved the README changelog verbatim to root `CHANGELOG.md`, linked it from README, verified preserved section order/identity, and unblocked T-03.2. |
| 2026-09-28 | T-03.2 implementation pending local verification | Added the changelog channel on the existing runtime-content fetch/cache/fallback path and focused regression tests; left the task blocked pending API package typecheck and suite execution. |
| 2026-09-28 | T-04.1 implementation pending local verification | Added protected changelog read/acknowledgment operations, shared response/request contracts, snapshot-bound identity validation, and focused injection tests; recorded exact local checks because shell execution is unavailable. |
| 2026-09-28 | T-04.1 focused verification completed | Recorded passing validation typecheck/build, API lint, and 7 focused API tests; accepted the bounded verification seam despite the pre-existing package-wide API typecheck issue; completed T-04.1 and unblocked T-04.2 and T-05.1. |
| 2026-09-28 | T-04.2 implementation pending local verification | Added protected manual refresh through the existing changelog refresh/store boundary and injection tests for success/failure/invalid preservation; left task and E-04 blocked pending local verification. |
| 2026-09-28 | T-04.2 fixture correction and verification completed | Corrected the test-only persisted JSON/non-null return mock; recorded 9 focused tests passing and package-wide typecheck limited to the pre-existing Help test issue; completed T-04.2 and E-04 and recommended T-05.1. |
| 2026-09-28 | T-05.1 frontend verification completed | Recorded passing typecheck, focused tests (10/10), registered suite (49/49), production build, and lint (0 errors, 6 warnings); marked T-05.1 done and recommended T-05.2. |
| 2026-09-28 | T-05.1 implementation awaiting frontend verification | Added the authenticated frontend changelog client, user-scoped System navigation indicator, `/change-log` scaffold route, accessibility behavior, and registered tests; verification commands remain pending because shell execution is unavailable. |
| 2026-09-28 | T-05.1 verification failure and bounded corrections | Recorded frontend typecheck/test failures; imported the missing React hook and corrected static-markup assertions to compare decoded visible status text. T-05.1 remains blocked pending rerun of frontend verification. |
| 2026-09-29 | T-05.2 implementation awaiting verification | Added the authenticated Change Log Markdown page, snapshot-bound acknowledgment flow, navigation refresh wiring, and registered focused tests. Reviewed and explicitly deferred a separate Help topic; left the task blocked because command and browser verification are unavailable in this session. |
| 2026-09-29 | T-05.2 verification completed | Recorded user-confirmed passing typecheck, focused and registered tests, lint (0 errors and six baseline warnings), build, and wide/narrow manual UI/accessibility review; marked T-05.2 done, completed E-05, and unblocked T-06.1. |
| 2026-09-29 | T-06.1 governance finding | Recorded the ADR 0001 direct-scope conflict in the final parent User delete, added bounded database-design follow-up T-06.2 using the existing composite unique key, and blocked T-06.1 pending that fix and governance rerun. |
| 2026-09-29 | T-06.2 verification completed | Recorded user-reported passing database build, 13/13 focused authStore tests, and database typecheck; marked T-06.2 done and unblocked the T-06.1 governance rerun. |
| 2026-09-29 | Final governance and closeout | Confirmed the ADR 0001 blocker resolved, completed T-06.1 and E-06 with no remaining governance findings, recorded the pre-existing API typecheck limitation as TD-019, synchronized the new canonical changelog section with the bundled fallback, and archived the fully completed plan under `docs/plans/closed/`; rerun the focused changelog content test before commit because shell execution was unavailable during closeout. |
