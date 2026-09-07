# ADR Recommendations

> Last updated: 2026-09-06 (Personal Investor Profile closeout)

This document captures closeout-time recommendations for new ADRs, updates to existing ADRs, or explicit no-action determinations.

## How to use this file

- Add recommendations that emerge from completed PRs or branches.
- Prefer concise recommendations tied to concrete architectural implications.
- Update existing entries when a later PR changes the recommendation or resolves it.
- Use the ADR authoring workflow in [0000-template.md](./0000-template.md) when a recommendation is accepted and promoted into a real ADR.

## Current recommendations

### 2026-09-06 Profile deletion and backup closeout

Source batch:

- [0006-profile-deletion-and-backup.md](../plans/0006-profile-deletion-and-backup.md)
- [0006-profile-deletion-and-backup.md](../specs/0006-profile-deletion-and-backup.md)

#### Recommendation 1

- Decision area: profile delete safety and backup coverage for future related data
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Require delete/backup review whenever profile-related data model changes`
- Rationale: The implemented delete flow correctly exports and destroys the current profile, investor profile, and journal data, but future profile-related entities can be added without re-checking the backup contract. The delete operation should always trigger a human review of the backup/export path to ensure any new related data is included before a profile is permanently removed.
- Impacted files, behaviors, or constraints:
  - [authStore.ts](../../packages/database/src/authStore.ts)
  - [DeleteProfileDialog.tsx](../../apps/frontend/src/components/DeleteProfileDialog.tsx)
  - [auth.ts](../../packages/shared-types/src/auth.ts)
  - [schema.prisma](../../packages/database/prisma/schema.prisma)
  - any future profile child records, profile metadata tables, or journal/analysis data added underneath a user profile

### 2026-09-06 Personal Investor Profile closeout

Source batch:

- [0005-personal-investor-profile.md](../plans/closed/0005-personal-investor-profile.md)
- [0005-personal-investor-profile.md](../specs/0005-personal-investor-profile.md)

#### Recommendation 1

- Decision area: repo-sourced runtime content for investor profile objectives & strategies
- Recommendation type: `no action`
- Affected ADR: [0009-use-github-repo-sourced-runtime-content.md](./0009-use-github-repo-sourced-runtime-content.md)
- Suggested ADR title: not applicable
- Rationale: The feature successfully implemented ADR-0009 patterns by fetching runtime preset catalogs from raw repository JSON files with bundled server-side TypeScript fallbacks, offline resilience, and Zod validation.
- Impacted files, behaviors, or constraints:
  - [investorProfileContent.ts](../../apps/api/src/lib/investorProfileContent.ts)
  - [investorProfileObjectives.json](../../apps/api/src/lib/investorProfileObjectives.json)
  - [investorProfileStrategies.json](../../apps/api/src/lib/investorProfileStrategies.json)

#### Recommendation 2

- Decision area: multi-tenant and user-level profile scoping
- Recommendation type: `no action`
- Affected ADR: [0001-organization-aware-data-access.md](./0001-organization-aware-data-access.md), [0013-deployment-modes-and-passwordless-local-profiles.md](./0013-deployment-modes-and-passwordless-local-profiles.md)
- Suggested ADR title: not applicable
- Rationale: The `InvestorProfile` database model and API routes enforce strict scoping per `[organizationId, userId]`, fully honoring tenant boundaries across both single-user local household mode and multi-tenant hosted mode.
- Impacted files, behaviors, or constraints:
  - [schema.prisma](../../packages/database/prisma/schema.prisma)
  - [investorProfileStore.ts](../../packages/database/src/investorProfileStore.ts)
  - [investorProfile.ts](../../apps/api/src/plugins/investorProfile.ts)

### 2026-09-06 Deployment Mode Identity and Session Durability closeout

Source batch:

- [0004-deployment-mode-identity-and-session-durability.md](../plans/closed/0004-deployment-mode-identity-and-session-durability.md)
- [0004-deployment-mode-identity-and-session-durability.md](../specs/0004-deployment-mode-identity-and-session-durability.md)
- [0013-deployment-modes-and-passwordless-local-profiles.md](./0013-deployment-modes-and-passwordless-local-profiles.md)

#### Recommendation 1

- Decision area: hosted organization onboarding and tenant membership
- Recommendation type: `new ADR`
- Affected ADR: [0013-deployment-modes-and-passwordless-local-profiles.md](./0013-deployment-modes-and-passwordless-local-profiles.md)
- Suggested ADR title: `Require explicit organization onboarding for hosted identities`
- Rationale: Runtime validation showed organization-owned resources such as AI connections are correctly shared within an organization, but hosted identities need a first-class pick-or-create organization flow so unrelated users are not implicitly placed into a default tenant.
- Impacted files, behaviors, or constraints:
  - [authSession.ts](../../apps/frontend/src/authSession.ts)
  - [public.ts](../../apps/api/src/plugins/public.ts)
  - [authStore.ts](../../packages/database/src/authStore.ts)
  - future hosted onboarding, membership, invitation, and organization-switching flows

#### Recommendation 2

- Decision area: deployment mode auth boundaries
- Recommendation type: `no action`
- Affected ADR: [0013-deployment-modes-and-passwordless-local-profiles.md](./0013-deployment-modes-and-passwordless-local-profiles.md)
- Suggested ADR title: not applicable
- Rationale: The implemented behavior matches ADR 0013 by using explicit `APP_MODE`, local passwordless profiles, hosted OAuth route isolation, and rejection of local passwordless sessions in hosted mode.
- Impacted files, behaviors, or constraints:
  - [public.ts](../../apps/api/src/plugins/public.ts)
  - [protected.ts](../../apps/api/src/plugins/protected.ts)
  - [App.tsx](../../apps/frontend/src/App.tsx)
  - [ProfilePicker.tsx](../../apps/frontend/src/components/ProfilePicker.tsx)

#### Recommendation 3

- Decision area: database schema for deployment modes and local profiles
- Recommendation type: `no action`
- Affected ADR: not applicable
- Suggested ADR title: not applicable
- Rationale: The feature required no database schema migration because passwordless local profiles are represented by existing `users` rows without `oauth_providers`, refresh tokens already support persisted rotation, and organization-owned AI settings remain intentionally shared within the organization.
- Impacted files, behaviors, or constraints:
  - [current.md](../schema/current.md)
  - [schema.prisma](../../packages/database/prisma/schema.prisma)

### 2026-09-05 Journal Entry AI Analysis closeout

Source batch:

- [0003-journal-entry-ai-analysis.md](../plans/closed/0003-journal-entry-ai-analysis.md)
- [0003-journal-entry-ai-analysis.md](../specs/0003-journal-entry-ai-analysis.md)
- [0003-journal-entry-ai-analysis.md](../uxd/flows/0003-journal-entry-ai-analysis.md)

#### Recommendation 1

- Decision area: provider-neutral streaming AI invocation for product workflows
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Use provider-neutral streaming contracts for product AI workflows`
- Rationale: Journal Entry AI Analysis introduced the first product-facing AI invocation path beyond connection testing, including provider-neutral `streamText` adapters, SSE `chunk`/`done`/`error` envelopes, cancellation propagation, safe error mapping, and product-specific output sizing. Future AI workflows should reuse this boundary rather than inventing feature-specific provider calls or stream formats.
- Impacted files, behaviors, or constraints:
  - [stream.ts](../../packages/ai/src/stream.ts)
  - [journalAnalysis.ts](../../apps/api/src/plugins/journalAnalysis.ts)
  - [journalAnalysisApi.ts](../../apps/frontend/src/journalAnalysisApi.ts)
  - future AI personas, multi-entry analysis, follow-up chat, and other streaming AI surfaces

