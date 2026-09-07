# Plan 0007: In-App Help System

- Status: `done`
- Date: 2026-09-07
- Spec: [0007-help-system](../../specs/0007-help-system.md)
- Audience: [coding-agents, database-agents, uxd, governance-agents, humans]

## Progress

- Current effort: E-05
- Completed efforts: E-01, E-02, E-03, E-04, E-05
- Blocked tasks: none
- Next recommended task: none — plan complete
- Last updated: 2026-09-07

| Effort | Title | Tasks | Done | Status |
| --- | --- | --- | --- | --- |
| E-01 | UX and content-contract confirmation | 1 | 1 | done |
| E-02 | Global help cache persistence | 2 | 2 | done |
| E-03 | Backend content boundary and refresh | 4 | 4 | done |
| E-04 | Authenticated help and contextual UI | 4 | 4 | done |
| E-05 | Verification and closeout | 2 | 2 | done |

## Summary

Deliver an authenticated, version-aware in-app help channel backed by validated content from the public repository, durable global cache state, and safe bundled fallbacks. Add `/help` routes alongside Settings in the authenticated System navigation, stable-key topic/tooltip lookup, app-version API (`1.0.0`), asynchronous startup refresh, and authenticated manual refresh without introducing organization notes.

## Inputs

- Spec readiness at planning time: `Ready for planning`; authenticated Help placement and highest-eligible-source ordering are confirmed.
- ADRs reviewed: [ADR 0001](../../ADRs/0001-organization-aware-data-access.md), [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md).
- UX artifacts used: [0007-help-system UX flow](../../uxd/flows/0007-help-system.md), [ui-scaffold-contract.json](../../uxd/flows/ui-scaffold-contract.json).
- Schema reference: [current schema](../../schema/current.md), [schema.prisma](../../../packages/database/prisma/schema.prisma), existing Prisma migrations.
- Intersecting tech debt: TD-003 (generated Prisma client policy) is relevant to migration output; TD-002 environment loading is not a blocker. No profile-related debt applies because organization notes are excluded.

## Applicable ADRs

| ADR | Applies because | Binds efforts |
| --- | --- | --- |
| [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) | Help landing/topic views are major, shareable locations requiring refresh and history preservation. | E-01, E-04 |
| [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) | New `/help` and `/help/:helpKey` routes and settings navigation use React Router. | E-01, E-04 |
| [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) | New React UI must use semantic tokens, Tailwind, and owned shadcn primitives. | E-04 |
| [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) | Help is non-secret repository runtime content requiring allowlisting, validation, database caching, bundled defaults, and controlled refresh. | E-02, E-03, E-04 |
| ADR 0001 | Not applicable to global/system-owned help cache or authenticated reads. It remains relevant only to a future organization-notes feature, which is explicitly out of scope. | none |

## Approach

- Reuse the existing Fastify public/protected plugin split, Prisma client/store pattern, Zod validation packages, authenticated API client, React Router v7 declarative routes, semantic tokens, shadcn primitives, and `MarkdownViewer`.
- Establish one explicit `help` runtime channel under repository-controlled `content/help/` with `index.json`, Markdown pages, tooltip text, and bundled defaults. Backend code alone resolves allowlisted paths and stable keys; clients never fetch GitHub paths.
- Keep cache rows global/system-scoped (no `organizationId`), with a durable last-download-attempt timestamp. Authenticated reads select validated content by effective app version; invalid or newer content never displaces the last valid cache.
- Keep Help inside the existing authenticated workspace shell and use the existing verified-user protected API boundary. Startup refresh is fire-and-forget and must not delay session/app rendering.

## Non-goals

- Organization/shared notes, editing or moderation of official content.
- Search, AI-generated help, translation, arbitrary GitHub sources, executable/remote UI content, or video embeds.
- Replacing the global navigation or broad frontend CSS migration.

---

## E-01: UX and content-contract confirmation

