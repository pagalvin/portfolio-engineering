# Debugging Log: 0008 Organization-Level Security Master

- Spec: [0008-organization-security-master](../specs/0008-organization-security-master.md)
- Plan: [0008-organization-security-master](../plans/closed/0008-organization-security-master.md)
- Status: closed (feature closed out 2026-09-26; all issues resolved)

## Reusable lessons

- **Custom combobox navigation needs visible active-option feedback:** Updating `aria-activedescendant` and `aria-selected` is not enough for sighted keyboard users. Bind the active index to a clear semantic-token highlight and test that the rendered option receives it.
- **Prefer a native select when choices are fixed:** It provides built-in keyboard and screen-reader behavior without custom combobox logic. When replacing a free-entry field, preserve existing unsupported values during edit rather than silently clearing them.

- **Workspace packages are consumed from `dist/`:** `@portfolio-engineering/database` (and validation) export compiled `dist/` output, and `tsx watch` in the API only reloads API source. After changing a workspace package, rebuild it (the API `predev` now builds validation and database) before testing in the running API.

## Issue history

### 003: List fails with "securityStore.count is not a function"

- Date: 2026-09-26 20:50
- Status: resolved
- Environment: dev | runtime
- Severity: major
- Reported behavior: The Security Master list shows "Unable to load securities — securityStore.count is not a function" after the grid count status line was added.
- Affected areas: `packages/database/src/securityStore.ts`, `apps/api/src/plugins/securityMaster.ts`, `apps/api/package.json`
- Contract and ADR review: No ADR violation; the count remains organization-scoped (ADR 0001).
- Root cause: The API imports the database package through its `exports` entry, `./dist/index.js`. The new `count` method existed only in source; the running dev server still used the stale compiled store. The API `predev` hook rebuilt only the validation package, so restarting dev would not have fixed it either.
- Resolution: Added the database package to the API `predev` build filter. Rebuild the database and validation packages and restart the API dev server.
- Verification: User confirmed after API restart that the list loads and displays "Showing N of T securities". `corepack pnpm --filter @portfolio-engineering/validation build`, database build and test (27/27), API typecheck/test (41/41)/lint, frontend test (34/34)/typecheck/lint/build, and `git diff --check` all passed. Frontend lint emitted six pre-existing warnings; build emitted the existing 595.96 kB chunk advisory.
- Follow-up: Consider whether other API-consumed workspace packages need the same pre-dev build treatment.

## Earlier issues

### 001: Exchange combobox arrow-key navigation has no visible cursor

- Date: 2026-09-26
- Status: resolved
- Environment: test | runtime
- Severity: minor
- Reported behavior: The Exchange suggestions did not visibly move when navigating with Arrow Up/Down, so the control did not feel or behave like a dropdown.
- Evidence and reproduction: Before the change, the key handler updated `activeIndex` and the option exposed `aria-selected`, but every option used the same static class list with no active-state styling. The existing tests passed while duplicating the suggestion-navigation helper instead of checking the component's active-option presentation.
- Affected areas: `apps/frontend/src/SecurityMasterPage.tsx`, `apps/frontend/src/securityMasterApi.ts`, `apps/frontend/src/SecurityMasterPage.test.tsx`
- Contract and ADR review: The Security Master UX flow requires Arrow Up/Down to open and move through suggestions while keeping focus in the input, and requires visible focus/accessibility behavior. ADR 0005 requires semantic Tailwind tokens. No route, tenant, persistence, or deletion behavior is implicated.
- Root cause: The active keyboard option was communicated to assistive technology but not visually distinguished in the listbox. The prior unit test also tested a locally duplicated helper, not the active-option styling contract.
- Resolution: Centralized suggestion filtering/index calculation and added a semantic-token active style (`bg-surface-emphasis text-text-strong`) bound to the option whose index matches `activeIndex`; inactive options retain hover feedback. Pointer movement also synchronizes the active option. Updated tests to exercise the production navigation helpers and assert active/inactive option styling is wired to `activeIndex`.
- Verification: Before the fix, `corepack pnpm --filter @portfolio-engineering/frontend test` passed 22 tests but did not detect the missing active highlight. After the fix, the same frontend test command passed 23 tests; `corepack pnpm --filter @portfolio-engineering/frontend typecheck`, `corepack pnpm --filter @portfolio-engineering/frontend lint`, `corepack pnpm --filter @portfolio-engineering/frontend build`, and `git diff --check` passed. Lint reported only pre-existing warnings, and the build reported the existing large-chunk advisory.
- Follow-up: None.

### 002: Exchange entry must use fixed dropdown choices

- Date: 2026-09-26
- Status: resolved
- Environment: test
- Severity: minor
- Reported behavior: The user clarified that Exchange should be a closed dropdown with predefined choices and an Other option, without custom value entry.
- Evidence and reproduction: The previous Exchange control was an editable combobox that accepted arbitrary text. The updated BRD and UX contract define a closed set: blank, NYSE, NASDAQ, AMEX, LSE, TSX, and Other.
- Affected areas: `apps/frontend/src/SecurityMasterPage.tsx`, `apps/frontend/src/securityMasterApi.ts`, `apps/frontend/src/SecurityMasterPage.test.tsx`, `docs/specs/0008-organization-security-master.md`, `docs/uxd/flows/0008-security-master.md`, `docs/uxd/flows/ui-scaffold-contract.json`, `docs/plans/0008-organization-security-master.md`
- Contract and ADR review: The Security Master BRD and UX handoff now require fixed choices, optional blank, and no custom entry or Exchange Master. The native select follows ADR 0005's accessible UI direction; API string/null compatibility and existing list filtering remain unchanged.
- Root cause: The previously approved editable-combobox behavior was superseded by the user's fixed-choice decision.
- Resolution: Replaced the combobox with the shared native select; Other is persisted as literal `OTHER`. Existing unlisted values are retained as a legacy choice while editing, but are not offered for new records.
- Verification: `corepack pnpm --filter @portfolio-engineering/frontend test` passed 22 tests; frontend typecheck, lint, production build, and `git diff --check` passed. Tests verify the fixed choices, Other token, legacy-value retention, and native `<select>` usage. Arrow Up/Down behavior is supplied by the browser's native select and was not separately simulated in a browser test. Lint and build reported only pre-existing warnings/advisories.
- Follow-up: Governance review remains pending under plan task T-04.1.
