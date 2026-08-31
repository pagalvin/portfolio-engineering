# Debugging Log: 0001 Portfolio Journal

- Spec: [spec](../specs/0001-portfolio-journal.md)
- Plan: [plan](../plans/closed/0001-portfolio-journal.md)
- Status: retained historical log

## Reusable lessons

- Navigation rendered inside `BrowserRouter` must use `Link` or `NavLink`; native anchors reload the document and restart authentication bootstrap.
- When Prisma maps a PostgreSQL `date` column as `DateTime @db.Date`, convert validated `YYYY-MM-DD` domain values to a UTC-midnight `Date` at the store boundary; never pass date-only strings to Prisma filters or writes.
- For persisted, timezone-normalized calendar-date keys, validate the client timezone at the request boundary but do not pass it into pure calendar-range helpers unless they convert an instant.
- Preserve malformed request values until shared request validation runs; route handlers must return the validation response rather than throw while pre-parsing mode-specific query fields.
- Keep route-owned controls in a persistent page shell; scope asynchronous content requests by the current URL-derived scope so loading states do not replace navigation or permit stale responses to overwrite the active view.
- Reusable copy controls should own a brief, visible `Copied!` label and clear their timers on supersession and unmount; callers retain scope-specific clipboard failure messaging.
- When a workspace package exports generated `dist` declarations and runtime code, dependent package scripts must rebuild that package before typechecking, building, or serving; source changes alone do not update the exported contract.

## Issue history

### 001: Workspace navigation restarts local authentication

- Date: 2026-08-30
- Status: resolved
- Environment: dev
- Severity: major
- Reported behavior: After local sign-in, selecting any left workspace navigation link prompts the user to log in again.
- Evidence and reproduction: The workspace navigation rendered native `<a href>` elements. In the documented local demo flow, navigating from `/?demoAuth=authenticated` removes the query string and reloads the document; the reloaded app requests `/auth/session`, which resolves to the unauthenticated development state when no `demoAuth` value is present.
- Affected areas: `apps/frontend/src/App.tsx` workspace navigation.
- Contract and ADR review: This violates the React Router declarative-navigation requirement in ADR-0004 and prevents the URL/history continuity required by ADR-0002. It does not alter verified server-derived organization scope required by ADR-0001.
- Root cause: Native anchors bypassed React Router and caused a full-page reload rather than an in-app route transition.
- Resolution: Replaced workspace navigation anchors with React Router `NavLink` components.
- Verification: User ran frontend typecheck and build successfully, then verified left-nav transitions no longer prompt for re-authentication.
- Follow-up: None.

### 002: Month retrieval passes date-only strings to Prisma

- Date: 2026-08-30
- Status: resolved
- Environment: API
- Severity: major
- Reported behavior: `GET /api/journal/entries?mode=month&tz=America%2FNew_York&month=2026-08` returned 500 and the Journal UI showed “Failed to load entries.”
- Evidence and reproduction: The reported `PrismaClientValidationError` identifies `JournalEntry.findMany` at `apps/api/src/plugins/journal.ts:171`, with `localDate.gte` and `lte` supplied as `2026-08-01` and `2026-08-31`. The Prisma schema declares `localDate DateTime @db.Date`; its journal persistence design defines this as a timezone-normalized calendar date with no time component.
- Affected areas: `packages/database/src/journalStore.ts` range retrieval and other Journal local-date persistence/query boundaries.
- Contract and ADR review: Calendar-month ranges must retrieve local calendar dates without changing day at an API-server timezone boundary. The fix keeps the client-reported timezone as date-grouping context and retains verified `organizationId` and `userId` filters from JWT context for every query, as required by ADR-0001. No routing, placeholder, or UI contract changed.
- Root cause: The store passed domain-format `YYYY-MM-DD` strings to Prisma for a `DateTime @db.Date` field. Prisma requires ISO-8601 date-time values or JavaScript `Date` instances even when PostgreSQL persists only the date.
- Resolution: Added a store-boundary conversion from `YYYY-MM-DD` to UTC-midnight `Date`, and applied it to create, single-date retrieval, range bounds, selected-date retrieval, move conflict detection/update, and date-existence queries. UTC-midnight preserves the intended calendar date independently of the API host timezone.
- Verification: User ran database and API typechecks successfully, then verified Journal scope navigation and retrieval during the manual flow.
- Follow-up: None.