#### Recommendation 2

- Decision area: transient AI analysis state and route ownership
- Recommendation type: `no action`
- Affected ADR: [0002-url-addressable-routing-and-history-safe-navigation.md](./0002-url-addressable-routing-and-history-safe-navigation.md) and [0004-use-react-router-for-frontend-navigation.md](./0004-use-react-router-for-frontend-navigation.md)
- Suggested ADR title: not applicable
- Rationale: The feature keeps Journal mode/date in the URL and keeps selected connection, streaming progress, partial output, and errors in component state because analysis output is intentionally unsaved and lost on refresh/navigation. Existing routing ADRs already cover this distinction between URL-owned location state and ephemeral component state.
- Impacted files, behaviors, or constraints:
  - [JournalPage.tsx](../../apps/frontend/src/JournalPage.tsx)
  - [JournalAnalysisPanel.tsx](../../apps/frontend/src/components/JournalAnalysisPanel.tsx)

#### Recommendation 3

- Decision area: database schema and persisted analysis history
- Recommendation type: `no action`
- Affected ADR: not applicable
- Suggested ADR title: not applicable
- Rationale: This feature deliberately added no persisted analysis records, prompt history, chat state, embeddings, or provider-result storage, so the current schema documentation remains accurate and no schema ADR action is required.
- Impacted files, behaviors, or constraints:
  - [current.md](../schema/current.md)
  - [journalStore.ts](../../packages/database/src/journalStore.ts)

