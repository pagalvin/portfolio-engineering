# Profile Deletion and Self-Describing Backup

## Status

- Readiness: Ready for planning
- Owner: TBD
- Date: 2026-09-06
- Source: [profile-deletion-and-backup-feature-brief](../brainstorming/profile-deletion-and-backup-feature-brief.md)

## Summary

Provide users with a safe, bounded, and reliable workflow to delete a user/household profile along with all associated personal data (Investor Profile settings, AI context, and Journal entries).

To safeguard personal investment journals and respect data sovereignty, deleting a profile mandates an automated JSON backup download containing all associated records. The downloaded JSON file is self-describing, versioned (`v1.0.0`), and portable, providing human-readable descriptions of all top-level sections so that data can be inspected or imported in future releases.

Suggested API surface:
- `GET /auth/profiles/:id/export` (or `GET /api/profiles/:id/export`)
- `DELETE /auth/profiles/:id` (or `DELETE /api/profiles/:id`)

## Business objective

- **Data Sovereignty & Safety:** Ensure users retain complete ownership of their data by automatically providing an uncorrupted, portable backup before permanently removing records from the database.
- **Accidental Deletion Prevention:** Prevent accidental loss of trading reflections and configurations by enforcing deliberate confirmation requirements (typing the profile's display name or email).
- **Clean Household Lifecycle:** Allow users in both local household mode and hosted mode to clean up test, obsolete, or departing profiles without leaving orphaned records.
- **Foundation for Future Import / Migration:** Establish a canonical, versioned serialization schema for profile and journal data that future migration or restore features can consume.

## Problem / opportunity

1. **No Profile Lifecycle Management:** Currently, profiles cannot be removed once created. As users test features or manage household members, obsolete profiles accumulate in the database.
2. **High Risk of Irreversible Loss:** Journal entries and investor profile configurations contain valuable personal trading history and AI context. Deletion without a verified backup creates an unacceptable risk of data loss.
3. **Cascading Relational Records:** A user record owns multiple dependent entities (`investor_profiles`, `journal_entries`, `refresh_tokens`, and `oauth_providers`). Deleting a profile must cascade cleanly across all relational tables while maintaining strict organization isolation boundaries ([ADR 0001](docs/ADRs/0001-organization-aware-data-access.md)).
4. **Opaque Backups:** Database dumps or raw table exports are difficult for humans to inspect and fragile across version changes. A self-describing format with embedded documentation makes backups human-readable and future-proof.

## Desired outcomes

- Users can view a list of existing profiles and select one to delete.
- Users are presented with a clear confirmation dialog summarizing what will be deleted (display name, email, and the exact count of journal entries).
- Users must type the profile's display name or email address to enable the delete action.
- Initiating deletion automatically triggers a browser download of a versioned, self-describing `.json` backup file.
- The backend cascades deletion across the target profile and all associated records in an atomic transaction.
- If the deleted profile is currently active, the session is cleared and the user is redirected to profile selection (local mode) or login (hosted mode).
- If the final profile in local mode is deleted, the application smoothly transitions to the empty profile creation view.

## Scope

### Included

1. **Self-Describing Backup Schema (`v1.0.0`):**
   - Version metadata header: `version`, `exportedAt`, `appVersion`, `appMode`.
   - Human-readable section descriptions in `_meta.sections`.
   - Normalized `data` payload containing:
     - `profile`: Display name, email, role, created timestamp.
     - `investorProfile`: Experience level, objectives, strategy presets, custom strategy description, and free-form AI context.
     - `journal`: Entry count and array of chronological entries (`localDate`, `content`, timestamps).
2. **Backend API Endpoints:**
   - Export endpoint (`GET /auth/profiles/:id/export`) returning the validated backup payload.
   - Deletion endpoint (`DELETE /auth/profiles/:id`) enforcing organization boundaries, revoking active refresh tokens, and cascading record deletion.
3. **Frontend Confirmation UI:**
   - Profile deletion action accessible from profile selection / management interfaces ([ProfilePicker.tsx](apps/frontend/src/components/ProfilePicker.tsx) and Workspace Settings).
   - Confirmation modal displaying data scope summary and typed confirmation input.
   - Download initiation and progress feedback.
   - Session teardown and navigation upon active profile deletion.
4. **Database & Auth Store Updates:**
   - Store methods for fetching complete user export bundles and deleting profiles with cascade verification in an atomic transaction.

### Non-goals

- **JSON Import / Restore UI:** Parsing and importing backup files into a database will be designed in a separate follow-on feature (though the export format here is designed to support it).
- **Selective Data Export:** Filtering entries by custom date range during deletion backup (standard full backup is required).
- **Cloud Backup Storage:** Uploading backups to third-party cloud storage (Google Drive, Dropbox, AWS S3).
- **Soft Deletion / Trash Bin:** Retaining soft-deleted records in the database with a restore grace period.

## Functional requirements

### 1. Versioned & Self-Describing Backup Payload (`v1.0.0`)

1.1. The backup payload MUST include a root-level version identifier `version: "1.0.0"` conforming to semantic versioning.
1.2. The payload MUST include top-level provenance metadata:
  - `exportedAt`: ISO 8601 UTC timestamp of export generation.
  - `appVersion`: Application version string from `package.json`.
  - `appMode`: Current deployment mode (`"local"` | `"hosted"`).
1.3. The payload MUST include a human-readable `_meta` manifest detailing the contents of all top-level data sections:
```json
{
  "$schema": "https://portfolio-engineering.org/schemas/v1/profile-backup.json",
  "version": "1.0.0",
  "exportedAt": "2026-09-06T19:30:00.000Z",
  "appVersion": "0.1.0",
  "appMode": "local",
  "_meta": {
    "description": "Portfolio Engineering (P/OS) Profile and User Data Backup",
    "sections": {
      "profile": "Core user identity and display attributes",
      "investorProfile": "Investor persona, strategy preferences, and AI context parameters",
      "journal": "Complete chronological journal entries and daily reflections"
    }
  },
  "data": {
    "profile": {
      "displayName": "Alex",
      "email": "alex@local.invalid",
      "role": "member",
      "createdAt": "2026-01-15T12:00:00.000Z"
    },
    "investorProfile": {
      "preferredName": "Alex",
      "experienceLevel": "intermediate",
      "primaryObjective": "long_term_growth",
      "portfolioContext": {},
      "strategyPresets": ["dividend_growth"],
      "customStrategyDescription": "Core & Satellite approach",
      "freeformAiContext": "Focus on high quality dividend growth stocks."
    },
    "journal": {
      "count": 42,
      "entries": [
        {
          "localDate": "2026-09-01",
          "content": "Rebalanced portfolio and reviewed tech allocation.",
          "createdAt": "2026-09-01T14:22:00.000Z",
          "updatedAt": "2026-09-01T14:25:00.000Z"
        }
      ]
    }
  }
}
```
1.4. The `data.profile` section MUST contain `displayName`, `email`, `role`, and `createdAt`. Ephemeral primary keys (`id`, `organizationId`) MUST be omitted to guarantee environment-agnostic portability.
1.5. The `data.investorProfile` section MUST contain investor configuration attributes (`preferredName`, `experienceLevel`, `portfolioContext`, `primaryObjective`, `strategyPresets`, `customStrategyDescription`, `freeformAiContext`), or `null` if the user has not configured an investor profile.
1.6. The `data.journal` section MUST contain `count` (integer) and `entries` (array of journal records with `localDate`, `content`, `createdAt`, `updatedAt`). The array MUST be sorted chronologically by `localDate` ascending.
1.7. Organization-level entities (such as shared `AiConnection` provider API keys) MUST NOT be included in personal user backups.

### 2. Backend Deletion & Export API Contract

2.1. In `APP_MODE=local`, the server MUST expose:
  - `GET /auth/profiles/:id/export`: Returns the validated `ProfileBackupPayload` with headers `Content-Type: application/json; charset=utf-8` and `Content-Disposition: attachment; filename="profile-<slug>-backup-<YYYY-MM-DD>.json"`.
  - `DELETE /auth/profiles/:id`: Deletes the specified user profile and cascades related data.
2.2. In `APP_MODE=hosted`, equivalent endpoints MUST be available under authenticated routes (`GET /api/user/profile/export` and `DELETE /api/user/profile`).
2.3. Both export and deletion operations MUST strictly verify that the target user `:id` exists and belongs to the requesting `organizationId` ([ADR 0001](docs/ADRs/0001-organization-aware-data-access.md)). If the user is not found or belongs to another organization, the endpoint MUST return `404 Not Found`.
2.4. When executing `DELETE /auth/profiles/:id`, the database store MUST execute deletion in an atomic transaction that cascades across:
  - `investor_profiles`
  - `journal_entries`
  - `refresh_tokens`
  - `oauth_providers`
  - `users`
2.5. If deletion succeeds, the endpoint MUST return `200 OK` with `{ "success": true, "deletedProfileId": "<id>" }` or `204 No Content`.

### 3. Frontend Confirmation, Download & Session Workflow

3.1. The UI MUST provide a "Delete Profile" action on individual profile cards in [ProfilePicker.tsx](apps/frontend/src/components/ProfilePicker.tsx) and within Settings.
3.2. Clicking "Delete Profile" MUST open a confirmation dialog (`Dialog` primitive from shadcn/ui) displaying:
  - Profile Display Name and Email.
  - Count of total Journal Entries that will be erased.
  - Investor Profile status (Configured or None).
  - Explicit warning that deletion is permanent and cannot be undone.
3.3. The confirmation dialog MUST require the user to type either the profile's **Display Name** or **Email address** into a confirmation input field before the destructive action is enabled.
3.4. Input matching MUST be case-insensitive and trimmed of leading/trailing whitespace.
3.5. When the user confirms deletion:
  - Step 1: The client MUST fetch the backup payload from the export endpoint and trigger a browser file download using standard Blob / URL.createObjectURL semantics.
  - Step 2: Only after the backup payload is successfully received, the client MUST issue the `DELETE` API request.
  - Step 3: If the export fetch fails (e.g., network error or 500 response), the client MUST abort the deletion step and display an error alert explaining that data was not deleted because the safety backup could not be generated.
3.6. **Active Profile Deletion Handling:**
  - If the profile being deleted is the currently logged-in user:
    - The client MUST clear the active session in memory.
    - In local mode, clear the profile cookie (`portfolio_engineering_profile_id`), revoke session tokens, and redirect to the Profile Picker screen.
    - In hosted mode, clear auth cookies and redirect to the Login screen.
3.7. **Non-Active Profile Deletion Handling:**
  - If the profile being deleted is NOT the currently logged-in user:
    - The modal closes, the profile list in the UI is refreshed immediately, and a success notification toast is displayed.
3.8. **Last Remaining Profile Deletion Handling:**
  - If all profiles in local mode are deleted (0 profiles remaining), the application MUST smoothly transition to the initial "Create Primary Profile" view without crashing or entering an unhandled error state.

---

## UX State & Interaction Matrix

| UI State | User Action / Trigger | Visual Presentation | Primary Action State | Next State / Transition |
| :--- | :--- | :--- | :--- | :--- |
| **Idle (Profile List)** | User clicks "Delete" on profile card | Profile cards listed; trash/delete icon visible per profile | N/A | `CONFIRMATION_OPEN` |
| **Confirmation Open** | Dialog opens; focus moves to input | Warning banner, profile details summary, journal entry count, typed prompt | Disabled ("Download Backup & Delete") | `INPUT_TYPING` |
| **Input Incomplete** | User types partial / mismatched text | Red helper text or prompt: *"Type '[DisplayName]' or '[email]' to confirm"* | Disabled | `INPUT_TYPING` |
| **Input Matched** | Text matches display name or email | Helper text confirms match; button turns active destructive red | Enabled ("Download Backup & Delete") | `PROCESSING` (on click) |
| **Processing (Backup & Delete)** | User clicks confirmation button | Loading spinner; status reads *"Generating backup and deleting profile..."*; inputs disabled | Loading / Disabled | `SUCCESS_RESOLVE` or `ERROR_ALERT` |
| **Backup Error** | Export API returns network error or 500 | Error alert inside dialog: *"Could not generate backup. Deletion was aborted to protect your data."* | Reset to Enabled | Remains in Dialog; safe state |
| **Delete Error** | Deletion API returns 500 | Error alert inside dialog: *"Backup downloaded, but server failed to delete profile. Please try again."* | Reset to Enabled | Remains in Dialog |
| **Success (Active User)** | Deletion succeeds; was active user | Brief success flash; session cleared | N/A | Redirect to Profile Picker (`/`) |
| **Success (Other User)** | Deletion succeeds; was other user | Dialog closes; success toast *"Profile [Name] deleted"*; profile card removed | N/A | Returns to `Idle` |

---

## Accessibility Acceptance Checklist

- [ ] **Keyboard Navigation:** Dialog traps focus appropriately; `Tab` cycles through close button, confirmation input, cancel button, and delete button. `Escape` key dismisses dialog without deleting.
- [ ] **Initial Focus:** When the dialog opens, focus automatically lands on the confirmation text input field.
- [ ] **Screen Reader Semantics:** Dialog has `role="alertdialog"`, `aria-labelledby` pointing to the title ("Delete Profile: [Name]"), and `aria-describedby` pointing to the summary warning text.
- [ ] **Live Announcements:** Progress transitions ("Generating backup...", "Deleting profile...") and error alerts are housed in an `aria-live="polite"` container.
- [ ] **Color & Contrast:** Destructive buttons and warning banners meet WCAG AA contrast (minimum 4.5:1 against card background). Deletion state is indicated with text and icons, not color alone.
- [ ] **Touch Target Size:** Delete trigger buttons and dialog action buttons maintain minimum 44x44px touch targets on mobile viewports.

---

## Constraints / applicable ADRs

- **[ADR 0001: Organization-Aware Data Access](docs/ADRs/0001-organization-aware-data-access.md):**
  - All profile lookup, export, and deletion queries must strictly filter on `organizationId`.
- **[ADR 0002: URL-Addressable Routing and History-Safe Navigation](docs/ADRs/0002-url-addressable-routing-and-history-safe-navigation.md):**
  - Deleting an active profile must execute history-safe navigation back to the root profile picker without leaving broken back-button states.
- **[ADR 0005: Adopt Tailwind CSS and shadcn/ui for Frontend UI](docs/ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md):**
  - Use existing UI primitives (`Dialog`, `Button`, `Input`, `Alert`, `Card`) for the deletion confirmation modal and warning callouts.
- **[ADR 0013: Deployment Modes and Passwordless Local Profiles](docs/ADRs/0013-deployment-modes-and-passwordless-local-profiles.md):**
  - In `local` mode, profile deletion must support synthetic email addresses (`<slug>@local.invalid`) as matching confirmation text.
  - When deleting the currently active local profile, ensure the active profile cookie (`portfolio_engineering_profile_id`) and refresh tokens are cleanly removed.
  - When zero profiles remain in local mode, the application must present the initial profile creation form rather than erroring.

---

## User Impact Assessment

- **Who Benefits:**
  - Multi-user households in local mode who need to clean up unused, duplicate, or test profiles.
  - Users seeking data sovereignty, migration freedom, and permanent local copies of their trading journal reflections and AI context.
- **Who Might Be Disadvantaged:**
  - Users with motor impairments or typing difficulties who must type exact names/emails into a confirmation box.
  - *Mitigation:* Allow either display name OR email address, case-insensitive, with trimmed whitespace. Provide clear placeholder text showing exactly what needs to be typed.
- **Accessibility Implications:**
  - Low-vision and screen-reader users require clear auditory feedback on destructive actions and download status.
  - *Mitigation:* Explicit `role="alertdialog"`, ARIA live region status announcements, and high-contrast destructive UI tokens.
- **Cross-Cultural & Comprehension Risks:**
  - Destructive dialogs often use intimidating or cryptic technical jargon ("Cascade foreign keys", "Purge database entity").
  - *Mitigation:* Use plain, human-centered language: *"This will permanently delete this profile and 42 journal entries. We will automatically download a backup file to your computer before deleting."*
- **Severity of Negative Impact:**
  - Low risk with high user benefit. The mandatory backup download directly eliminates the highest potential risk (unrecoverable accidental data loss).
- **Tradeoff Evaluation:**
  - Requiring a typed confirmation adds a small amount of friction, but for permanent deletion of financial reflection journals, this friction is necessary and protective.

---

## Assumptions

1. Profile deletion is a permanent hard delete in the database; soft-delete or archiving is not required at this stage.
2. The browser is capable of receiving and downloading JSON blobs via standard anchor tag click / `Blob` API mechanics.
3. Restoring data from this backup JSON file will be implemented in a future spec; the schema defined here is the source of truth for that future import tool.
4. Organization records themselves are not deleted when deleting a single user profile; only the user and child records are removed.

## Open questions

*None. All scope, schema, validation, and UX requirements are fully bounded.*

## Definition of done

1. **Schema & Shared Types:**
   - Zod validation schemas and TypeScript types for `ProfileBackupPayload` and `DeleteProfileRequest` added to packages `@portfolio-engineering/shared-types` and `@portfolio-engineering/validation`.
2. **Auth & Database Store:**
   - Store method `getProfileBackup(organizationId, userId)` retrieves all associated user data.
   - Store method `deleteProfile(organizationId, userId)` removes the user and cascades across `journal_entries`, `investor_profiles`, `refresh_tokens`, and `oauth_providers` in an atomic transaction.
3. **API Endpoints:**
   - `GET /auth/profiles/:id/export` produces the versioned JSON payload with proper headers.
   - `DELETE /auth/profiles/:id` executes cascade deletion and returns appropriate HTTP status.
4. **Frontend Components:**
   - Delete action integrated into [ProfilePicker.tsx](apps/frontend/src/components/ProfilePicker.tsx) and Workspace Settings.
   - Confirmation dialog with typed verification, data count summary, and backup download trigger.
   - Proper session teardown and view transitions when deleting active or last profiles.
5. **Testing:**
   - Validation schema tests for backup structure and metadata manifest.
   - Backend integration tests verifying complete cascading deletion and organization boundary enforcement.
   - Frontend unit/component tests for confirmation dialog typing validation, error recovery, and download triggering.

## Acceptance criteria

1. **AC-1 (Self-describing JSON backup payload):** Given an existing profile with an investor profile and journal entries, when an export is requested, the resulting JSON file conforms to schema `v1.0.0`, includes provenance metadata (`exportedAt`, `appVersion`, `appMode`), and contains `_meta.sections` describing `profile`, `investorProfile`, and `journal`.
2. **AC-2 (Typed confirmation validation):** Given the delete confirmation modal, the delete button remains disabled until the user enters text that matches either the profile's display name or email address (case-insensitive, trimmed).
3. **AC-3 (Automated backup download on delete):** When a user confirms profile deletion, the browser initiates download of the `.json` backup file before the database deletion executes.
4. **AC-4 (Safe abort on backup failure):** If the backup export endpoint fails, the frontend aborts the deletion request, leaves the profile intact in the database, and presents an informative error alert.
5. **AC-5 (Atomic relational cascade):** When a profile is deleted, all corresponding records in `investor_profiles`, `journal_entries`, `refresh_tokens`, and `oauth_providers` for that `userId` within the organization are permanently removed in a single atomic transaction.
6. **AC-6 (Organization isolation enforcement):** An export or delete request targeting a `userId` outside the caller's `organizationId` is rejected with `404 Not Found`.
7. **AC-7 (Active profile session teardown):** When a user deletes their currently active profile, the session is invalidated, auth/profile cookies are cleared, and the UI redirects to the Profile Picker or Login screen.
8. **AC-8 (Zero profile transition):** When the last remaining profile in `APP_MODE=local` is deleted, the application smoothly transitions to the initial profile creation view without crashing.