**Goal:** Lock the authenticated route, System navigation entry, responsive/accessibility, and content-contract decisions needed by implementation.

**Exit gate:** UXD confirms `/help` and `/help/:helpKey`, Help beside Settings in the System navigation, settings refresh placement, and the scaffold-aligned information architecture; no unresolved UX decision blocks E-04.

**Depends on:** none

### T-01.1: Confirm help route and interaction contract

- **Status:** done
- **Owner:** uxd
- **Depends on:** none
- **Files:**
  - `docs/uxd/flows/0007-help-system.md` (modified only if clarification is required)
  - `docs/uxd/flows/ui-scaffold-contract.json` (reference)
- **Intent:** Confirm authenticated `/help` and `/help/:helpKey` routes, the Help link beside Settings in the System navigation, Preferences refresh placement, empty/stale/fallback/unavailable states, and accessible responsive behavior against the updated scaffold contract. Do not design organization notes.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — preserve direct load, refresh, and browser history; [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — use declarative routes.
- **Verify:** Written UX confirmation (or documented exception) covers both authenticated routes, the System navigation entry beside Settings, refresh control, status announcements, tooltip behavior, and mobile/tablet/desktop layouts; no open question remains for frontend implementation.
- **Notes:** Confirmed authenticated `/help` and `/help/:helpKey` routes, Help beside Settings in the System navigation, Preferences refresh placement, loading/empty/stale/fallback/unavailable/redirect states, tooltip behavior, responsive layouts, keyboard and screen-reader requirements. Updated the UX handoff and scaffold contract to remove public-access ambiguity.

---

## E-02: Global help cache persistence

**Goal:** Define and implement durable system-scoped storage for validated help payloads and refresh-attempt metadata.

**Exit gate:** Approved persistence contract and migration exist; generated Prisma client/store exports compile; schema documentation records global scope and lifecycle.

**Depends on:** none

### T-02.1: Design help runtime-cache persistence contract

- **Status:** done
- **Owner:** database-design
- **Depends on:** none
- **Files:**
  - `docs/schema/0007-help-system-design.md` (new)
  - `packages/database/prisma/schema.prisma` (reference)
  - `docs/ADRs/0009-use-github-repo-sourced-runtime-content.md` (reference)
- **Intent:** Specify the global/system cache model for the help channel, including channel identity, validated index/content payload representation, effective/content/schema versions, freshness/status, fetched timestamp, `lastDownloadAttemptAt`, uniqueness, and failure/lifecycle semantics. Explicitly exclude `organizationId`; define the application-facing store contract and migration safety.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — cache successful validated payloads globally and keep bundled defaults; [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — document why its organization-owned rule is not applicable.
- **Verify:** Design document names columns/JSON boundaries, constraints, indexes, retention/update behavior, fallback semantics, and store methods consumed by backend tasks; unresolved decisions are listed as blockers rather than guessed.
- **Notes:** Added [0007-help-system-design.md](../../schema/0007-help-system-design.md). The contract defines one global `help` row with validated index/content JSONB, app/content/schema versions, freshness and refresh status, successful fetch time, durable last-attempt time, uniqueness/index policy, retention and fallback behavior, store methods, and additive migration safety. No organization scope is present; no persistence blocker remains for T-02.2.

### T-02.2: Implement Prisma migration and global help store

- **Status:** done
- **Owner:** database-design
- **Depends on:** T-02.1
- **Files:**
  - `packages/database/prisma/schema.prisma` (modified)
  - `packages/database/prisma/migrations/<timestamp>_add_help_runtime_cache/migration.sql` (new)
  - `packages/database/src/helpContentStore.ts` (new)
  - `packages/database/src/helpContentStore.test.ts` (new)
  - `packages/database/src/index.ts` (modified)
  - `packages/database/src/generated/prisma/**` (generated/modified per TD-003 policy)
  - `docs/schema/current.md` (modified)
- **Intent:** Implement the approved global cache schema and store methods for read-last-valid, write-valid-payload, and update-attempt metadata. Ensure no organization relation or tenant filter is introduced and preserve last valid data on failed/invalid refresh.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — database cache is the durable runtime-content boundary; [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — no direct organization scope because this is system-owned.
- **Verify:** Migration applies cleanly to the development database; store tests prove one help-channel cache, durable attempt timestamp updates, successful replacement, and failed-refresh preservation; `pnpm` database typecheck/build and generated-client policy checks pass.
- **Notes:** Implemented `HelpRuntimeCache` as a global/system-scoped table with one unique row per channel, JSON payload-boundary/status checks, and no organization relation or filter. Added `HelpContentStore` methods for read, last-valid selection, validated replacement, attempt metadata, and freshness updates; failed/invalid attempts preserve payload and `fetchedAt`. Added focused store tests. Generated Prisma output remains ignored and is reproducibly produced by the package `generate`/`build` scripts per the current TD-003 repository policy. Verified migration deployment, database-level preservation across an invalid refresh, generated client, typecheck, build, lint, and all 19 database tests.

---

## E-03: Backend content boundary and refresh

**Goal:** Serve validated authenticated help and app-version APIs, plus protected refresh and asynchronous startup refresh.

**Exit gate:** Authenticated APIs return only validated, version-eligible content; protected refresh works for any authenticated active-org user; startup refresh is non-blocking; backend tests cover all fallback and alias cases.

**Depends on:** E-02

### T-03.1: Add help schemas, bundled content, and server-side loader

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-02.2
- **Files:**
  - `packages/shared-types/src/help.ts` (new)
  - `packages/shared-types/src/index.ts` (modified)
  - `packages/validation/src/help.ts` (new)
  - `packages/validation/src/index.ts` (modified)
  - `content/help/index.json` (new)
  - `content/help/pages/**/*.md` (new)
  - `content/help/tooltips/**/*.txt` (new)
  - `apps/api/src/lib/helpContent.ts` (new)
  - `apps/api/src/lib/helpContent.test.ts` (new)
  - `apps/api/src/lib/bundledHelp.ts` (new)
- **Intent:** Define typed/schema-validated index entries, semantic-version eligibility, aliases/redirects/unavailable states, allowlisted `main` raw-GitHub paths, Markdown/plain-text boundaries, safe link/image policy, bundled compatible defaults, and highest-eligible-source selection using Node.js-style semantic-version ordering. Implement loader validation before cache/serve and stable-key resolution without unsanitized path construction.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — raw `main` URLs, explicit channel paths, server validation, bundled defaults, and no arbitrary/user-supplied paths.
- **Verify:** Unit tests reject malformed index, missing references, unsafe/unsupported content, invalid semver, and newer `minAppVersion`; accept aliases/redirects and select the highest configured eligible source; tooltip payloads remain plain text.
- **Notes:** Added shared typed help contracts and Zod schemas with bounded index/content sizes, semver compatibility, entry status/alias/redirect validation, and reference checks. Added repository-controlled initial index, Markdown pages, plain-text tooltip, and validated bundled defaults. Implemented the server-side loader with fixed `main` raw-GitHub allowlisting, stable-key resolution, numeric semver selection, safe Markdown link/image policy, plain-text tooltip checks, and bundled fallback on source failure. Focused tests cover malformed content, unsafe Markdown, missing references, aliases, redirects, unavailable keys, incompatible versions, highest eligible selection, and fallback behavior. Verified API typecheck, build, lint, and tests.

### T-03.2: Expose authenticated version, index, topic, and status APIs

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-03.1
- **Files:**
  - `apps/api/src/plugins/public.ts` (modified)
  - `apps/api/src/plugins/help.ts` (new)
  - `apps/api/src/plugins/help.test.ts` (new)
  - `apps/api/src/app.ts` (modified)
  - `packages/validation/src/help.ts` (modified)
- **Intent:** Add authenticated `GET /api/app-version` returning `{version:"1.0.0"}` and authenticated help read boundaries (`GET /api/help/index`, `GET /api/help/topics/:helpKey`, `GET /api/help/status`). Return canonical redirect metadata, unavailable/missing states, freshness/status metadata, and effective-version fallback without leaking repository paths or technical errors.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — expose only validated content through backend APIs; [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — API supports stable URL topic resolution.
- **Verify:** Fastify injection tests prove unauthenticated reads are rejected by the existing protected boundary, authenticated reads work, the exact version response is `1.0.0`, aliases redirect canonically, removed keys are unavailable, incompatible entries are excluded, and stale/fallback metadata is safe.
- **Notes:** Added the protected help plugin and authenticated `/api/app-version`, `/api/help/index`, `/api/help/topics/:helpKey`, and `/api/help/status` reads. Responses are Zod-validated, omit repository paths, select content eligible for effective version `1.0.0`, expose safe cache/fallback metadata, and return explicit redirect/unavailable states. Added injection coverage for unauthenticated rejection, authenticated reads, alias canonicalization, unavailable topics, and exact app version. Verified API typecheck, build, lint, and all 30 API tests.

### T-03.3: Implement refresh service, protected manual endpoint, and startup trigger

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-03.1, T-02.2
- **Files:**
  - `apps/api/src/lib/helpRefresh.ts` (new)
  - `apps/api/src/plugins/protected.ts` (modified)
  - `apps/api/src/plugins/helpRefresh.test.ts` (new)
  - `apps/api/src/app.ts` or `apps/api/src/server.ts` (modified)
- **Intent:** Orchestrate server-side fetch/validate/cache, record every download attempt timestamp, retain last valid cache on failure, expose authenticated `POST /api/help/refresh` to any verified active-organization user, and invoke refresh asynchronously after startup without blocking listening/session readiness.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — controlled automatic/manual refresh, safe logging, and startup must not require GitHub; [ADR 0001](../../ADRs/0001-organization-aware-data-access.md) — authorization derives from verified context only for the protected operation, while cache remains global.
- **Verify:** Tests show startup listen completes while refresh is pending, successful and failed attempts update timestamp, invalid payload cannot replace valid cache, manual refresh requires auth and accepts users across active organizations, and logs omit raw payload/secrets.
- **Notes:** Implemented remote-only refresh orchestration using the approved global help store: successful validated payloads replace the cache, while failed/invalid attempts update status and timestamp without replacing the last valid payload. Added authenticated `POST /api/help/refresh` within the existing verified-user/active-organization protected plugin, with no client organization input and a global cache shared across organizations. Added safe outcome-only logging and a fire-and-forget startup trigger after `listen` succeeds. Focused tests cover successful/failed/invalid timestamps, replacement protection, startup non-blocking behavior, and unauthenticated refresh rejection. Verified API tests, API lint/typecheck/build, database typecheck/build, and refresh tests.

### T-03.4: Add backend API/client contract integration coverage

- **Status:** done
- **Owner:** backend-coding
- **Depends on:** T-03.2, T-03.3
- **Files:**
  - `apps/api/src/plugins/public.test.ts` (modified)
  - `apps/api/src/plugins/protected.test.ts` (new or modified existing protected test location)
  - `packages/database/src/helpContentStore.test.ts` (new)
  - `apps/api/package.json` (modified test script)
  - `packages/database/package.json` (modified test script)
- **Intent:** Consolidate route-level coverage for authenticated reads, version fallback, cache/fallback precedence, refresh authorization, and timestamp/status responses using existing Fastify injection and database test conventions.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — verify validated cache/fallback and refresh behavior.
- **Verify:** Automated suite covers valid GitHub content, network failure with cache, no-cache bundled fallback, invalid content rejection, alias/redirect/unavailable topics, authenticated reads (the earlier public/unauthenticated wording is reconciled with the authenticated Help contract), and authenticated refresh.
- **Notes:** Added authenticated Fastify injection coverage for the version, index, topic, status, and refresh contracts, including the unauthenticated boundary, safe metadata/timestamps, aliases, redirects, and unavailable topics. Extended loader coverage for valid fixed GitHub source paths and invalid remote payload rejection, and extended the global store coverage for successful replacement metadata alongside failure preservation. Reconciled stale public-read wording with the authenticated UX/API contract. Updated API and database test scripts to recursively execute every compiled `*.test.js` file through the shared Node test runner, without executing source TypeScript tests. Verified API/database targeted tests, typecheck, build, and lint.

---

## E-04: Public help and contextual UI

**Goal:** Add authenticated URL-addressable help pages, stable-key tooltip lookup, and authenticated Preferences refresh UI.

**Exit gate:** Authenticated users can browse/read/share help after sign-in and refresh from Preferences; routes/history/accessibility/responsive states are verified.

**Depends on:** E-01, E-03

### T-04.1: Add frontend help API and stable-key hooks

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-03.2
- **Files:**
  - `apps/frontend/src/helpApi.ts` (new)
  - `apps/frontend/src/helpTypes.ts` (new)
  - `apps/frontend/src/components/HelpTooltip.tsx` (new)
  - `apps/frontend/src/components/HelpContentStatus.tsx` (new)
- **Intent:** Consume backend version/index/topic/status APIs (never package metadata or GitHub), provide stable-key page/tooltip lookup with safe missing-key absence/fallback, redirect handling, and accessible keyboard/touch tooltip triggers with optional Learn more links.
- **ADRs:** [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — semantic tokens/Tailwind/shadcn and accessible controls; [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — frontend uses validated application APIs only.
- **Verify:** Typecheck/tests prove app version is fetched from `/api/app-version`, invalid/unavailable version uses effective `1.0.0`, missing tooltip does not break host rendering, and tooltip content is rendered as plain text with accessible names/focus.
- **Notes:** Implemented authenticated frontend help API methods and typed response contracts for app version, index, topic, and status reads. Added stable-key hooks with invalid/unavailable app-version fallback to effective `1.0.0`, safe missing-key behavior, and race-safe loading/error state handling. Added accessible keyboard/touch `HelpTooltip` with escaped plain-text rendering and optional Learn more link, plus `HelpContentStatus` for stale/bundled availability messaging. Added the missing `./help` shared-types export and narrowed the existing `App.tsx` nullable mode at the profile-deletion reset boundary. Added the smallest repository-conventional frontend test runner (`tsx`) and focused tests for app-version fallback, missing tooltip safety, and accessible tooltip triggering. Verified on 2026-09-07: frontend typecheck, lint, build, and focused tests pass. Lint reports only existing warnings in `button.tsx`, `AccountSettingsPage.tsx`, `App.tsx`, and the pre-existing hook dependency warnings.

### T-04.2: Build public landing/topic routes and shell entry

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.1
- **Files:**
  - `apps/frontend/src/HelpLandingPage.tsx` (new)
  - `apps/frontend/src/HelpTopicPage.tsx` (new)
  - `apps/frontend/src/components/HelpGroup.tsx` (new)
  - `apps/frontend/src/components/HelpTopicLink.tsx` (new)
  - `apps/frontend/src/App.tsx` (modified)
  - `apps/frontend/src/scaffoldRoutes.ts` (modified only for shell Help link metadata)
  - `apps/frontend/src/App.css` (modified only if existing exceptional styles require it)
- **Intent:** Register authenticated `/help` and `/help/:helpKey` React Router routes inside the existing workspace shell, add Help beside Settings in the System navigation, group index entries by Portfolio/Execution/Risk/Learning/System and user intent, render safe Markdown via `MarkdownViewer`, and handle loading, empty, stale, fallback, missing, unavailable, and canonical redirect states.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — direct links, refresh, back/forward; [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — declarative `BrowserRouter`, `Link`/hooks, no custom history; [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — semantic Tailwind/shadcn UI; [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — display backend status, never raw remote content.
- **Verify:** Authenticated direct loads of both routes render and unauthenticated loads follow the existing sign-in flow; Help appears beside Settings in System navigation; refresh preserves URL; back/forward preserves topic; canonical alias navigates to canonical key; removed key never shows unrelated content; headings/landmarks/focus/status announcements and responsive layouts satisfy UX handoff.
- **Notes:** Set in-progress on 2026-09-07 before frontend implementation. Implemented authenticated `/help` and `/help/:helpKey` routes inside `WorkspaceShell`, kept Help beside Settings through the existing scaffold navigation, added grouped landing/topic-link components, safe `MarkdownViewer` topic rendering, API-backed loading/empty/stale/bundled/missing/unavailable/redirect states, and canonical alias replacement navigation. Added repository-supported route contract tests using React Router's `matchRoutes` and server rendering: direct topic/landing matching, refresh-safe route ownership, authentication metadata, canonical encoded topic/alias paths, and `Link` navigation are covered without introducing a test framework. Verified frontend typecheck, lint, build, and 8 focused tests; browser automation remains unavailable, so visual/authenticated session execution is the only residual limitation.

### T-04.3: Add authenticated Preferences refresh control

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.1, T-03.3
- **Files:**
  - `apps/frontend/src/HelpRefreshControl.tsx` (new)
  - `apps/frontend/src/SettingsShell.tsx` (modified)
  - `apps/frontend/src/App.tsx` (modified if authenticated API context wiring is required)
- **Intent:** Replace the Preferences placeholder section with **Refresh help content**, localized last-attempt display, disabled/in-progress state, aria-live announcements for refreshing/success/failure, and guidance links on failure. Keep current help usable while refresh runs and do not promise a newer revision.
- **ADRs:** [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — accessible shadcn/Tailwind control; [ADR 0009](../../ADRs/0009-use-GitHub-repo-sourced-runtime-content.md) — controlled authenticated manual refresh and safe stale status.
- **Verify:** Only authenticated Preferences users can invoke refresh; no-previous-attempt, success, and failure copy matches UX contract; control disables during request, updates timestamp/status, and preserves existing content on failure.
- **Notes:** Set in-progress before implementation on 2026-09-07. Added the authenticated `HelpRefreshControl` to Preferences, using the existing `ApiClientContext` client and protected `POST /api/help/refresh` boundary. The control formats the durable last-attempt timestamp with the browser locale, shows the no-previous-attempt state, disables during refresh, announces refreshing/success/failure via `aria-live`, preserves the currently served help because it does not reload or replace help data, and provides actionable GitHub issue and P/OS subreddit links after failure. Added typed refresh response/client support and focused formatter tests. Verified frontend typecheck, lint, build, and 10 focused tests with npm (pnpm was unavailable in the environment); lint retains only pre-existing warnings in `button.tsx`, `AccountSettingsPage.tsx`, and `App.tsx`. T-04.4 was not started.

### T-04.4: Add frontend route/component verification

- **Status:** done
- **Owner:** frontend-coding
- **Depends on:** T-04.2, T-04.3
- **Files:**
  - `apps/frontend/src/HelpLandingPage.test.tsx` (new)
  - `apps/frontend/src/HelpTopicPage.test.tsx` (new)
  - `apps/frontend/src/components/HelpTooltip.test.tsx` (new)
  - `apps/frontend/src/HelpRefreshControl.test.tsx` (new)
  - `apps/frontend/package.json` (modified when the existing frontend test runner is selected)
- **Intent:** Add focused coverage for authenticated access, state rendering, URL navigation/redirects, Markdown safety delegation, tooltip fallback/accessibility, and refresh announcements/authenticated visibility.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) — route behavior must be tested; [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md) — test declarative route semantics; [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) — verify accessible component behavior.
- **Verify:** Frontend typecheck, lint, build, and the configured frontend test command pass; tests cover authenticated access, sign-in boundary, known topic, alias, unavailable topic, empty group, missing tooltip, cached/fallback status, failed refresh, keyboard operation, and aria-live messaging.
- **Notes:** Set in-progress on 2026-09-07 before frontend verification work. Added focused tsx coverage for the authenticated route contract and sign-in boundary, known/encoded and unavailable topics, canonical alias paths, route navigation, empty groups, cached/stale and bundled status messaging, missing tooltips, plain-text tooltip fallback, keyboard/touch-capable button semantics, and refresh aria-live progress/success/failure announcements. Added hover behavior while preserving explicit click/tap operation, and ensured tooltip long-form links use encoded canonical topic paths. Extended the existing frontend test script without adding a test framework. Verified 2026-09-07 with `corepack pnpm --filter @portfolio-engineering/frontend test` (16 passing), `typecheck`, `lint` (pre-existing warnings only), and `build` (successful; existing chunk-size warning only). No governance or closeout tasks started.

---

## E-05: Verification and closeout

**Goal:** Apply governance review and reconcile implementation against this plan and the definition of done.

**Exit gate:** Governance finds no requirement/ADR/UX drift and closeout records final documentation/schema/status decisions.

**Depends on:** E-04

### T-05.1: Perform governance drift review

- **Status:** done
- **Owner:** governance
- **Depends on:** T-02.2, T-03.4, T-04.4
- **Files:**
  - `docs/plans/0007-help-system.md` (review/status notes)
  - all changed files from E-02–E-04 (read-only review)
- **Intent:** Trace spec acceptance criteria, UX handoff/scaffold contract, ADR constraints, public/auth boundaries, global cache scope, and excluded organization notes against the actual diff and tests.
- **ADRs:** [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [ADR 0005](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md).
- **Verify:** Governance report has zero unresolved blocking drift findings, or each finding is recorded in Risks and open items with an owner and blocked task.
- **Notes:** Completed 2026-09-07. Zero blocking findings. Traced requirement → UX → task → owner → verification across E-01–E-04 with no gaps. Three non-blocking findings recorded: (1) a same-day production content-publishing incident and direct-to-`main` push were undocumented — resolved by adding [docs/debugging/0007-help-system-debugging.md](../../debugging/0007-help-system-debugging.md) and this Revisions entry; (2) no content-authoring runbook existed — resolved by adding [0007-help-system-content-guide.md](../../specs/0007-help-system-content-guide.md), linked from the root README; (3) the `freshness`/`refreshStatus` combination on first-ever-fetch failure (`unavailable`/`failed`/`fetchedAt: null`) is a valid but easily misread state — reviewed by the product owner, who verified actual behavior in the running app and accepted the current combined representation as sufficient without further UX work.

### T-05.2: Close out documentation and plan status

- **Status:** done
- **Owner:** closeout
- **Depends on:** T-05.1
- **Files:**
  - `docs/plans/0007-help-system.md` (modified)
  - `docs/schema/current.md` (verify/reconcile)
  - `docs/tech-debt/checklist.md` (append only if bounded follow-up is discovered)
- **Intent:** Reconcile completed tasks, migration/schema documentation, generated-client policy notes, test evidence, and bounded follow-up recommendations without adding organization notes or unrelated scope.
- **ADRs:** [ADR 0009](../../ADRs/0009-use-github-repo-sourced-runtime-content.md) — preserve documented channel/cache/fallback contract.
- **Verify:** Plan Progress, task statuses, Notes, Revisions, and final status match the repository diff; schema docs describe global help cache; any residual issue has an explicit owner and follow-up.
- **Notes:** Completed 2026-09-07. All E-01–E-05 tasks confirmed done. Schema docs (`docs/schema/current.md`) already describe the global help runtime cache from T-02.2; no reconciliation needed. No new bounded tech-debt items were identified beyond the three governance findings, all of which are resolved or explicitly accepted (see T-05.1 notes). Plan status set to `done`. Post-implementation follow-on work (adding Help content for the Bring Your Own AI settings section, per [ADR 0015](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md)) is tracked as ordinary content authoring outside this plan's task list, not as a plan gap.

## Risks and open items

| ID | Item | Impact | Owning agent | Blocks |
| --- | --- | --- | --- | --- |
| R-1 | Spec and UX artifacts define authenticated Help at `/help`, with Help beside Settings in System navigation. | Frontend route wiring must preserve the existing authentication boundary. | frontend-coding | T-04.2 |
| R-2 | Exact database JSON representation and refresh/freshness policy are not specified. | Resolved by T-02.1 design; backend still chooses the concrete freshness interval without changing schema. | database-design | none |
| R-3 | Existing app renders authenticated workspace/session states before routes; Help must remain inside that gate while its repository source remains public. | Help could accidentally bypass authentication or fail to appear beside Settings. | frontend-coding | T-04.2 |
| R-4 | Generated Prisma client commit policy (TD-003) is unresolved. | Migration diff/build reproducibility may differ from repository convention. | database-design | T-02.2 |
| R-5 | Existing frontend package initially had no test script or configured test runner. | Resolved for focused help verification by T-04.1's minimal `tsx` test command; broader frontend test coverage remains scoped to T-04.4. | frontend-coding | T-04.4 |

## Revisions

| Date | Trigger | Change |
| --- | --- | --- |
| 2026-09-07 | Initial plan | Created from spec 0007, UX handoff 0007, and updated UI scaffold contract; excluded organization notes. |
| 2026-09-07 | Product clarification | Help is authenticated in-app, appears beside Settings in System navigation, and selects the highest eligible semantic-versioned source. Backend/database test scripts must discover all compiled test files. |
| 2026-09-07 | T-02.1 completed | Added the global help runtime-cache persistence design; resolved the cache JSON shape, statuses, lifecycle, fallback, store contract, and additive migration safety. |
| 2026-09-07 | T-02.2 completed | Added and applied `20260907092621_add_help_runtime_cache`, implemented the global Help store and preservation tests, regenerated Prisma output through repository scripts, and documented the verified schema. |
| 2026-09-07 | T-04.1 unblock/verification pass | Re-ran frontend validation. `typecheck` now fails with the pre-existing `App.tsx` nullability issue and a missing shared-types `./help` package export; no help-focused frontend tests are present yet. T-04.1 remains blocked. |
| 2026-09-07 | T-04.1 completed | Exported shared help types, resolved the directly required nullable app-mode typecheck error, added focused frontend API/tooltip tests and the minimal `tsx` runner, and verified frontend typecheck, lint, build, and focused tests. |
| 2026-09-07 | Post-implementation content-publishing incident | Real user content edits initially landed at the wrong repository path (`docs/content/help/...`) and, separately, the supporting `content/help/index.json`, parent page, and tooltip file had never been pushed to `main`, causing `refreshStatus: "failed"`. Diagnosed and resolved by pushing the complete `content/help/` tree directly to `main` (commit `e9165a6`); logged in [docs/debugging/0007-help-system-debugging.md](../../debugging/0007-help-system-debugging.md). |
| 2026-09-07 | Governance and closeout follow-up | Added [0007-help-system-content-guide.md](../../specs/0007-help-system-content-guide.md) (content-authoring runbook) and [ADR 0015](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) (require Help content review alongside feature changes) in response to T-05.1 governance findings. Product owner reviewed the remaining `freshness`/`refreshStatus` first-fetch-failure state directly in the running app and accepted current behavior without further UX change. |
| 2026-09-07 | T-05.1 and T-05.2 completed | Governance drift review found zero blocking issues; all three non-blocking findings resolved or explicitly accepted. Plan status set to `done`. |
| 2026-09-07 | Archived | Plan fully complete (all E-01–E-05 tasks done); moved from `docs/plans/` to `docs/plans/closed/` per repository convention. Build session recorded on YouTube: https://youtu.be/PfTcHUP4ISk |