### 2026-09-05 CWL Editor abandonment

Source batch:

- [0007-use-cwl-editor-behind-an-owned-markdown-editor.md](./0007-use-cwl-editor-behind-an-owned-markdown-editor.md)
- [0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md)

#### Recommendation 1

- Decision area: WYSIWYG editor engine selection
- Recommendation type: `resolved - ADR superseded`
- Affected ADR: [0007-use-cwl-editor-behind-an-owned-markdown-editor.md](./0007-use-cwl-editor-behind-an-owned-markdown-editor.md), superseded by [0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md](./0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md)
- Suggested ADR title: not applicable
- Rationale: Product reported on 2026-09-05 that using CWL Editor proved very difficult and is being abandoned. The documented npm package was never published publicly, leaving a pinned `vendor/inkspan` source build as the only acquisition path, which was not justified for a deferred capability. ADR 0007 bundled two decisions: the engine selection and the owned-wrapper boundary. Only the engine selection is abandoned. ADR 0012 retains the wrapper requirement, leaves the engine unselected, and keeps WYSIWYG behind the shared placeholder.
- Impacted files, behaviors, or constraints:
  - No implementation impact. No CWL, TipTap, ProseMirror, or Inkspan dependency was ever added and no `vendor/inkspan` directory exists.
  - [0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) remains `accepted`; it was authored to be engine-independent. Its two references to ADR 0007 now point at ADR 0012.
  - [0001-portfolio-journal.md](../plans/closed/0001-portfolio-journal.md) references ADR 0007 as a closed-plan input. Left unchanged as an accurate historical record of the decisions in force at that time.
  - Journal continues to use direct Markdown authoring, the owned `MarkdownViewer`, and the shared planned-feature placeholder for WYSIWYG.

#### Recommendation 2

- Decision area: future WYSIWYG engine evaluation
- Recommendation type: `future ADR when scheduled`
- Affected ADR: none
- Suggested ADR title: `Select a WYSIWYG Markdown editor engine`
- Rationale: ADR 0012 deliberately leaves the engine unselected. When WYSIWYG editing becomes a scheduled priority, a new ADR must select an engine and evaluate acquisition practicality, including public registry availability, alongside licensing, accessibility, bundle cost, and Markdown round-trip fidelity. Acquisition practicality is what defeated the previous selection and was not weighted heavily enough the first time.
- Impacted files, behaviors, or constraints:
  - future owned Markdown editor wrapper and its focused tests
  - [0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) supported-subset and round-trip requirements

### 2026-09-05 Initial AI work closeout

Source batch:

- [ai integration.md](../brainstorming/InitialAIWork/ai%20integration.md)
- [ai-provider-connections-feature-brief.md](../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md)
- [repo-sourced-runtime-content-feature-brief.md](../brainstorming/InitialAIWork/repo-sourced-runtime-content-feature-brief.md)
- [actionable-alerts-feature-brief.md](../brainstorming/InitialAIWork/actionable-alerts-feature-brief.md)
- [0009-use-github-repo-sourced-runtime-content.md](./0009-use-github-repo-sourced-runtime-content.md)

#### Recommendation 1

- Decision area: repo-sourced runtime content
- Recommendation type: `no action`
- Affected ADR: [0009-use-github-repo-sourced-runtime-content.md](./0009-use-github-repo-sourced-runtime-content.md)
- Suggested ADR title: not applicable
- Rationale: The discovery batch promoted the runtime content distribution pattern into ADR 0009, including public raw GitHub URLs from `main`, server-side validation, database caching, bundled defaults, and automatic/manual refresh.
- Impacted files, behaviors, or constraints:
  - [repo-sourced-runtime-content-feature-brief.md](../brainstorming/InitialAIWork/repo-sourced-runtime-content-feature-brief.md)
  - future runtime content manifest, cache schema, refresh jobs, and content APIs

#### Recommendation 2