### 003: API typecheck reports an unused timezone parameter

- Date: 2026-08-30
- Status: resolved
- Environment: typecheck
- Severity: minor
- Reported behavior: API typecheck reported TS6133 because `timezone` in `weekToDateRange` was declared but never read.
- Evidence and reproduction: `apps/api/src/plugins/journal.ts` accepted `validatedQuery.tz` only to pass it to the pure week-to-calendar-date helper, while the repository TypeScript configuration enables `noUnusedParameters`.
- Affected areas: `apps/api/src/plugins/journal.ts` week retrieval helper.
- Contract and ADR review: The Journal persistence contract stores `localDate` as a timezone-normalized date-only key. The API continues to validate the client-reported IANA timezone through `journalEntriesQuerySchema`; organization and user scope remain derived exclusively from `request.user` and supplied to every store operation, preserving ADR-0001.
- Root cause: A planned conversion parameter remained on a helper that only derives date-only calendar keys from an ISO week string and therefore has no instant to convert by timezone.
- Resolution: Removed the unused helper parameter and call-site argument; documented that the helper operates on already-normalized calendar-date keys.
- Verification: User reran `corepack pnpm --filter @portfolio-engineering/api typecheck` with no errors and manually tested the Journal; reported behavior appears good.
- Follow-up: None.

### 004: Week navigation omits its URL-owned week value

- Date: 2026-08-30
- Status: resolved
- Environment: API
- Severity: major
- Reported behavior: Navigating to the Journal week view requested `GET /api/journal/entries?mode=week&tz=America%2FNew_York` without the required `week` parameter, resulting in a Zod invalid-union error and HTTP 500.
- Evidence and reproduction: `JournalPage` initialized a missing `week` as an empty string and its Week control navigated with that value. `AuthenticatedApiClient.getEntries` correctly omits empty optional values, so it sent the malformed request. In `journalRoutes`, `parseJournalQuery` then called `.parse()` and its error handler only recognized messages containing "validation", allowing Zod's invalid-union error to escape as 500.
- Affected areas: `apps/frontend/src/JournalPage.tsx`, `apps/frontend/src/journalDates.ts`, and `apps/api/src/plugins/journal.ts`.
- Contract and ADR review: The Journal flow requires `week=YYYY-Www` to be URL-owned and refresh-safe. The client now canonicalizes absent Journal scope values through React Router replacement navigation and supplies the current environment-timezone ISO week as the Week default, without manual History API calls (ADRs 0002 and 0004). The API returns a validation 400 for externally malformed requests. Organization and user scope remain derived only from `request.user` (ADR 0001).
- Root cause: The Week UI had no valid default for its required scope parameter, while the API's route-local parsing/exception path converted schema validation failures to server errors.
- Resolution: Added an ISO-week default utility and canonical URL replacement for absent or invalid scope state; the Week navigation target now always contains a valid week. Preserved raw GET query values for Zod `safeParse` and return `VALIDATION_ERROR` with HTTP 400 when validation fails.
- Verification: User ran frontend and API typechecks successfully, then verified Journal scope navigation during the manual flow.
- Follow-up: None.

### 005: Journal shell flickers during time-scope loading

- Date: 2026-08-30
- Status: resolved
- Environment: runtime
- Severity: minor
- Reported behavior: Switching Day, Week, Month, or All made the Journal heading and time controls visibly redisplay while the new scope loaded.
- Evidence and reproduction: `JournalPage` returned a loading or load-error panel before rendering its heading and controls. Every URL scope transition set `loading` to true, unmounting the shell until the request finished.
- Affected areas: `apps/frontend/src/JournalPage.tsx`.
- Contract and ADR review: The Journal mode and scope values remain React Router URL-owned context, preserving refresh and browser history under ADRs 0002 and 0004. The correction uses existing Tailwind semantic tokens and no `App.css` changes, as required by ADR 0005. The UX flow requires loading states and screen-reader status announcements.
- Root cause: Page-level early returns coupled content-fetch state to the entire Journal component rather than only the data-dependent content region.
- Resolution: Kept the Journal heading and URL-navigation controls mounted; added a labelled, `aria-busy` content region with polite loading/refresh status and scoped load-error rendering. Completed content remains visible during a same-scope refresh, while content from a different scope is not rendered under the new URL context. Added URL-scope/request-version guards and effect cleanup so superseded loads or save reloads cannot update the current view.
- Verification: User ran frontend typecheck and build successfully, then verified the Journal flow manually.
- Follow-up: None.

