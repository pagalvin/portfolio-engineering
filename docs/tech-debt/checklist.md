# Tech Debt Checklist

> Last updated: 2026-09-29

This checklist captures technical debt and closeout follow-up recommendations that need human review before becoming GitHub issues or scheduled work.

## Not yet logged in GitHub

## TD-019

- Title: Repair pre-existing Help refresh test typing for package-wide API typecheck
- Status: new
- Severity: low
- Classification: technical-debt
- Area: API / Help / test typing
- Source: Spec 0009 closeout (T-03.2, T-04.1, and T-04.2 verification)
- Why it matters: The API package-wide typecheck remains blocked by two pre-existing typing errors in `apps/api/src/lib/helpRefresh.test.ts`, limiting whole-package verification even though the focused changelog API checks pass. This defect predates Spec 0009 and was not introduced by its implementation.
- Suggested next action: Correct the Help refresh test fixture types in a separate bounded change, then rerun the API package typecheck and tests without altering changelog behavior.
- GitHub issue: none

## TD-018

- Title: Scope Journal and AI connection store writes by organization in the write predicate
- Status: done
- Severity: medium
- Classification: technical-debt
- Area: database / organization scoping
- Source: ADR 0001 update, 2026-09-26 (Security Master closeout)
- Why it matters: ADR 0001 now requires the mutating statement itself to carry `organizationId`. Several writes are keyed only by record ID:
  - `journalStore.ts`: update (~line 269), move (~line 318), and delete (~line 351)
  - `aiConnectionStore.ts`: one update (~line 276)

  Scoped pre-reads and globally unique IDs make the exposure low, but these writes violate the rule and are the same pattern governance flagged in the Security Master.
- Suggested next action: Completed by scoping Journal and AI connection mutations by organization (and Journal user) in the write predicate, preserving existing result contracts, and adding cross-scope tests that verify rows remain unchanged.
- GitHub issue: none

## TD-017

- Title: Keep workspace-package builds in sync with the API dev server
- Status: new
- Severity: low
- Classification: technical-debt
- Area: tooling / dev workflow
- Source: Security Master closeout (debugging log Issue 003)
- Why it matters: The API imports workspace packages from their compiled `dist/` output, and `tsx watch` does not rebuild them. A new store method caused a runtime "securityStore.count is not a function" error until the database package was rebuilt. The API `predev` script now builds validation and database, but other packages (shared-types, auth, ai, crypto) and packages edited during a running dev session can still go stale.
- Suggested next action: Decide on one approach: TypeScript project references with watch builds, source-condition exports for development, or a documented rebuild step. Apply it to every workspace package the API consumes.
- GitHub issue: none

## TD-016

- Title: Replace source-regex UI tests with DOM-level coverage for Security Master
- Status: new
- Severity: medium
- Classification: technical-debt
- Area: frontend / Security Master / testing
- Source: Security Master closeout (governance T-04.2)
- Why it matters: The Security Master frontend tests assert JSX source strings and class names with regular expressions. They catch accidental removal but not behavior: focus moving to the first invalid field, discarding stale responses, empty-state selection, and native select keyboard behavior are all unexercised. Any class-name refactor breaks tests without a behavior change.
- Suggested next action: When the frontend DOM or browser test harness exists (see TD-007, TD-011, TD-013), add rendered tests for list states, filter URL round-trips, the count line, edit loading and failure gating, field-level validation focus, and out-of-order response handling. Then retire the source-regex assertions.
- GitHub issue: none

## TD-015

- Title: Make Security Master update-and-return atomic
- Status: new
- Severity: low
- Classification: technical-debt
- Area: database / Security Master
- Source: Security Master closeout (governance T-04.2 finding N2)
- Why it matters: `SecurityStore.update` in `packages/database/src/securityStore.ts` scopes its write by organization with `updateMany`, then re-reads the row in a separate query. A concurrent update between the two can return a record that differs from what this request wrote. A concurrent delete can return `not_found` even though the update succeeded. Tenant isolation is not affected.
- Suggested next action: Wrap the scoped write and re-read in a single transaction, or use an atomic update-returning pattern. Add a focused contract test for the interleaving.
- GitHub issue: none

## TD-014