- Decision area: provider-defined BYOK schemas for AI connections
- Recommendation type: `resolved - promoted to ADR`
- Affected ADR: [0010-use-provider-defined-byok-schemas-for-ai-connections.md](./0010-use-provider-defined-byok-schemas-for-ai-connections.md)
- Suggested ADR title: not applicable
- Rationale: Promoted on 2026-09-05. AI provider setup needs dynamic provider-specific fields in the UI and backend validation without provider-specific database columns, which is a durable integration contract for future AI features. ADR 0010 records the registry-owned field schema, common-columns-plus-JSON storage shape, and the rule that adapter support in the running build determines provider usability.
- Impacted files, behaviors, or constraints:
  - [ai-provider-connections-feature-brief.md](../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md)
  - [0002-ai-provider-connections.md](../specs/0002-ai-provider-connections.md)
  - future `packages/ai` provider registry
  - future AI connection APIs and settings UI

#### Recommendation 3

- Decision area: AI provider credential storage
- Recommendation type: `resolved - promoted to ADR`
- Affected ADR: [0011-encrypt-ai-provider-credentials-at-rest.md](./0011-encrypt-ai-provider-credentials-at-rest.md)
- Suggested ADR title: not applicable
- Rationale: Promoted on 2026-09-05. BYOK provider configuration introduces the first reversible secret-at-rest requirement for user-supplied AI credentials, requiring durable rules for encryption, key source, decryption boundaries, and secret-safe API/log behavior. ADR 0011 records AES-256-GCM with per-record IVs, a dedicated crypto utility package, a server-only environment key source, and write-only secret handling. It is scoped to all future recoverable-secret storage, not to AI alone.
- Impacted files, behaviors, or constraints:
  - [ai integration.md](../brainstorming/InitialAIWork/ai%20integration.md)
  - [ai-provider-connections-feature-brief.md](../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md)
  - [0002-ai-provider-connections.md](../specs/0002-ai-provider-connections.md)
  - future AI connection schema, crypto package, and provider invocation paths
  - future non-AI secret storage such as broker credentials and webhook signing keys

#### Recommendation 4

