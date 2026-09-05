# ADR Recommendations

> Last updated: 2026-09-05 (Initial AI work closeout)

This document captures closeout-time recommendations for new ADRs, updates to existing ADRs, or explicit no-action determinations.

## How to use this file

- Add recommendations that emerge from completed PRs or branches.
- Prefer concise recommendations tied to concrete architectural implications.
- Update existing entries when a later PR changes the recommendation or resolves it.
- Use the ADR authoring workflow in [0000-template.md](./0000-template.md) when a recommendation is accepted and promoted into a real ADR.

## Current recommendations

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
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Use provider-defined BYOK schemas for AI connections`
- Rationale: AI provider setup needs dynamic provider-specific fields in the UI and backend validation without provider-specific database columns, which is a durable integration contract for future AI features.
- Impacted files, behaviors, or constraints:
  - [ai-provider-connections-feature-brief.md](../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md)
  - future `packages/ai` provider registry
  - future AI connection APIs and settings UI

#### Recommendation 3

- Decision area: AI provider credential storage
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Encrypt AI provider credentials at rest`
- Rationale: BYOK provider configuration introduces the first reversible secret-at-rest requirement for user-supplied AI credentials, requiring durable rules for encryption, key source, decryption boundaries, and secret-safe API/log behavior.
- Impacted files, behaviors, or constraints:
  - [ai integration.md](../brainstorming/InitialAIWork/ai%20integration.md)
  - [ai-provider-connections-feature-brief.md](../brainstorming/InitialAIWork/ai-provider-connections-feature-brief.md)
  - future AI connection schema, database helpers, and provider invocation paths

#### Recommendation 4

- Decision area: generic actionable alerts
- Recommendation type: `new ADR`
- Affected ADR: none
- Suggested ADR title: `Use generic actionable alerts for attention-worthy app conditions`
- Rationale: Missing AI provider setup, repo-sourced news, and future market or portfolio conditions need one shared alert model, presentation pattern, and route-safe action contract instead of feature-specific banners and navigation behavior.
- Impacted files, behaviors, or constraints:
  - [actionable-alerts-feature-brief.md](../brainstorming/InitialAIWork/actionable-alerts-feature-brief.md)
  - future alert APIs, alert storage, setup-state checks, and global alert UI

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