- Title: Require delete/backup review for any new profile-related data model
- Status: new
- Severity: medium
- Classification: technical-debt
- Area: database / profile lifecycle / backup safety
- Source: Profile deletion and backup closeout
- Why it matters: The current profile delete flow exports and removes the known profile, investor profile, and journal data, but future tables or child records added under a profile can silently escape the backup/export path unless a delete-review checklist is enforced.
- Suggested next action: Add a required architecture review step for every new profile-scoped model or child table that checks whether the delete/export aggregate and typed backup manifest must be updated before merge.
- GitHub issue: none

## TD-013

- Title: Expand frontend component and integration tests for Investor Profile form and alert banner
- Status: new
- Severity: low
- Classification: technical-debt
- Area: frontend / investor profile / testing
- Source: Personal Investor Profile closeout
- Why it matters: Basic module export smoke tests exist (`InvestorProfilePage.test.tsx` and `EmptyProfileAlert.test.tsx`), but full React DOM component tests for preset selection, live Markdown previews, form submission, and local-storage alert dismissal are deferred until frontend React Testing Library / DOM test harness conventions are established.
- Suggested next action: Add component-level tests verifying preset selection toggles, live Markdown render toggles, API error display, and window event listener triggers for alert auto-dismissal.
- GitHub issue: none

## TD-012

