# Plan 0005: Personal Investor Profile

- Status: complete
- Date: 2026-09-06
- Spec: [0005-personal-investor-profile](../../specs/0005-personal-investor-profile.md)
- Audience: [coding-agents, database-agents, uxd, governance-agents, humans]

## Progress

Executing agents keep this block current. It is the entry point for any agent resuming this plan.

- Current effort: none
- Completed efforts: E-01, E-02, E-03, E-04
- Blocked tasks: none
- Next recommended task: none; this completed plan is archived.
- Last updated: 2026-09-06 (closeout complete)

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | Data Model & Persistence | 2 | 2 | done |
| E-02 | Runtime Content & Validation Schemas | 3 | 3 | done |
| E-03 | REST API Routes & Integration Tests | 2 | 2 | done |
| E-04 | Frontend Profile UI & Empty Profile Alert | 4 | 4 | done |

## Summary

This plan delivers the Personal Investor Profile feature, providing data capture, storage, and management for retail options traders. It establishes per-user, per-organization database persistence (`user_id` + `organization_id`), leverages repository runtime content (ADR-0009) for dynamic strategy and objective presets, supports Markdown custom strategy overlays and free-form AI context, and adds a dismissable empty profile alert banner.

## Inputs

- Spec readiness at planning time: `Ready for planning` (Spec `0005-personal-investor-profile.md`)
- ADRs reviewed: ADR-0001, ADR-0002, ADR-0004, ADR-0005, ADR-0007, ADR-0008, ADR-0009, ADR-0012, ADR-0013
- UX artifacts used: [ui-scaffold-contract.json](../../uxd/flows/ui-scaffold-contract.json)
- Schema reference: [current.md](../../schema/current.md)
- Intersecting tech debt: none

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR-0001](../../ADRs/0001-organization-aware-data-access.md) | All profile records are scoped to active `organization_id` and authenticated `user_id`. | E-01, E-03 |
| [ADR-0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | Profile page is directly navigable at `/settings/profile`. | E-04 |
| [ADR-0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) | Frontend uses React Router for `/settings/profile` route. | E-04 |
| [ADR-0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | Form inputs, buttons, alerts, and summary cards use Tailwind CSS and shadcn/ui. | E-04 |
| [ADR-0007](../../ADRs/0007-use-cwl-editor-behind-an-owned-markdown-editor.md) | Custom strategy overlay and free-form context use owned Markdown editor. | E-04 |
| [ADR-0008](../../ADRs/0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) | Markdown strategy descriptions and AI context preserve content integrity. | E-02, E-04 |
| [ADR-0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) | Primary Investment Objectives and Strategy Presets are fetched from GitHub repo runtime content with bundled fallbacks. | E-02, E-03 |
| [ADR-0012](../../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md) | Markdown editors remain decoupled behind an owned editor contract. | E-04 |
| [ADR-0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) | Profile persists cleanly in both single-user local profiles and multi-tenant deployment modes. | E-01, E-03 |

## Approach

1. **Database Layer**: Add an `InvestorProfile` model to Prisma with fields for preferred name, experience level, portfolio context, primary objective key, strategy preset keys, custom strategy description (Markdown), and free-form AI context (Markdown). Apply unique constraint on `[organizationId, userId]`.
2. **Repository Runtime Content**: Create JSON content files in `content/investor-profile/objectives.json` and `content/investor-profile/strategies.json` at the repo root, and build a server-side loader with bundled fallback arrays per ADR-0009.
3. **Validation & API**: Define Zod schemas in `packages/validation` for `PUT /api/investor-profile` and catalog queries. Implement Fastify REST endpoints in `apps/api` with ADR-0001 tenancy checks.
4. **Frontend UI**: Build `/settings/profile` page under `SettingsShell`, featuring plain-English copy, repo-sourced options, Markdown description previews, summary card view, and a dismissable empty profile alert banner storing dismissal state in `localStorage`.

## Non-goals

- **Rules Engine / Risk Comfort & Behavioral Classification**: Deferred to a separate dedicated rules feature.
- **AI Prompt Injection**: Passing profile context into AI prompt execution (deferred to Phase 2).
- **Live Broker Sync**: Direct integration with external broker accounts.
- **Financial Planning / Advice**: Providing tax advice or individualized security recommendations.

---

## E-01: Data Model & Persistence

**Goal:** Define the Prisma schema for `InvestorProfile` scoped by `organizationId` and `userId`, run database migrations, export store operations, and update schema documentation.

**Exit gate:** `InvestorProfile` model added to Prisma, migration executed, Prisma client generated, store unit tests passing, and `docs/schema/current.md` updated.

**Depends on:** none

### T-01.1: Prisma Schema & PostgreSQL Migration

- **Status:** done
- **Owner:** database-design
- **Depends on:** none
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified)
- **Intent:** Add `InvestorProfile` model with `organizationId`, `userId`, `preferredName`, `experienceLevel`, `portfolioContext` (json/array), `primaryObjective`, `strategyPresets` (json/array), `customStrategyDescription`, and `freeformAiContext`. Define `@@unique([organizationId, userId])` and foreign key relationships. Create and run Prisma migration.
- **ADRs:** [ADR-0001](../../ADRs/0001-organization-aware-data-access.md) — scope all records to `organizationId`; [ADR-0013](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md) — link profile to `userId`.
- **Verify:** `pnpm --filter @portfolio-engineering/database exec prisma migrate dev` succeeds and generated Prisma client includes `InvestorProfile`.
- **Notes:** Completed. Added InvestorProfile schema and relation fields.

### T-01.2: Store Operations & Schema Documentation

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-01.1
- **Files:**
  - `packages/database/src/investorProfileStore.ts` (new)
  - `packages/database/src/investorProfileStore.test.ts` (new)
  - `packages/database/src/index.ts` (modified)
  - `docs/schema/current.md` (modified)
- **Intent:** Implement `getInvestorProfile(orgId, userId)` and `upsertInvestorProfile(orgId, userId, data)` store functions with unit tests. Document new table structure and relationships in `docs/schema/current.md`.
- **ADRs:** [ADR-0001](../../ADRs/0001-organization-aware-data-access.md) — enforce `organizationId` and `userId` scoping on store calls.
- **Verify:** `pnpm --filter @portfolio-engineering/database test` passes all investor profile store unit tests.
- **Notes:** Completed store implementation, unit tests, and schema documentation.

---

## E-02: Runtime Content & Validation Schemas

**Goal:** Create predefined repository runtime content JSON files, Zod validation schemas, and the server-side runtime content loader with bundled fallbacks.

**Exit gate:** Repository JSON content files exist, Zod validation schemas exported from `packages/validation`, and backend content service successfully resolves repo content or bundled fallbacks.

**Depends on:** E-01

### T-02.1: Predefined Repository Runtime Content Files

- **Status:** done
- **Owner:** coding
- **Depends on:** none
- **Files:**
  - `apps/api/src/lib/investorProfileObjectives.json` (new)
  - `apps/api/src/lib/investorProfileStrategies.json` (new)
- **Intent:** Create initial JSON runtime content files defining standard primary investment objective choices and options strategy presets with plain-English titles, descriptions, and educational hints.
- **ADRs:** [ADR-0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — use raw repository JSON files as runtime content source.
- **Verify:** JSON runtime content files exist and validate as valid JSON.
- **Notes:** Content files created with options-focused plain-English choices.

### T-02.2: Zod Validation Schemas & Shared Types

- **Status:** done
- **Owner:** coding
- **Depends on:** T-02.1
- **Files:**
  - `packages/validation/src/investorProfile.ts` (new)
  - `packages/validation/src/index.ts` (modified)
- **Intent:** Define and export Zod schemas for investor profile payloads (`upsertInvestorProfileSchema`), profile responses, and runtime content catalog schemas (`investorProfileCatalogsSchema`). Ensure all profile fields are optional.
- **ADRs:** [ADR-0008](../../ADRs/0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) — allow safe string content for Markdown fields.
- **Verify:** `pnpm --filter @portfolio-engineering/validation test` passes.
- **Notes:** Exported Zod schemas and TypeScript types.

### T-02.3: Backend Runtime Content Loader & Bundled Fallbacks

- **Status:** done
- **Owner:** coding
- **Depends on:** T-02.1, T-02.2
- **Files:**
  - `apps/api/src/lib/investorProfileContent.ts` (new)
  - `apps/api/src/lib/investorProfileContent.test.ts` (new)
- **Intent:** Implement `getInvestorProfileCatalogs()` in `apps/api/src/lib/` to fetch repo-sourced content per ADR-0009, with bundled inline TypeScript fallback arrays for offline/local use, caching, and Zod validation.
- **ADRs:** [ADR-0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — implement fallback bundling, server-side fetch, and caching for GitHub repo content.
- **Verify:** `pnpm --filter @portfolio-engineering/api test` passes for content loader fallback and validation tests.
- **Notes:** Implemented content loader with bundled fallback arrays and unit tests.

---

## E-03: REST API Routes & Integration Tests

**Goal:** Implement Fastify REST API endpoints for investor profile retrieval, update, and catalog metadata, accompanied by automated integration tests.

**Exit gate:** `GET` and `PUT` `/api/investor-profile` and `GET /api/investor-profile/catalogs` endpoints working and verified via API integration tests.

**Depends on:** E-01, E-02

### T-03.1: Fastify REST API Endpoints

- **Status:** done
- **Owner:** coding
- **Depends on:** T-01.2, T-02.3
- **Files:**
  - `apps/api/src/plugins/investorProfile.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified)
- **Intent:** Implement Fastify routes:
  - `GET /api/investor-profile`: Returns user's profile or null/empty state.
  - `PUT /api/investor-profile`: Validates and upserts user's profile.
  - `GET /api/investor-profile/catalogs`: Returns repo-sourced objectives and strategy presets.
  Enforce active user session and `organizationId` scoping on all endpoints.
- **ADRs:** [ADR-0001](../../ADRs/0001-organization-aware-data-access.md) — ensure strict organization/user auth checks.
- **Verify:** API routes respond correctly to HTTP requests in local dev environment.
- **Notes:** Registered plugin in protected Fastify routes plugin.

### T-03.2: Automated REST API Integration Tests

- **Status:** done
- **Owner:** coding
- **Depends on:** T-03.1
- **Files:**
  - `apps/api/src/plugins/investorProfile.test.ts` (new)
- **Intent:** Write integration tests covering `GET`, `PUT`, and `GET /catalogs` routes:
  - Empty state returns null or default object.
  - Valid `PUT` saves profile and `GET` returns updated fields.
  - Partial updates preserve or overwrite fields as expected.
  - Cross-user and cross-organization requests return 401/403/404.
- **ADRs:** [ADR-0001](../../ADRs/0001-organization-aware-data-access.md) — verify multi-tenant isolation.
- **Verify:** `pnpm --filter @portfolio-engineering/api test` passes all investor profile route tests.
- **Notes:** Integration tests written and passing.

---

## E-04: Frontend Profile UI & Empty Profile Alert

**Goal:** Build the frontend Personal Investor Profile page at `/settings/profile`, summary card view, edit form, and dismissable empty-profile alert banner.

**Exit gate:** Frontend page fully accessible at `/settings/profile`, form and summary card rendering properly, empty profile alert banner displaying and dismissing correctly, and component/routing tests passing.

**Depends on:** E-03

### T-04.1: API Client Hooks & Data Fetching

- **Status:** done
- **Owner:** coding
- **Depends on:** T-03.1
- **Files:**
  - `apps/frontend/src/investorProfileApi.ts` (new)
- **Intent:** Create frontend API functions (`getInvestorProfile`, `updateInvestorProfile`, `getInvestorProfileCatalogs`) to interact with backend `/api/investor-profile` endpoints.
- **ADRs:** none
- **Verify:** Frontend API client successfully fetches and posts profile data to backend.
- **Notes:** Created investor profile API helper.

### T-04.2: Investor Profile Settings Page & Summary View

- **Status:** done
- **Owner:** coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/frontend/src/InvestorProfilePage.tsx` (new)
  - `apps/frontend/src/SettingsShell.tsx` (modified)
  - `apps/frontend/src/App.tsx` (modified)
- **Intent:** Build `/settings/profile` view containing:
  - Header with title, plain-English guidance, and "Edit Profile" toggle.
  - Read-only summary card view ("My Investor Profile") displaying saved preferences and rendered Markdown for custom strategy overlay and free-form context.
  - Edit form with repo-sourced single/multi-selects, experience level select, Markdown preview editors, educational tooltips, and save notification.
- **ADRs:** [ADR-0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — route `/settings/profile`; [ADR-0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — use React Router navigation; [ADR-0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — use Tailwind & shadcn components; [ADR-0007](../../ADRs/0007-use-cwl-editor-behind-an-owned-markdown-editor.md) — Markdown text areas.
- **Verify:** User can navigate to `/settings/profile`, edit, preview Markdown, save, and see updated summary card.
- **Notes:** Completed Investor Profile settings page and integrated into settings shell.

### T-04.3: Dismissable Empty Profile Alert Banner

- **Status:** done
- **Owner:** coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/frontend/src/components/EmptyProfileAlert.tsx` (new)
  - `apps/frontend/src/App.tsx` (modified)
- **Intent:** Create `EmptyProfileAlert` banner that renders on main workspace screens if the profile is completely empty. Includes a link to `/settings/profile` and a dismiss button storing dismissal preference in `localStorage`. Banner automatically hides once any profile field is saved.
- **ADRs:** [ADR-0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — shadcn alert styling.
- **Verify:** Alert banner appears when profile is empty, links to `/settings/profile`, dismisses via close button (persisting in `localStorage`), and disappears permanently once profile is saved.
- **Notes:** Implemented EmptyProfileAlert banner component with window event sync.

### T-04.4: Frontend UI Component & Navigation Tests

- **Status:** done
- **Owner:** coding
- **Depends on:** T-04.2, T-04.3
- **Files:**
  - `apps/frontend/src/InvestorProfilePage.test.tsx` (new)
  - `apps/frontend/src/components/EmptyProfileAlert.test.tsx` (new)
- **Intent:** Add automated React component tests for profile form editing, Markdown previewing, summary card rendering, and empty-profile alert banner dismissal.
- **ADRs:** none
- **Verify:** `pnpm --filter @portfolio-engineering/frontend test` passes all tests.
- **Notes:** Unit test files added for frontend components.

---

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | Repo runtime content fetch fails on offline/airgapped instances | Objective/strategy dropdowns might be empty if fallbacks aren't properly bundled | coding | T-02.3 |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-06 | Initial plan | Created implementation plan from spec 0005-personal-investor-profile |
| 2026-09-06 | Closeout | Plan completed and archived under `docs/plans/closed/` |