### 006: Clipboard success feedback is not associated with its control

- Date: 2026-08-30
- Status: resolved
- Environment: runtime
- Severity: minor
- Reported behavior: Clicking any Journal “Copy to Clipboard” button showed a green feedback bar with no obvious text rather than changing the clicked button to “Copied!” for a short period.
- Evidence and reproduction: All Day, Week, Month, and All copy buttons invoked one parent `handleExport('copy')` callback. On success it only set the shared `exportMessage` to “✓ Copied to clipboard”; each control retained the static “Copy to Clipboard” label.
- Affected areas: `apps/frontend/src/JournalPage.tsx` and new shared frontend primitive `apps/frontend/src/components/ui/copy-button.tsx`.
- Contract and ADR review: The UX flow requires brief (2–3 second) clipboard feedback and screen-reader status announcements. A copy-result label is transient component state, so it does not change Journal URL ownership under ADRs 0002 and 0004. The reusable primitive composes the existing local shadcn-style `Button` and semantic Tailwind tokens, without adding `App.css` styling, consistent with ADR-0005. No protected API or organization scope behavior changes (ADR-0001).
- Root cause: Clipboard success was modeled only as shared page feedback, not as state owned by the initiating copy control; its timeout also had no cleanup or supersession guard.
- Resolution: Added a reusable `CopyButton` primitive with a 2.5-second `Copied!` label, polite screen-reader confirmation, in-flight protection, and timer/request cleanup. Replaced all Journal copy controls with it. Journal clipboard failures now retain an explicit error announcement, while downloads retain separate success/error feedback.
- Verification: User ran frontend typecheck and build successfully, then verified the Journal copy control changes to `Copied!` after a successful copy and returns to its normal label.
- Follow-up: None for the reported copy-feedback behavior.

### 007: Selected-entry client request referenced its URL before initialization

- Date: 2026-08-30
- Status: resolved
- Environment: frontend
- Severity: major
- Reported behavior: The first selected-week export request would throw before sending `GET /api/journal/entries?mode=selected`.
- Evidence and reproduction: `AuthenticatedApiClient.getEntries()` appended selected-mode `dates` to `url.searchParams` in its mode branch before its `const url = new URL(...)` declaration. Any non-empty selected date list therefore reached the temporal-dead-zone reference.
- Affected areas: `apps/frontend/src/apiClient.ts` selected-entry query construction.
- Root cause: The selected-mode array serialization was duplicated, with the first copy placed before URL construction.
- Resolution: Removed the premature branch; the existing post-construction selected-mode serialization appends each `dates` query value to the initialized URL.
- Verification: Static implementation review completed; frontend typecheck and authenticated browser verification remain required because command execution is unavailable in this environment.
- Follow-up: Verify selected-week copy and download against the protected API before marking T-03.4 done.

### 008: A draft could obscure an entry opened for another date

- Date: 2026-08-30
- Status: resolved
- Environment: frontend
- Severity: major
- Reported behavior: After entering unsaved content on one Day view, opening a chosen or review-table date could display that draft in place of the requested date's existing entry.
- Evidence and reproduction: `JournalPage` retained `unsavedDraft` across its URL-derived scope key, while `JournalDayView` preferred a non-empty draft over the loaded entry content. This directly conflicted with the chosen-date workflow requirement that an occupied date opens its existing entry.
- Affected areas: `apps/frontend/src/JournalPage.tsx`.
- Root cause: The route transition changed the data request but did not clear component-local draft state for the previous Day scope.
- Resolution: Clear the transient draft and save error whenever the URL-derived scope key changes. The existing request-version and scope-key guards continue to prevent superseded loads from rendering under the new URL.
- Verification: Static implementation review completed; frontend typecheck and authenticated browser verification remain required because command execution is unavailable in this environment.
- Follow-up: Verify changing Day URLs with an unsaved draft, then opening an occupied date, shows only that date's returned content.

