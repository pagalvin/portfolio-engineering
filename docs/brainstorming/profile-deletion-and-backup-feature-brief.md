# Profile Deletion and Backup Feature Brief

- Status: draft
- Date: 2026-09-06
- Source: user brainstorming session on safe profile deletion with automated backup download

---

## Summary

Provide users with a safe, reliable, and friction-reducing mechanism to delete a user/household profile and all associated data (investor profile settings, AI context, and journal entries). 

To prevent accidental data loss and empower data sovereignty, deleting a profile mandates an automated JSON backup download containing all deleted records. The exported JSON payload is self-describing, versioned, and portable so that data can be reconstructed or imported in future releases.

---

## Business Objective

- **Data Sovereignty & Safety:** Ensure users maintain complete ownership of their data by generating an uncorrupted, portable backup before permanently removing records.
- **Accidental Deletion Prevention:** Enforce deliberate confirmation mechanisms (typing profile name/email) to prevent unintended destruction of personal journal history.
- **Clean Household & Profile Lifecycle:** Allow local and hosted users to clean up obsolete, test, or departed household profiles without leaving orphaned records.
- **Future Re-import Foundation:** Establish a canonical, versioned serialization schema for profile and journal data that can serve as the baseline for future export/import/migration workflows.

---

## Problem / Opportunity

### 1. No Way to Delete Profiles
Currently, local household profiles and users cannot be deleted through the UI or API. As users create profiles or experiment with test users, profiles accumulate in the database with no clean lifecycle management.

### 2. High Risk of Irreversible Data Loss
Journal entries, investor preferences, and personalized AI configurations represent valuable personal reflection and investment history. Deleting a profile without an automated safety net creates severe risk of permanent data loss.

### 3. Cascading Data Integrity
In the database schema, a `User` owns:
- `InvestorProfile` (persona, portfolio context, AI context)
- `JournalEntry` (all historical journal reflections)
- `RefreshToken` (session tokens)
- `OAuthProvider` (federated identity records)

Deleting a user must cleanly cascade through all associated data structures while maintaining multi-tenant organization boundary constraints ([ADR 0001](docs/ADRs/0001-organization-aware-data-access.md)).

### 4. Portable, Self-Describing Data Format
Exports should not be opaque database dumps. They must include human-readable descriptions of the major data sections and semantic versioning so any tool or human can understand and reconstruct the data.

---

## Desired User Outcomes

- **As a user managing household profiles**, I can view all existing profiles and choose one to delete.
- **As a user deleting a profile**, I am asked to explicitly confirm the deletion by typing the profile name and/or email address so I do not delete an account by mistake.
- **As a user deleting a profile**, I receive a downloaded JSON file containing all profile and journal data at the exact moment of deletion.
- **As a user reviewing a backup file**, I can inspect the metadata section to understand what each section contains without needing to read source code.
- **As a future user or system**, I can parse the backup file with a defined schema version to restore or import the profile into another P/OS instance.

---

## Scope

### In Scope
1. **Profile Management UI:**
   - Visual list of existing profiles with a delete trigger/button.
   - Dedicated deletion modal with clear warnings detailing all data to be erased (profile info, investor profile, and count of journal entries).
   - Confirmation text input requiring exact match of display name or email.
   - One-click "Download Backup & Delete" workflow that triggers the JSON download and completes the deletion.

2. **Versioned JSON Backup Payload:**
   - Standardized schema header: `version`, `exportedAt`, `appVersion`, `appMode`.
   - Self-describing `_meta.sections` documentation for human readability.
   - Normalized `data` payload containing:
     - `profile`: Display name, email, role, creation timestamp.
     - `investorProfile`: Experience level, objectives, strategy presets, custom strategy notes, and freeform AI context.
     - `journal`: Array of chronological journal entries (`localDate`, `content`, timestamps).