- Decision area: generic actionable alerts
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Use generic actionable alerts for attention-worthy app conditions`
- Rationale: Missing AI provider setup, repo-sourced news, and future market or portfolio conditions need one shared alert model, presentation pattern, and route-safe action contract instead of feature-specific banners and navigation behavior.
- Impacted files, behaviors, or constraints:
  - [actionable-alerts-feature-brief.md](../brainstorming/InitialAIWork/actionable-alerts-feature-brief.md)
  - future alert APIs, alert storage, setup-state checks, and global alert UI

### 2026-09-05 AI provider connections closeout

#### Recommendation 1

 - Decision area: official provider adapter boundary
 - Recommendation type: `no action`
 - Affected ADR: [0010-use-provider-defined-byok-schemas-for-ai-connections.md](./0010-use-provider-defined-byok-schemas-for-ai-connections.md)
 - Suggested ADR title: not applicable
 - Rationale: The completed feature confirms that provider-specific fields, validation, usability, and adapter registration belong in the shared provider registry, while OpenAI-compatible hosts remain a separate future capability. Existing ADR 0010 and the feature spec adequately govern this boundary.
 - Impacted files, behaviors, or constraints:
  - [openai.ts](../../packages/ai/src/providers/openai.ts)
  - [azureOpenAi.ts](../../packages/ai/src/providers/azureOpenAi.ts)
  - [googleGemini.ts](../../packages/ai/src/providers/googleGemini.ts)
  - future provider adapters must use the shared invocation and secret-handling boundaries

#### Recommendation 2

 - Decision area: persisted provider health and attention states
 - Recommendation type: `no action`
 - Affected ADR: [0010-use-provider-defined-byok-schemas-for-ai-connections.md](./0010-use-provider-defined-byok-schemas-for-ai-connections.md)
 - Suggested ADR title: not applicable
 - Rationale: The implementation’s persisted test metadata and derived `ready`, `untested`, `failing`, and `disabled` states are directly documented by the feature specification and current schema documentation; a separate ADR would duplicate those contracts.
 - Impacted files, behaviors, or constraints:
  - [current.md](../schema/current.md)
  - [ai.ts](../../apps/api/src/plugins/ai.ts)
  - [AiConnectionList.tsx](../../apps/frontend/src/components/AiConnectionList.tsx)

#### Recommendation 5

- Decision area: organization-aware data access for AI connections and alerts
- Recommendation type: `update existing ADR`
- Affected ADR: [0001-organization-aware-data-access.md](./0001-organization-aware-data-access.md)
- Suggested ADR title: not applicable
- Rationale: The AI connection brief and alert brief both depend on organization-scoped records or derived organization state, so ADR 0001 should explicitly call out AI provider connections and organization-scoped alerts when those features move into implementation.
- Impacted files, behaviors, or constraints:
  - [0001-organization-aware-data-access.md](./0001-organization-aware-data-access.md)
  - [ai-provider-connections-feature-brief.md](../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md)
  - [actionable-alerts-feature-brief.md](../brainstorming/InitialAIWork/actionable-alerts-feature-brief.md)
  - future AI connection and alert schema/API work

### 2026-08-30 Portfolio Journal closeout

Source batch:

- [0001-portfolio-journal.md](../plans/closed/0001-portfolio-journal.md)
- [0006-use-sunday-through-saturday-weeks.md](./0006-use-sunday-through-saturday-weeks.md)
- [0007-use-cwl-editor-behind-an-owned-markdown-editor.md](./0007-use-cwl-editor-behind-an-owned-markdown-editor.md)
- [0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md)

#### Recommendation 1

- Decision area: Journal calendar-week and Markdown authoring boundaries
- Recommendation type: `no action`
- Affected ADR: [0006-use-sunday-through-saturday-weeks.md](./0006-use-sunday-through-saturday-weeks.md), [0007-use-cwl-editor-behind-an-owned-markdown-editor.md](./0007-use-cwl-editor-behind-an-owned-markdown-editor.md), and [0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md)
- Suggested ADR title: not applicable
- Rationale: This work implemented the Sunday-start Week boundary and deferred WYSIWYG behind the existing owned-wrapper and no-content-loss decisions, so no additional architectural decision is required now.
- Impacted files, behaviors, or constraints:
  - [JournalPage.tsx](../../apps/frontend/src/JournalPage.tsx)
  - [journal.ts](../../apps/api/src/plugins/journal.ts)
  - [MarkdownViewer.tsx](../../apps/frontend/src/components/MarkdownViewer.tsx)
  - future WYSIWYG and media specifications

### 2026-07-26 UI scaffold and routing closeout

Source batch:

- branch `portfolio-os-mindmap-review`
- routing ADR in [0002-url-addressable-routing-and-history-safe-navigation.md](./0002-url-addressable-routing-and-history-safe-navigation.md)
- frontend scaffold implementation in [App.tsx](../../apps/frontend/src/App.tsx) and [scaffoldRoutes.ts](../../apps/frontend/src/scaffoldRoutes.ts)
- UXD baseline updates in [.github/agents/uxd.agent.md](../../.github/agents/uxd.agent.md)

#### Recommendation 1

- Decision area: route-addressable frontend navigation behavior
- Recommendation type: `no action`
- Affected ADR: [0002-url-addressable-routing-and-history-safe-navigation.md](./0002-url-addressable-routing-and-history-safe-navigation.md)
- Suggested ADR title: not applicable
- Rationale: This batch already promoted the route-addressability and history-continuity decision into ADR 0002 and aligned the scaffold implementation to it, so no additional ADR work is required right now.
- Impacted files, behaviors, or constraints:
  - [0002-url-addressable-routing-and-history-safe-navigation.md](./0002-url-addressable-routing-and-history-safe-navigation.md)
  - [App.tsx](../../apps/frontend/src/App.tsx)
  - [scaffoldRoutes.ts](../../apps/frontend/src/scaffoldRoutes.ts)

#### Recommendation 2

- Decision area: educational content provenance and terminology governance
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Standardize glossary terminology and curated training-source governance`
- Rationale: Product direction now depends on industry-standard financial terms with plain-language support and curated external learning sources, which introduces durable cross-team decisions about source quality thresholds, review cadence, stale-link handling, and definition ownership.
- Impacted files, behaviors, or constraints:
  - [ui-scaffold-contract.json](../uxd/flows/ui-scaffold-contract.json)
  - [.github/agents/uxd.agent.md](../../.github/agents/uxd.agent.md)
  - future glossary, training hub, and content-review workflows

### 2026-07-26 UXD-agent setup closeout

Source batch:

