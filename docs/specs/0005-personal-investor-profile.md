# Personal Investor Profile

## Status

- Readiness: Ready for planning
- Owner: TBD
- Date: 2026-09-06

## Summary

Add a plain-English **Personal Investor Profile** feature to P/OS that enables retail traders—specifically active retail investors using income strategies such as Covered Calls, Cash-Secured Puts, and The Wheel—to capture and manage their trading context, experience level, primary investment objectives, strategy preferences, custom strategy overlays, and free-form AI context.

This feature focuses exclusively on **data capture, schema, backend persistence, and frontend UI**. The available selection options for primary objectives and strategy presets are loaded dynamically from repository-sourced runtime content (per ADR-0009) rather than being hardcoded in application code.

Risk comfort, position sizing limits, and behavioral classifications are explicitly excluded from this spec, as they will be managed in a separate "Rules" feature where users create explicit rules for the AI to classify adherence.

Suggested API surface:
- `GET /api/investor-profile`
- `PUT /api/investor-profile`

## Business objective

Most retail options traders fail in their first year due to a lack of structure, restlessness, or executing trades without grounding them in a clear strategy. 

To help retail traders succeed, future AI workflows (such as journal analysis) will evaluate journal entries against the investor's individual context and strategy. Capturing this profile establishes the durable user context required for high-quality, personalized AI coaching without forcing users to re-explain their strategy in every journal entry.

## Problem / opportunity

- Generic financial questionnaires ask for net worth or abstract 1–10 risk ratings, which fail to capture how retail options traders make decisions day-to-day.
- Options traders often use specific, hybrid strategy overlays (e.g., *"Deep ITM covered call with a buy/write/decide overlay"*) that cannot be captured by simple dropdowns.
- Product content such as available investment objectives and option strategy presets should be published and updated via repository runtime content without requiring code redeployments.
- Traders need a flexible free-form space to provide arbitrary personal context to the AI (e.g., tax considerations, life context, or specific trading focus).
- A structured profile screen creates a reusable context foundation for future AI coaching and review features.

## Desired outcomes

- Users can create, view, edit, and update their Personal Investor Profile per person per organization (`user_id` + `organization_id`).
- Users understand that profile setup is 100% voluntary and can be skipped or filled partially.
- Users see clear, plain-English explanations for how the AI will use each piece of information provided.
- Users select primary objectives and strategy presets loaded dynamically from repo-sourced runtime content (ADR-0009).
- Users can detail custom strategy overlays in Markdown format.
- Users can provide free-form additional context for the AI in Markdown.
- Users can view their saved investor profile as a clean summary card ("My Investor Profile").
- Profile data is stored safely within the user and organization context (`user_id`, `organization_id`).

## Scope

- Database schema and migration for storing per-person, per-organization investor profile records (`user_id` + `organization_id`).
- Predefined JSON runtime content files created in the repository (e.g., `content/investor-profile/objectives.json` and `content/investor-profile/strategies.json`) defining standard primary investment objectives and option strategy presets, along with corresponding bundled fallbacks in code.
- REST API endpoints (`GET` and `PUT` `/api/investor-profile`) with validation.
- Integration with repo-sourced runtime content (ADR-0009) to dynamically fetch and serve available options for Primary Investment Objectives and Strategy Presets, with bundled offline fallbacks.
- Frontend profile page with both an edit form and a read-only summary card view.
- Multi-select and single-select controls driven by repo-sourced runtime content.
- Free-text Markdown editors for custom strategy descriptions and free-form AI context.
- Grounded, plain-English UI copy that strictly avoids "trader bro" jargon (e.g., no *FOMO*, *revenge trading*, *bagholding*, *yield chasing*).

## Non-goals

- **Rules Engine / Risk Comfort & Behavioral Classification**: Defining position sizing rules, risk thresholds, or behavioral classifications (deferred to a separate dedicated "Rules" feature).
- **AI Prompt Integration**: Injecting profile data into AI prompt templates during journal analysis (deferred to Phase 2).
- **Live Broker Sync**: Connecting to external brokerage accounts to fetch balances, positions, or trade executions.
- **Financial Planning / Advice**: Providing tax calculations, specific asset recommendations, or individualized investment advice.

