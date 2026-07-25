# ADR Recommendations

> Last updated: 2026-07-25 (auth-aware bootstrap closeout recommendations)

This document captures closeout-time recommendations for new ADRs, updates to existing ADRs, or explicit no-action determinations.

## How to use this file

- Add recommendations that emerge from completed PRs or branches.
- Prefer concise recommendations tied to concrete architectural implications.
- Update existing entries when a later PR changes the recommendation or resolves it.
- Use the ADR authoring workflow in [0000-template.md](./0000-template.md) when a recommendation is accepted and promoted into a real ADR.

## Current recommendations

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