- branch `ux-agent-ui-design-react-tailwind`
- UXD-agent instruction updates in [.github/agents/uxd.agent.md](../../.github/agents/uxd.agent.md)
- canonical UX artifact folders in [docs/uxd/](../uxd/)

#### Recommendation 1

- Decision area: UX artifact governance and promotion workflow
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Standardize UX artifact lifecycle from prototype to implementation`
- Rationale: The branch established a canonical UX artifact location and prototype defaults, which introduces a cross-team operating decision about how exploratory design artifacts are named, reviewed, promoted, and archived.
- Impacted files, behaviors, or constraints:
  - [.github/agents/uxd.agent.md](../../.github/agents/uxd.agent.md)
  - [docs/uxd/](../uxd/)
  - contributor workflow for UX review and implementation handoff

#### Recommendation 2

- Decision area: database schema and persistence model
- Recommendation type: `no action`
- Affected ADR: not applicable
- Suggested ADR title: not applicable
- Rationale: This branch only introduced agent instructions and documentation structure, with no changes to application schema, persistence flows, or data contracts.
- Impacted files, behaviors, or constraints:
  - none

### 2026-07-25 auth-aware bootstrap closeout

Source batch:

- PR #3 (`agents/plan-analysis-first-step`)
- related follow-up items in [checklist.md](../tech-debt/checklist.md)

#### Recommendation 1

- Decision area: authentication mode by deployment
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Use OAuth-first auth for SaaS and optional local accounts for self-hosted deployments`
- Rationale: The implementation and follow-up discussion established a meaningful product and architecture split between hosted SaaS auth and self-host/local auth expectations, but that deployment-specific rule is not yet captured in a durable decision record.
- Impacted files, behaviors, or constraints:
  - [architecture.md](../brainstorming/architecture.md)
  - [schema.prisma](../../packages/database/prisma/schema.prisma)
  - future onboarding, credential storage, and invite flows

#### Recommendation 2

- Decision area: session and token lifecycle
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Use short-lived JWT access tokens with persisted refresh-token rotation`
- Rationale: The current branch introduced a durable authentication pattern with JWT access tokens, `httpOnly` refresh cookies, persisted hashed refresh tokens, rotation, and revocation behavior. That pattern is now cross-cutting enough to deserve its own ADR.
- Impacted files, behaviors, or constraints:
  - [public.ts](../../apps/api/src/plugins/public.ts)
  - [protected.ts](../../apps/api/src/plugins/protected.ts)
  - [authStore.ts](../../packages/database/src/authStore.ts)
  - [current.md](../schema/current.md)

#### Recommendation 3

- Decision area: provider identity verification and server-controlled role assignment
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Require provider-verified identity and server-controlled auth role assignment`
- Rationale: This branch removed client-controlled role assignment and shifted identity trust to provider-token verification, which is an important security and authorization rule that future implementations should follow consistently.
- Impacted files, behaviors, or constraints:
  - [oauthIdentity.ts](../../apps/api/src/lib/oauthIdentity.ts)
  - [public.ts](../../apps/api/src/plugins/public.ts)
  - callback payload validation and first-user/admin assignment behavior

#### Recommendation 4

- Decision area: organization-aware data access details
- Recommendation type: `update existing ADR`
- Affected ADR: [0001-organization-aware-data-access.md](./0001-organization-aware-data-access.md)
- Suggested ADR title: not applicable
- Rationale: ADR 0001 already defines direct organization scoping, but the implementation now adds concrete org-scoped uniqueness and lifecycle rules for provider identities, refresh tokens, and JWT-derived request scope that may be worth recording explicitly.
- Impacted files, behaviors, or constraints:
  - [0001-organization-aware-data-access.md](./0001-organization-aware-data-access.md)
  - [schema.prisma](../../packages/database/prisma/schema.prisma)
  - [current.md](../schema/current.md)

#### Recommendation 5

- Decision area: workspace environment loading convention
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Standardize workspace-root environment loading for local applications`
- Rationale: The branch now uses separate but related patterns for API and frontend environment loading, and [TD-002](../tech-debt/checklist.md) confirms that this is becoming a durable repository convention decision rather than a one-off implementation detail.
- Impacted files, behaviors, or constraints:
  - [server.ts](../../apps/api/src/server.ts)
  - [loadWorkspaceEnv.ts](../../apps/api/src/lib/loadWorkspaceEnv.ts)
  - [vite.config.ts](../../apps/frontend/vite.config.ts)
  - local setup and contributor workflow documentation