## Functional requirements

### 0. Voluntary Profile Completion & Partial States
- **100% Optional Fields**: Every single field in the Personal Investor Profile is completely optional. Users may save a partially completed profile or choose not to set up a profile at all.
- **Graceful Partial Handling**: AI analysis and downstream features must function properly whether a profile is empty, partially filled, or complete.
- **In-Form Educational Guidance & Glossary Links**: The form UI must display clear, plain-English explanations alongside sections, helping users understand *how* the AI uses each piece of information (e.g., *"Why we ask this: AI uses your primary goal to highlight trades or thesis points that diverge from your intended direction."*). Furthermore, in alignment with the app's educational mission, form copy and labels should be designed to support inline links/tooltips to the app's future glossary tool whenever options concepts (such as assignment, delta, or covered calls) are mentioned.

### 1. Identity & Experience Context
- **Preferred Name / Handle**: Optional string field (up to 100 characters) indicating how the app addresses the user.
- **Experience Level**: Single-select enum (`BEGINNER`, `INTERMEDIATE`, `EXPERIENCED`).
- **Portfolio Context**: Single-select or multi-select enum for account types (`TAXABLE`, `RETIREMENT_IRA`, `LIMITED_CAPITAL`, `OTHER`).

### 2. Primary Investment Objective (Repo-Sourced Content)
- Single-select choices loaded dynamically from GitHub repository runtime content (per ADR-0009) stored in `content/investor-profile/objectives.json`, validated against backend schema, with bundled fallback defaults in code.
- Example repo-sourced keys:
  - `STEADY_INCOME`: Generating steady income on quality stocks I am happy to hold long-term.
  - `PORTFOLIO_GROWTH`: Growing my portfolio steadily using options premium.
  - `LEARNING_MECHANICS`: Learning options mechanics safely with controlled position sizes.
  - `CAPITAL_GROWTH`: Capital growth and higher-yield income.

### 3. Strategies & Custom Description (Repo-Sourced Content)
- **Standard Strategy Presets** (Multi-select array):
  - Choices loaded dynamically from GitHub repository runtime content (per ADR-0009) stored in `content/investor-profile/strategies.json`, with bundled fallback defaults in code.
  - Example repo-sourced keys: `COVERED_CALLS`, `CASH_SECURED_PUTS`, `THE_WHEEL`, `BUY_AND_HOLD`, `CUSTOM_HYBRID`.
- **Custom Strategy Description**: Free-text Markdown field (up to 5,000 characters) allowing users to describe specific setups, entry criteria, or strategy overlays in their own words (e.g., *"Deep ITM covered call with a buy/write/decide overlay"*).

### 4. Free-Form Additional Context
- **Free-Form AI Context**: Free-text Markdown field (up to 5,000 characters) where users can provide any additional notes, personal guidelines, life/tax context, or instructions they want the AI to know when analyzing entries.
- **In-App Explanation**: Accompanying plain-English copy explaining: *"This information will be passed to the AI when analyzing your journal entries. Use this space for any personal preferences, life context, tax considerations, or strategy notes that aren't covered above."*

### 5. Empty Profile Notification Alert
- **Dismissable Empty Profile Alert**: If a user's profile is completely empty (no fields configured), the app will display a gentle, dismissable alert banner linking directly to `/settings/profile`.
- **No Alert for Partial Profiles**: If the profile contains any saved information (even a single field), no empty profile alert is shown.
- **Client-Side Dismissal State**: Dismissing the banner stores a client-side preference (e.g. in `localStorage`) so the banner remains hidden for that session/device after being closed by the user, without requiring server-side state.

### 6. Persistence & Storage
- Exactly one investor profile record per person per organization (`user_id` + `organization_id`).
- Upsert behavior on save (`PUT /api/investor-profile`).
- Schema must support safe empty/partial states when a user has not yet configured a profile.

## Constraints / applicable ADRs