3. **Backend API Endpoints:**
   - `GET /auth/profiles/:id/export` (or equivalent endpoint): Generates the structured backup payload scoped to the organization and user.
   - `DELETE /auth/profiles/:id`: Deletes the user and cascades deletion of investor profile, journal entries, tokens, and OAuth associations within organization boundaries.

4. **Session & State Handling:**
   - If the currently active profile is deleted, automatically clear the active session/cookies and redirect to the Profile Picker (local mode) or Login screen (hosted mode).
   - If the last profile in local mode is deleted, ensure the app resets gracefully to the empty profile creation state.

### Out of Scope (Future Phases)
- Restoring / importing profiles from JSON (the export format is designed for this, but import UI/parsers will be built in a subsequent feature).
- Selective export (e.g., exporting only specific date ranges; this is already handled by Markdown journal export in [journalExport.ts](apps/frontend/src/journalExport.ts)).
- Cloud backup destinations (e.g., S3/Google Drive auto-sync).

---

## Data Schema & Backup Format

### Backup Schema Specification (`v1.0.0`)

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

---

## User Flow & Interaction Design

```
[ Profile List / Settings / Profile Picker ]
                  │
                  ▼ User clicks "Delete Profile"
       ┌──────────────────────┐
       │  Delete Confirmation │
       │        Modal         │
       └──────────┬───────────┘
                  │
                  ├─► Displays summary: Display Name, Email, Entry Count
                  ├─► Explains irreversible action
                  ├─► User enters confirmation text (matches name or email)
                  │
                  ▼ User clicks "Download Backup & Delete"
       ┌──────────────────────┐
       │ 1. Trigger Download  │ ──► Browser prompts save for `profile-<name>-backup-YYYY-MM-DD.json`
       │ 2. Call DELETE API   │ ──► Cascades DB records
       └──────────┬───────────┘
                  │
                  ├─► If deleted profile == active profile:
                  │     └─► Clear auth tokens/cookies & redirect to Profile Picker
                  └─► If deleted profile != active profile:
                        └─► Refresh profile list in UI with success toast
```

---

## Constraints & Applicable ADRs

- **[ADR 0001: Organization-Aware Data Access](docs/ADRs/0001-organization-aware-data-access.md):** Profile deletion and export operations must strictly enforce `organizationId` matching to prevent cross-tenant access or deletion.
- **[ADR 0005: Adopt Tailwind CSS and shadcn/ui](docs/ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md):** Deletion dialogs, warning states, and buttons must use existing UI component primitives (`Dialog`, `Button`, `Input`, `Alert`).
- **[ADR 0013: Deployment Modes and Passwordless Local Profiles](docs/ADRs/0013-deployment-modes-and-passwordless-local-profiles.md):** 
  - In `APP_MODE=local`, profile deletion must support synthetic email addresses (`<slug>@local.invalid`) as matching criteria.
  - If the last remaining profile is deleted in local mode, the application must safely transition to the empty profile creation state.

---

## Definition of Done

1. **Schemas & Types:**
   - TypeScript interfaces and Zod validation schemas added in `@portfolio-engineering/shared-types` and `@portfolio-engineering/validation` for the backup payload and delete profile requests.
2. **Database Layer:**
   - Auth store methods to fetch complete profile backup data and delete user records with cascade verification.
3. **Backend API:**
   - `GET /auth/profiles/:id/export` produces the versioned JSON payload with proper headers.
   - `DELETE /auth/profiles/:id` securely removes the user, associated records, and active refresh tokens.
4. **Frontend UI:**
   - Profile management interface allows picking a profile to delete.
   - Confirmation dialog validates typed name/email before enabling deletion.
   - Automated file download is initiated when deletion is triggered.
   - Session teardown and redirect executed when deleting the active user.
5. **Automated Tests:**
   - Unit tests for backup JSON generation and validation.
   - Integration tests verifying cascading deletion across `investor_profiles`, `journal_entries`, and `refresh_tokens`.
   - Component tests for the deletion dialog validation logic and download handling.
