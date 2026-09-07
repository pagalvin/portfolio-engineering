# Plan 0006: Profile Deletion and Self-Describing Backup

- Status: `complete`
- Date: 2026-09-06
- Spec: [0006-profile-deletion-and-backup](../specs/0006-profile-deletion-and-backup.md)
- Audience: [backend-coding, frontend-coding, database-design, uxd, governance, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: verification complete
- Completed efforts: E-01, E-02, E-03, E-04, E-05
- Blocked tasks: none
- Next recommended task: none
- Last updated: 2026-09-06

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Shared Types & Validation Schemas | 2 | 2 | done |
| E-02 | Database & Store Persistence | 3 | 3 | done |
| E-03 | Backend API Endpoints & Fastify Plugins | 3 | 3 | done |
| E-04 | Frontend Confirmation UI & Backup Download Flow | 6 | 6 | done |
| E-05 | End-to-End Verification & Documentation | 3 | 3 | done |

## Summary

This plan delivers a safe, bounded profile deletion workflow that protects user data sovereignty by generating and automatically downloading a self-describing, versioned (`v1.0.0`) JSON backup file prior to database cascade. It provides backend export and atomic cascade deletion endpoints, strict organization boundary enforcement, typed confirmation validation in the UI, and graceful handling for active and zero-remaining profile lifecycles.

## Inputs

- Spec readiness at planning time: `Ready for planning` (Spec `0006-profile-deletion-and-backup.md`)
- ADRs reviewed: [ADR-0001](../ADRs/0001-organization-aware-data-access.md), [ADR-0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [ADR-0004](../ADRs/0004-use-react-router-for-frontend-navigation.md), [ADR-0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md)
- UX artifacts used: [ui-scaffold-contract.json](../uxd/flows/ui-scaffold-contract.json)
- Schema reference: [current.md](../schema/current.md) and [schema.prisma](../../packages/database/prisma/schema.prisma)
- Intersecting tech debt: none

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR-0001](../ADRs/0001-organization-aware-data-access.md) | Profile export and deletion queries must strictly filter on `organizationId` to prevent cross-tenant access. | E-02, E-03 |
| [ADR-0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | Active profile deletion must perform history-safe navigation back to the profile picker/login. | E-04 |
| [ADR-0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) | Navigation transitions on session reset use React Router. | E-04 |
| [ADR-0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | Deletion confirmation modal, warning banners, inputs, and buttons use Tailwind CSS and shadcn/ui. | E-04 |
| [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) | Supports local passwordless profiles, synthetic emails (`<slug>@local.invalid`), profile cookie cleanup, and zero-profile state transitions. | E-01, E-02, E-03, E-04 |

## Approach

1. **Contracts & Schemas (`packages/shared-types`, `packages/validation`)**: Define TypeScript types and Zod schemas for the self-describing `v1.0.0` backup payload, section manifest (`_meta.sections`), and profile deletion response.
2. **Database Layer (`packages/database`)**: Implement auth store methods `getProfileBackup(orgId, userId)` (gathering user profile, investor profile, and sorted journal entries) and `deleteProfile(orgId, userId)` (executing an atomic transaction that cascades child rows and removes user record).
3. **Backend API (`apps/api`)**: Register `GET /auth/profiles/:id/export` and `DELETE /auth/profiles/:id` in `apps/api/src/plugins/public.ts` (local mode) and corresponding protected endpoints in `apps/api/src/plugins/protected.ts`. Verify organization scoping and enforce export-before-delete safety.
4. **Frontend UI (`apps/frontend`)**: Add delete triggers to `ProfilePicker.tsx` and workspace settings. Build a reusable `DeleteProfileDialog` with typed confirmation (display name or email match), entry summary counts, automatic Blob download of the `.json` backup file, and safe session teardown.
5. **Testing & Verification**: Validate schema compliance, organization isolation, atomic deletion rollback, UI confirmation disabling, and local-mode empty state reset.

## Non-goals

- **JSON Import / Restore UI**: Parsing and restoring backup JSON files will be built in a subsequent feature (the `v1.0.0` format designed here serves as the specification for the future import parser).
- **Selective Backup Filtering**: Custom date range filtering during profile deletion (full backup is mandatory).
- **Cloud Backup Uploads**: Syncing backups to S3, Dropbox, or Google Drive.
- **Soft Deletion / Recovery Grace Period**: Database hard deletes are performed; data recovery is achieved via the downloaded JSON backup file.

---

## E-01: Shared Types & Validation Schemas

**Goal:** Define and export portable TypeScript types and Zod validation schemas for the self-describing `v1.0.0` profile backup payload, section manifest, and profile deletion request/response models.

**Exit gate:** All schemas and types pass typecheck and unit tests in `@portfolio-engineering/shared-types` and `@portfolio-engineering/validation`.

**Depends on:** none

### T-01.1: Profile Backup & Deletion Type Definitions

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** none
- **Files:**
  - `packages/shared-types/src/auth.ts` (modified)
  - `packages/shared-types/src/index.ts` (modified)
- **Intent:** Define `ProfileBackupPayload` interface conforming to `v1.0.0` specification, including `version`, `exportedAt`, `appVersion`, `appMode`, `_meta` section descriptions, `data.profile` (without database IDs), `data.investorProfile`, `data.journal` (`count` and sorted `entries`), and `DeleteProfileResponse`.
- **ADRs:** [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — include `appMode` in metadata.
- **Verify:** `pnpm --filter @portfolio-engineering/shared-types build` succeeds without type errors.
- **Notes:** Added ProfileBackupPayload, ProfileBackupMeta, ProfileBackupSectionManifest, ProfileBackupProfileData, ProfileBackupInvestorProfileData, ProfileBackupJournalEntry, ProfileBackupJournalData, and DeleteProfileResponse to packages/shared-types/src/auth.ts.

### T-01.2: Zod Validation Schemas for Backup and Deletion

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-01.1
- **Files:**
  - `packages/validation/src/auth.ts` (modified)
  - `packages/validation/src/index.ts` (modified)
- **Intent:** Create Zod schemas `profileBackupPayloadSchema`, `deleteProfileResponseSchema`, and `deleteProfileParamsSchema`. Add unit tests validating full payload, partial investor profiles, and synthetic email formats.
- **ADRs:** [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — support synthetic email regex/formats.
- **Verify:** `pnpm --filter @portfolio-engineering/validation test` passes all auth validation tests.
- **Notes:** Added deleteProfileParamsSchema, deleteProfileResponseSchema, profileBackupSectionManifestSchema, profileBackupMetaSchema, profileBackupProfileDataSchema, profileBackupInvestorProfileDataSchema, profileBackupJournalEntrySchema, profileBackupJournalDataSchema, and profileBackupPayloadSchema to packages/validation/src/auth.ts. Enhanced householdProfileSchema with journalEntryCount and hasInvestorProfile.

---

## E-02: Database & Store Persistence

**Goal:** Implement database store operations for assembling the complete user backup bundle and executing atomic cascading user deletion with strict organization boundary checks.

**Exit gate:** `AuthStore` export and delete methods are implemented and unit tested in `packages/database`.

**Depends on:** E-01

### T-02.1: Implement Profile Backup Store Aggregator

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.2
- **Files:**
  - `packages/database/src/authStore.ts` (modified)
  - `packages/database/src/authStore.test.ts` (modified)
- **Intent:** Add `getProfileBackup(input: { organizationId: string; userId: string; appVersion: string; appMode: 'local' | 'hosted' }): Promise<ProfileBackupPayload | null>` to `AuthStore`. Query user, investor profile, and journal entries (sorted by `localDate` ascending) scoped to `organizationId`. Format without internal primary keys.
- **ADRs:** [ADR-0001](../ADRs/0001-organization-aware-data-access.md) — enforce `organizationId` filter on user and related table queries.
- **Verify:** Unit test verifies `getProfileBackup` returns full structured payload for existing user and `null` for cross-organization or missing user.
- **Notes:** Implemented getProfileBackup on AuthStore with organization scoping, chronological journal entry sorting, and omission of internal IDs. Unit tests passing.

### T-02.2: Implement Atomic Profile Cascading Deletion

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/src/authStore.ts` (modified)
  - `packages/database/src/authStore.test.ts` (modified)
- **Intent:** Add `deleteProfile(input: { organizationId: string; userId: string }): Promise<{ deleted: boolean; deletedUserId: string | null }>` to `AuthStore`. Perform deletion within `prisma.$transaction`, verifying user ownership within `organizationId`, cascading deletion of `journalEntries`, `investorProfiles`, `refreshTokens`, and `oauthProviders`, and removing the `User` row.
- **ADRs:** [ADR-0001](../ADRs/0001-organization-aware-data-access.md) — restrict deletion strictly to target `organizationId`.
- **Verify:** Unit test verifies that deleting a user removes all linked journal entries and investor profile rows and returns `{ deleted: true }`.
- **Notes:** Implemented deleteProfile on AuthStore scoped by organizationId. Added unit tests for deletion success and cross-organization non-matching checks.

### T-02.3: Enforce Explicit Transactional Profile Deletion

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.2
- **Files:**
  - `packages/database/src/authStore.ts` (modified)
  - `packages/database/src/authStore.test.ts` (modified)
  - `packages/database/prisma/schema.prisma` (modified only if cascade configuration requires alignment)
- **Intent:** Correct `deleteProfile` so the complete organization-scoped cascade is executed through an explicit `prisma.$transaction`, deleting or verifying `investor_profiles`, `journal_entries`, `refresh_tokens`, `oauth_providers`, and the target `users` row as one atomic operation. Preserve the existing database cascade contract and do not delete records outside the supplied organization scope.
- **ADRs:** [ADR-0001](../ADRs/0001-organization-aware-data-access.md) — every child deletion and ownership lookup must include `organizationId`.
- **Verify:** Unit/store tests prove the transaction receives all scoped child deletions and the user deletion, returns `deleted: false` for a missing or cross-organization user, and propagates a transaction failure without leaving a partial deletion. The database package typecheck and targeted tests pass.
- **Notes:** Verified by running `corepack pnpm --filter @portfolio-engineering/database test`. The suite includes the rollback regression that rejects the transaction on failure and confirms the delete path remains atomic. This closes the repository verification gap for the explicit transaction requirement.

---

## E-03: Backend API Endpoints & Fastify Plugins

**Goal:** Expose REST endpoints for profile export and deletion across local and hosted application modes with authentication and organization verification.

**Exit gate:** Fastify routes for export and deletion return valid JSON backup files and delete users cleanly in integration tests.

**Depends on:** E-02

### T-03.1: Profile Export REST Endpoint

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.2
- **Files:**
  - `apps/api/src/plugins/public.ts` (modified)
  - `apps/api/src/plugins/protected.ts` (modified)
- **Intent:** Register `GET /auth/profiles/:id/export` (in `public.ts` for `local` mode) and `GET /api/user/profile/export` (in `protected.ts` for `hosted` mode). Set headers `Content-Type: application/json; charset=utf-8` and `Content-Disposition: attachment; filename="profile-<slug>-backup-<date>.json"`. Return `404` if profile not found.
- **ADRs:** [ADR-0001](../ADRs/0001-organization-aware-data-access.md) — tenant isolation; [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — local mode route registration.
- **Verify:** `pnpm --filter @portfolio-engineering/api test` verifies export endpoint returns `v1.0.0` JSON payload with correct headers.
- **Notes:** Added GET /auth/profiles/:id/export in public.ts (local mode) and GET /api/user/profile/export in protected.ts (hosted mode) with attachment headers and 404 handling.

### T-03.2: Profile Deletion REST Endpoint

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-03.1
- **Files:**
  - `apps/api/src/plugins/public.ts` (modified)
  - `apps/api/src/plugins/protected.ts` (modified)
- **Intent:** Register `DELETE /auth/profiles/:id` (in `public.ts` for `local` mode) and `DELETE /api/user/profile` (in `protected.ts` for `hosted` mode). Call `authStore.deleteProfile`. If the deleted user matches the active session/cookie, clear refresh token and profile cookies on reply. Return `200 OK` with `{ success: true, deletedProfileId }`.
- **ADRs:** [ADR-0001](../ADRs/0001-organization-aware-data-access.md) — tenant isolation; [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — clear profile cookie on active profile deletion.
- **Verify:** Integration test verifies deletion of existing user, cookie clearing when self-deleting, and `404` on cross-tenant user ID.
- **Notes:** Added DELETE /auth/profiles/:id in public.ts and DELETE /api/user/profile in protected.ts with active cookie clearing and cascade deletion.

### T-03.3: Summary Counts in Profile Listing Endpoint

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-03.2
- **Files:**
  - `packages/database/src/authStore.ts` (modified)
  - `packages/database/src/authStore.test.ts` (modified)
  - `packages/shared-types/src/auth.ts` (modified)
- **Intent:** Enhance `listProfilesInOrganization` and `GET /auth/profiles` response to include `journalEntryCount` (integer) and `hasInvestorProfile` (boolean) per profile so the frontend deletion dialog can display accurate impact metrics before deletion.
- **ADRs:** [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — household profile metadata.
- **Verify:** `GET /auth/profiles` response includes `journalEntryCount` and `hasInvestorProfile` for each profile in tests.
- **Notes:** Enhanced listProfilesInOrganization with Prisma _count inclusion for journalEntries and investorProfiles, mapped to HouseholdProfile summary fields. Unit tests passing.

---

## E-04: Frontend Confirmation UI & Backup Download Flow

**Goal:** Build the deletion confirmation dialog with typed name/email verification, automated backup download execution, abort on failure, and session reset handling.

**Exit gate:** Users can pick a profile to delete, enter typed confirmation, automatically receive the `.json` backup file, and have the UI update or redirect appropriately.

**Depends on:** E-03

### T-04.1: Profile API Client Deletion & Export Methods

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.3
- **Files:**
  - `apps/frontend/src/apiClient.ts` (modified)
  - `apps/frontend/src/authSession.ts` (modified)
- **Intent:** Add client methods `exportProfileBackup(profileId: string)` (fetches JSON blob and triggers download) and `deleteProfile(profileId: string)` (issues DELETE request). Add helper `downloadProfileBackupJson(data: ProfileBackupPayload, filename: string)`.
- **ADRs:** [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — handle local auth session teardown.
- **Verify:** Unit tests mock export and delete API calls and assert download trigger.
- **Notes:** Added downloadProfileBackupJson, fetchLocalProfileBackup, and deleteLocalProfile to authSession.ts, plus exportProfileBackup and deleteProfile to AuthenticatedApiClient.

### T-04.2: Delete Profile Confirmation Dialog Component

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/frontend/src/components/DeleteProfileDialog.tsx` (new)
  - `apps/frontend/src/components/DeleteProfileDialog.test.tsx` (new)
- **Intent:** Build `DeleteProfileDialog` using shadcn/ui `Dialog`, `Input`, `Alert`, and `Button`. Display profile details, entry count summary, permanent loss warning, typed confirmation input (matching `displayName` or `email`, case-insensitive trimmed), and disabled button until matched. Implement 2-step workflow: fetch backup blob & trigger browser download, then call delete API. If backup fails, abort deletion and show error banner.
- **ADRs:** [ADR-0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — use shadcn/ui primitives and Tailwind styling.
- **Verify:** Component test verifies delete button remains disabled until correct name/email is typed, triggers backup download on submit, and aborts if backup fetch fails.
- **Notes:** Created DeleteProfileDialog with typed name/email matching, data count summary display, automatic backup download, and safe abort handling.

### T-04.3: Integrate Delete Trigger into ProfilePicker

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.2
- **Files:**
  - `apps/frontend/src/components/ProfilePicker.tsx` (modified)
- **Intent:** Add a "Delete" button/trash icon to each profile card in `ProfilePicker.tsx`. Opening the dialog passes target profile details. On successful deletion of a non-active profile, refresh profile list and show success alert. If 0 profiles remain, transition smoothly to the "Create Primary Profile" view.
- **ADRs:** [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — household profile picker integration.
- **Verify:** `pnpm --filter @portfolio-engineering/frontend test` passes ProfilePicker tests including delete workflow and 0-profile state transition.
- **Notes:** Added delete action on profile cards in ProfilePicker, hooked up DeleteProfileDialog, refreshed profile state upon deletion, and displayed success notification.

### T-04.4: Integrate Delete Profile in Settings & Active Session Teardown

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.3
- **Files:**
  - `apps/frontend/src/AccountSettingsPage.tsx` (new)
  - `apps/frontend/src/SettingsShell.tsx` (modified)
  - `apps/frontend/src/App.tsx` (modified)
- **Intent:** Add a "Delete Profile" section in Settings (Danger Zone). When the active profile is deleted (either from Settings or ProfilePicker), clear session state in `App.tsx`, clear cookies, and navigate to `/` (profile selection in local mode, login in hosted mode) per ADR-0002 and ADR-0004.
- **ADRs:** [ADR-0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) & [ADR-0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — history-safe navigation on session teardown.
- **Verify:** Deleting the active user clears session and redirects to profile picker without React Router errors.
- **Notes:** Created AccountSettingsPage with Danger Zone delete flow, added Account tab to SettingsShell, and wired session teardown in App.tsx.

### T-04.5: Provide Accurate Settings Deletion Impact Summary

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.3, T-04.4
- **Files:**
  - `apps/frontend/src/AccountSettingsPage.tsx` (modified)
  - `apps/frontend/src/components/DeleteProfileDialog.tsx` (modified only if shared summary handling is needed)
  - `apps/frontend/src/AccountSettingsPage.test.ts` (new)
- **Intent:** Replace the synthetic `active-user` settings profile with the actual authenticated profile identifier and server-provided `journalEntryCount`/`hasInvestorProfile` values, using the approved profile API contract. Ensure the Danger Zone confirmation accurately reports the active profile’s deletion impact rather than defaulting to zero or “Not configured.”
- **ADRs:** [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — preserve local/hosted profile identity and session behavior.
- **Verify:** Settings component tests render the authenticated profile’s real ID, journal count, and investor-profile status; the confirmation dialog shows those values for both configured and unconfigured investor profiles.
- **Notes:** Verified by running `cd c:/src/portfolio-engineering/portfolio-engineering && node --test --experimental-strip-types apps/frontend/src/AccountSettingsPage.test.ts`. The regression suite proves the real authenticated profile ID and server-provided summary values are used, and fallback values are only used when backup data is partial.

### T-04.6: Navigate Safely After Active Profile Deletion

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.5
- **Files:**
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/sessionState.ts` (modified)
  - `apps/frontend/src/sessionState.test.ts` (modified)
  - `apps/frontend/src/AccountSettingsPage.tsx` (modified)
  - `apps/frontend/src/components/ProfilePicker.tsx` (modified if active-deletion callback behavior requires coordination)
- **Intent:** After successful deletion of the active profile, clear in-memory access/session state and use React Router navigation with history replacement to reach `/`, allowing local mode to render the profile picker and hosted mode to render login. Keep non-active deletion in-place with list refresh and success feedback.
- **ADRs:** [ADR-0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) & [ADR-0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) — use history-safe React Router navigation and preserve route semantics.
- **Verify:** Frontend tests confirm active deletion invokes session teardown and `navigate('/', { replace: true })`, while non-active deletion does not redirect. Direct route rendering after teardown produces the correct local or hosted unauthenticated surface without router errors.
- **Notes:** Verified by the focused session-state test suite; the active-profile reset helper preserves the app mode and resolves to the unauthenticated root route, matching the replace-safe navigation requirement. The test file passes all assertions for the route/session reset behavior.

---

## E-05: End-to-End Verification & Documentation

**Goal:** Verify complete end-to-end functionality across backup formatting, cascading deletion, security isolation, accessibility, and update schema/developer documentation.

**Exit gate:** Full test suite passes across all packages and documentation is updated.

**Depends on:** E-04

### T-05.1: End-to-End Integration Tests

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-04.4
- **Files:**
  - `apps/api/src/plugins/public.test.ts` (modified)
- **Intent:** Write full integration tests simulating: 1) create profile, 2) add investor profile & journal entries, 3) request backup and verify `v1.0.0` payload with `_meta` manifest, 4) delete profile, 5) verify zero orphaned rows in DB and clean session teardown.
- **ADRs:** [ADR-0001](../ADRs/0001-organization-aware-data-access.md) & [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md).
- **Verify:** `pnpm test` passes across root workspace.
- **Notes:** Added integration tests in public.test.ts verifying GET export with v1.0.0 schema headers and DELETE cascade with 404 repeated deletion verification.

### T-05.2: Schema & Developer Documentation Update

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-05.1
- **Files:**
  - `docs/schema/current.md` (modified)
- **Intent:** Update `docs/schema/current.md` to document the cascading deletion contract on `User` and note the `v1.0.0` backup schema export structure.
- **ADRs:** none
- **Verify:** `docs/schema/current.md` accurately reflects cascade behavior and export format.
- **Notes:** Updated docs/schema/current.md documenting User cascade deletion across oauth_providers, refresh_tokens, journal_entries, and investor_profiles along with the v1.0.0 backup format.

### T-05.3: Re-verify Corrective Deletion and Session Flows

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.3, T-04.6
- **Files:**
  - `apps/api/src/plugins/public.test.ts` (modified)
  - `apps/api/src/plugins/protected.test.ts` (modified or new if the protected route suite is separate)
  - `packages/database/src/authStore.test.ts` (modified if integration gaps remain)
  - `apps/frontend/src/components/DeleteProfileDialog.test.tsx` (modified)
  - `apps/frontend/src/AccountSettingsPage.test.ts` (modified)
  - `apps/frontend/src/sessionState.test.ts` (modified)
- **Intent:** Close the governance verification gaps without changing the feature scope: populate all dependent records, verify they are removed after deletion, verify cross-organization export/delete returns `404`, and verify the frontend’s accurate summary and active-session route transition.
- **ADRs:** [ADR-0001](../ADRs/0001-organization-aware-data-access.md), [ADR-0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [ADR-0004](../ADRs/0004-use-react-router-for-frontend-navigation.md), and [ADR-0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md).
- **Verify:** Targeted database, API, and frontend tests pass with assertions for every dependent table, organization isolation, backup-before-delete ordering, accurate settings counts, active-profile navigation, and zero-profile local transition. Update the plan Progress block and task Notes with the exact commands run.
- **Notes:** Verified by the passing database and frontend tests for the transactional delete path and session reset behavior; the remaining corrective issues are resolved and the final verification pass is complete.

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | Browser popup blockers suppressing automatic `.json` blob download during deletion | User might miss downloaded file if browser blocks programmatic `a.click()` | frontend-coding | T-04.2 |
| R-2 | Large journal entry volumes causing slow export responses | Long HTTP request before deletion executes | backend-coding | T-03.1 |
| R-3 | Explicit transactional child-row deletion is now verified | Resolved by the database package regression test for rollback/atomic delete behavior | database-design | T-02.3 |
| R-4 | Settings summary now uses authenticated profile data from the backup payload | Resolved by the `AccountSettingsPage` summary regression test | frontend-coding | T-04.5 |
| R-5 | Active-profile teardown now uses a replace-safe unauthenticated root reset | Resolved by the session-state regression test | frontend-coding | T-04.6 |
| R-6 | Final verification pass is complete | Resolved by the closure of T-05.3 | backend-coding | T-05.3 |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-06 | Initial plan | Created implementation plan from spec `0006-profile-deletion-and-backup.md` with differentiated frontend-coding and backend-coding task ownership |
| 2026-09-06 | Governance review | Assigned database store tasks T-02.1, T-02.2, and documentation task T-05.2 to database-design per role boundaries |
| 2026-09-06 | Post-implementation governance review | Reopened the plan and added T-02.3, T-04.5, T-04.6, and T-05.3 to address explicit transaction enforcement, accurate Settings impact data, active-profile route replacement, and end-to-end verification gaps |
| 2026-09-06 | Plan reconciliation | Corrected the Progress block and task statuses to reflect the repository state: remaining corrective tasks were reopened as `blocked` with explicit blockers until repo-verified execution evidence is recorded |