### 009: Protected Week retrieval used ISO Monday-Sunday bounds

- Date: 2026-08-30
- Status: resolved
- Environment: API
- Severity: major
- Reported behavior: The protected Week endpoint accepted `week=YYYY-Www` and resolved ISO Monday-Sunday ranges, allowing entries outside the approved Sunday-Saturday Journal Week to be returned.
- Evidence and reproduction: `weekToDateRange()` derived an ISO Monday from `YYYY-Www`; the approved Week contract identifies the range by `weekStart=YYYY-MM-DD`, where the start is a real Sunday. The prior resolver could include the preceding Monday-Saturday and omit the approved Sunday-Saturday range.
- Affected areas: `apps/api/src/plugins/journal.ts`, `packages/validation/src/journal.ts`, and `packages/shared-types/src/journal.ts`.
- Contract and ADR review: The corrected route validates the user-reported IANA timezone but derives `organizationId` and `userId` only from verified `request.user`, then calls the approved scoped `journalStore.getEntriesInRange` method. This preserves ADR-0001 direct organization scoping. The Week identifier is the product/UX Sunday-date contract, with no ISO mapping.
- Root cause: The original API contract and resolver were implemented with an ISO week identifier despite the approved Journal Week semantics.
- Resolution: Replaced `week` with strict `weekStart` validation requiring one valid Sunday date, preserved raw repeated query values for schema validation, and calculate the inclusive end as six UTC calendar days after that Sunday. Legacy `week`, conflicting scope keys, malformed values, and repeated scalar values now produce the established 400 `VALIDATION_ERROR` response.
- Verification: Static implementation review completed. Authenticated cross-year range, adjacent-Sunday exclusion, user/organization isolation, and package typecheck/lint verification remain required because command execution is unavailable in this environment.
- Follow-up: T-03.8 must update frontend URL parsing, types, and serialization to emit `weekStart`; it must not remap legacy ISO links.

### 010: API typecheck consumed stale Week validation declarations

- Date: 2026-08-30
- Status: resolved
- Environment: typecheck
- Severity: major
- Reported behavior: API typecheck failed at `apps/api/src/plugins/journal.ts:138` with TS2339 because the validated Week query type exposed `week` rather than `weekStart`.
- Evidence and reproduction: `packages/validation/src/journal.ts` defines a strict `weekStart` Sunday schema and discriminated union, but `@portfolio-engineering/validation` exports `./dist/journal.d.ts`. That emitted declaration still defines the legacy ISO `week` field; its sibling emitted JavaScript also still validates ISO Week input. The API consequently consumed an old build artifact while its source route had already moved to `validatedQuery.weekStart`.
- Affected areas: `packages/validation` generated distribution contract and `apps/api` package lifecycle scripts.
- Contract and ADR review: The source shared schema and route implement T-03.7's approved Sunday-through-Saturday `weekStart` contract and its strict validation produces the existing 400 `VALIDATION_ERROR` route response. The change leaves `organizationId` and `userId` derived only from `request.user` and passed to scoped store methods, preserving ADR-0001. No URL, UI, placeholder, or architecture decision changed.
- Root cause: The validation package's source was updated without rebuilding its ignored `dist` output, while the package export map intentionally directs API typechecking and runtime imports to that output. API scripts did not refresh the generated dependency.
- Resolution: Added API `predev`, `prebuild`, and `pretypecheck` hooks that build `@portfolio-engineering/validation` before the API consumes its exported declarations or JavaScript. This regenerates the strict Sunday `weekStart` schema before API validation or startup without changing query parsing, response behavior, or auth scoping.
- Verification: User verified `corepack pnpm --filter @portfolio-engineering/api typecheck` and `corepack pnpm --filter @portfolio-engineering/api build` both passed with no errors after the API predev, prebuild, and pretypecheck hooks rebuilt validation output. Manual authenticated verification remains required: request `mode=week&weekStart=2025-12-28` and confirm only December 28 through January 3 are returned; confirm missing, malformed, non-Sunday, repeated, legacy `week`, and conflicting scope parameters return HTTP 400 `VALIDATION_ERROR`.
- Follow-up: Run the authenticated boundary and negative-request checks before completing T-03.7.