- **ADR-0001 (Organization-Aware Data Access)**: All profile operations must be scoped strictly to the authenticated user (`user_id`) and active `organization_id`.
- **ADR-0002 (URL-Addressable Routing)**: The profile page must be directly navigable via URL at `/settings/profile`.
- **ADR-0004 (React Router for Frontend Navigation)**: Frontend navigation must use standard React Router components and hooks.
- **ADR-0005 (Tailwind CSS & shadcn/ui)**: Form controls and summary cards must be built with shadcn/ui primitives styled via Tailwind CSS.
- **ADR-0007 / ADR-0008 / ADR-0012 (Markdown Editor)**: Custom strategy descriptions and free-form AI context must preserve Markdown integrity and render safely using standard Markdown preview components.
- **ADR-0009 (Use GitHub Repo-Sourced Runtime Content)**: Primary Investment Objective choices and Standard Strategy presets must be sourced server-side from the GitHub repository runtime content source, validated, cached, and served with bundled offline fallbacks.
- **ADR-0013 (Deployment Modes & Local Profiles)**: Profile data must persist reliably in both multi-user and local single-user deployment modes.

## UX handoff context

- **Target Users**: Retail options traders, often beginners or self-directed investors trying to build disciplined trading habits.
- **Core Workflow**: 
  1. User navigates to Profile section in Settings or main nav.
  2. If no profile exists, user sees an encouraging empty state with a "Create Profile" action.
  3. User completes plain-English form sections with sensible defaults.
  4. User views their saved profile summary card, with the option to edit at any time.
- **Tone & Copy Constraints**: Grounded, supportive, and accessible. Avoid financial industry jargon and hypey "trader bro" terms.
- **Educational & Glossary Integration**: Support the app's educational focus by providing explanatory microcopy for why each field matters to the AI, and design labels/terms to link out to the future glossary tool as options terminology is introduced.
- **Content Constraints**: Custom strategy description and free-form AI context text areas must support Markdown formatting and preview.

## Assumptions

1. A profile record belongs to a specific user within a specific organization (`user_id` + `organization_id`).
2. Users can leave optional fields blank (e.g., preferred name, custom strategy text, or free-form context) without blocking profile saving.
3. Repo-sourced runtime content for objectives and strategy presets is cached locally and falls back to bundled defaults if GitHub is unreachable.

## Open questions

None (all open questions resolved).

## Definition of done

- Predefined runtime content JSON files (`content/investor-profile/objectives.json` and `content/investor-profile/strategies.json`) created in the repository root for objectives and strategy presets.
- Database schema created and migrated for per-user, per-organization investor profiles (`user_id` + `organization_id`).
- `GET` and `PUT` `/api/investor-profile` endpoints implemented with Zod validation, organization/user scoping, and integration with ADR-0009 repo-sourced content catalogs.
- UI page built with form inputs, plain-English copy, Markdown description editors, and summary card view.
- Automated tests covering backend API validation, user/organization isolation, repo-content fallback behavior, and profile persistence.

## Acceptance criteria

### Given an authenticated user without a profile
- **When** they view app screens,
- **Then** a dismissable alert banner appears indicating their profile is empty with a link to `/settings/profile`.
- **When** they navigate to `/settings/profile`,
- **Then** they see a clear, plain-English form with safe default selections, repo-sourced options for objectives and strategies, and empty optional fields.

### Given a user filling out the profile form
- **When** they select strategies, enter a custom strategy description using Markdown, enter free-form AI context in Markdown, and click Save,
- **Then** the profile is persisted via `PUT /api/investor-profile` scoped to their `user_id` and `organization_id`.
- **And** the dismissable empty profile alert banner disappears.

### Given a user with a saved profile
- **When** they view the profile route,
- **Then** they see a summary card ("My Investor Profile") displaying their preferences, objectives, custom strategy overlay, and rendered Markdown free-form AI context.
- **When** they click "Edit Profile",
- **Then** the form populates with their previously saved values for editing.

### Given an unauthenticated or cross-organization request
- **When** attempting to access or modify another user's or organization's profile,
- **Then** the API returns a 401/404/403 error preventing unauthorized access.
