# Tech Debt Checklist

> Last updated: 2026-09-05

This checklist captures technical debt and closeout follow-up recommendations that need human review before becoming GitHub issues or scheduled work.

## Not yet logged in GitHub

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
- Status: accepted
- Severity: medium
- Classification: technical-debt
- Area: auth / frontend / api
- Source: PR #3 (`agents/plan-analysis-first-step`)
- Why it matters: The codebase now supports verified provider callbacks and frontend Google sign-in, so keeping a second development-only session path increases maintenance surface area and can blur which auth path is canonical.
- Suggested next action: Add equivalent provider-driven development checks, then remove `demoAuth` query handling from the frontend and API once local bootstrapping remains simple without it.
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