- Title: Add hosted onboarding organization selection and isolation checks
- Status: new
- Severity: high
- Classification: technical-debt
- Area: auth / onboarding / organization scoping
- Source: Deployment mode identity and session durability runtime review
- Why it matters: Hosted users currently rely on a default OAuth organization slug/name path, which can place unrelated hosted identities into a shared organization. Organization-owned resources such as AI connections are correctly shared within an organization, but users such as `galvin.paul@gmail.com` should first pick or create their intended organization during onboarding so shared settings do not leak across unrelated tenants or local adoption flows.
- Suggested next action: Design hosted onboarding so OAuth sign-in requires selecting or creating an organization, persist explicit membership, and add route-level tests proving users in different organizations cannot see each other's organization-owned settings.
- GitHub issue: [#21](https://github.com/pagalvin/portfolio-engineering/issues/21)

## TD-011

- Title: Add automated frontend coverage for the Journal analysis streaming panel
- Status: new
- Severity: medium
- Classification: technical-debt
- Area: frontend / Journal analysis / testing
- Source: Journal Entry AI Analysis closeout
- Why it matters: The Journal analysis panel was verified with typecheck, lint, build, API tests, and manual runtime testing, but there is no component or browser regression coverage for ready-connection filtering, stop/retry behavior, partial-output preservation, transient-state reset, and accessible status messaging.
- Suggested next action: Add focused component or browser tests when the frontend test harness exists, covering ready connection selection, start/stop/retry, SSE event handling, non-ready connection exclusion, refresh/navigation output reset, and coarse aria-live announcements.
- GitHub issue: none

## TD-010

- Title: Replace in-memory Journal analysis rate limiting before multi-process deployment
- Status: new
- Severity: medium
- Classification: technical-debt
- Area: API / Journal analysis / rate limiting
- Source: Journal Entry AI Analysis closeout
- Why it matters: The proof-slice limiter follows the current in-memory AI test limiter precedent, but per-process state will not consistently enforce organization limits across hosted or horizontally scaled API instances.
- Suggested next action: Move Journal analysis start limits to a shared store or standard rate-limit service before hosted scale or multiple API processes are introduced.
- GitHub issue: none

## TD-009

- Title: Clear stale ready AI connection state after invocation-time credential preparation failures
- Status: new
- Severity: medium
- Classification: technical-debt
- Area: API / AI connections / Journal analysis
- Source: Journal Entry AI Analysis T-06.2 manual verification
- Why it matters: A connection can remain visible as ready from persisted test metadata even when the current runtime can no longer decrypt or prepare its stored credentials for analysis, blocking retry/completion verification after the user has already selected it.
- Suggested next action: Add backend handling that records a safe failing connection state, or otherwise requires retest, when analysis-time credential preparation fails before provider invocation.
- GitHub issue: none

## TD-007

- Title: Add focused frontend coverage for AI connection workflows and provider catalog state
- Status: new
- Severity: medium
- Classification: technical-debt
- Area: frontend / AI connections / testing
- Source: AI provider connections feature closeout
- Why it matters: The AI connection UI is covered by typecheck, lint, build, and manual verification, but lacks component-level regression coverage for provider catalog messaging, health-group transitions, overview counts, and write-only secret edit behavior.
- Suggested next action: Add focused frontend tests when a component test runner is introduced, covering provider availability, existing-provider messaging, persisted health grouping, overview totals, and save/test navigation.
- GitHub issue: none

## TD-008

- Title: Add route-level API coverage for provider connection lifecycle contracts
- Status: new
- Severity: medium
- Classification: technical-debt
- Area: API / AI connections / testing
- Source: AI provider connections feature closeout
- Why it matters: Current API tests cover limiter behavior and provider registration, while the most security-sensitive lifecycle assertions—organization scoping, OpenAI discovery, credential redaction, and persisted invalid-credential failures—still rely partly on manual verification and static review.
- Suggested next action: Add authenticated route tests for provider discovery, create/update/test/delete, cross-organization isolation, invalid-provider credentials, and response/log secret redaction.
- GitHub issue: none

## TD-005

- Title: Replace custom History API routing scaffold with a first-class router integration
- Status: done
- Severity: medium
- Classification: technical-debt
- Area: frontend / routing / architecture
- Source: Branch `portfolio-os-mindmap-review` (UI scaffold and routing ADR closeout)
- Why it matters: The former manual History API scaffold increased long-term risk for nested routes, route guards, and testability compared with a standard router integration.
- Suggested next action: Completed in the Portfolio Journal implementation by adopting React Router declarative routing and preserving deep-link, refresh, and back/forward behavior.
- GitHub issue: none

## TD-004

- Title: Define a durable naming and lifecycle convention for `docs/uxd` prototype artifacts
- Status: new
- Severity: low
- Classification: documentation-follow-up
- Area: uxd / documentation / workflow
- Source: Branch `ux-agent-ui-design-react-tailwind` (UXD agent setup closeout)
- Why it matters: The repository now has a canonical UX artifact area and prototype workflow, but without an explicit naming and archival convention these files can become inconsistent and harder to review over time.
- Suggested next action: Add a short contributor-facing convention that covers filename patterns, promotion rules from prototype to implementation, and when to archive stale UXD artifacts.
- GitHub issue: none

## Logged in GitHub

## TD-006

- Title: Add focused automated coverage for Journal route, export, and Markdown-view behavior
- Status: new
- Severity: medium
- Classification: technical-debt
- Area: frontend / Journal / testing
- Source: Portfolio Journal implementation closeout
- Why it matters: Core Journal behavior is currently validated through typecheck, build, and manual product verification, leaving URL-state, complete All export, selection clearing, and safe Markdown rendering vulnerable to regressions.
- Suggested next action: Add focused frontend tests for scope URL parsing/navigation, complete and selected export serialization, selection reset behavior, and Markdown viewer raw-HTML/image handling.
- GitHub issue: none

## TD-001

- Title: Phase out the development-only `demoAuth` path after provider-first checks are stable
- Status: done
- Severity: medium
- Classification: technical-debt
- Area: auth / frontend / api
- Source: PR #3 (`agents/plan-analysis-first-step`)
- Why it matters: The codebase now supports verified provider callbacks and frontend Google sign-in, so keeping a second development-only session path increases maintenance surface area and can blur which auth path is canonical.
- Suggested next action: Completed by deployment mode identity and session durability work, which removed the development-only demo auth bypass in favor of explicit `APP_MODE=local` passwordless profiles and `APP_MODE=hosted` OAuth login.
- GitHub issue: [#4](https://github.com/pagalvin/portfolio-engineering/issues/4)

## TD-002

- Title: Standardize workspace environment loading across applications
- Status: accepted
- Severity: medium
- Classification: technical-debt
- Area: tooling / configuration
- Source: PR #3 (`agents/plan-analysis-first-step`)
- Why it matters: The API currently loads the workspace `.env` through a custom startup helper while the frontend reads the workspace root through Vite configuration, which can drift over time and make configuration behavior harder to reason about.
- Suggested next action: Define one documented workspace-wide environment loading pattern and align all apps and packages to it.
- GitHub issue: [#5](https://github.com/pagalvin/portfolio-engineering/issues/5)

## TD-003

- Title: Decide whether generated Prisma client code should remain committed
- Status: accepted
- Severity: low
- Classification: technical-debt
- Area: database / build
- Source: PR #3 (`agents/plan-analysis-first-step`)
- Why it matters: Committing generated Prisma client files makes builds reproducible for the current setup, but it also adds large diffs, review noise, and an ongoing maintenance policy decision.
- Suggested next action: Document and confirm whether generated Prisma client code is a permanent committed artifact or should be produced during build and excluded from source control.
- GitHub issue: [#6](https://github.com/pagalvin/portfolio-engineering/issues/6)
