# Debugging Log: 0009 In-App Change Log

- Spec: [0009-in-app-changelog](../specs/0009-in-app-changelog.md)
- Plan: [0009-in-app-changelog](../plans/closed/0009-in-app-changelog.md)
- Status: closed (historical issue entries retain their investigation-time status; final verification is recorded in the closed plan)

## Reusable lessons

- Tests for invalid Markdown should distinguish malformed dated-section headings from headings at a forbidden higher level, and assert the corresponding specific diagnostic without relaxing either validation rule.
- Test doubles for persistence should model database-returned JSON values separately from Prisma input JSON, and should return locally constructed non-null records rather than a captured nullable fixture variable.
- When asserting accessible copy in React static markup, decode HTML entities before comparing user-visible text; serialized markup is not the same as rendered text.

## Issue history

### 001: Focused changelog test expected the wrong malformed-heading diagnostic

- Date: 2026-09-28
- Status: blocked
- Environment: test
- Severity: minor
- Reported behavior: Focused T-03.2 tests reported 13 passing and 1 failing. `rejects duplicate and malformed dated section headings` expected `/malformed dated section heading/`, but the validator rejected the `# Changelog` parent heading first and emitted `Changelog contains a heading above the dated section level.`
- Evidence and reproduction: The reported command was `corepack pnpm --filter @portfolio-engineering/api exec tsx --test src/lib/changelogContent.test.ts src/lib/helpRefresh.test.ts`. The current validator classifies headings with fewer than three `#` markers as invalid heading hierarchy before matching the dated-section heading format.
- Affected areas: `apps/api/src/lib/changelogContent.ts`; `apps/api/src/lib/changelogContent.test.ts`; Plan 0009 T-03.2.
- Contract and ADR review: Spec 0009 requires stable identities from valid top-level dated headings and rejects invalid content; T-03.2 requires malformed-heading rejection. The UX flow defines dated section identity but does not prescribe validation diagnostics. ADR 0009 requires server-side validation before content is cached or served. The validator behavior is compliant.
- Root cause: The test combined two distinct invalid-input cases under one overly specific expected diagnostic. A non-dated level-one heading is invalid because it sits above the required dated section level, not because its date syntax is malformed.
- Resolution: Split the higher-level heading cases from malformed dated-section cases and assert `/heading above the dated section level/` for those inputs. Production validation was not changed or weakened.
- Verification: Not rerun in this session; the reported focused command must pass before the issue and T-03.2 verification can be considered resolved.
- Follow-up: Rerun the focused T-03.2 test command and retain the existing broader API verification blocker until its independent typecheck/test issue is resolved.

### 002: Changelog refresh fixture did not model persisted JSON output

- Date: 2026-09-28
- Status: resolved
- Environment: typecheck
- Severity: minor
- Reported behavior: T-04.2 focused changelog API tests and lint passed, but package-wide API typecheck reported new fixture errors in `src/plugins/changelog.test.ts` around `writeValidatedPayload`: the mock's inferred return could be nullable, and Prisma input JSON was assigned to persisted cache JSON fields.
- Evidence and reproduction: The reported API typecheck diagnostics point to assignments/return in the `createRuntimeStore` fixture's write method. `HelpContentStore.writeValidatedPayload` requires `Promise<HelpRuntimeCacheRecord>`, whose JSON columns use persisted `JsonValue`; its input accepts Prisma `InputJsonValue`. The two previously documented `helpRefresh.test.ts` type errors are pre-existing and out of scope.
- Affected areas: `apps/api/src/plugins/changelog.test.ts`; Plan 0009 T-04.2.
- Contract and ADR review: T-04.2 requires tests to verify the existing channel-keyed store preserves last-valid content. No production API, content source, or persistence behavior needs to change. ADR 0009's validated payload/cache boundary remains intact; no ADR or product-contract change is required.
- Root cause: The mock returned a mutable outer `record` variable typed as nullable, rather than the definitely constructed record. It also copied an input JSON value directly into a simulated persisted record, conflating Prisma's write-input type with the database model's JSON output type.
- Resolution: In the test fixture only, convert each input payload through JSON serialization and validate the parsed value as persisted JSON; build a local `HelpRuntimeCacheRecord`, assign it to the fixture state, and return that non-null local record. The store contract, production API, and assertions remain unchanged.
- Verification: After the fixture correction, `corepack pnpm --filter @portfolio-engineering/api exec tsx --test src/plugins/changelog.test.ts` passed (9 passed, 0 failed). Package-wide `corepack pnpm --filter @portfolio-engineering/api typecheck` then reported only the two previously documented pre-existing `src/lib/helpRefresh.test.ts` errors; all T-04.2 fixture diagnostics were gone. Validation typecheck/build and API lint also passed.
- Follow-up: T-04.2's bounded verification is satisfied. Keep the pre-existing Help test typing issue separately tracked; it is not a T-04.2 blocker.

### 003: Frontend changelog navigation verification failures

- Date: 2026-09-28
- Status: blocked
- Environment: typecheck | test | build
- Severity: minor
- Reported behavior: T-05.1 frontend typecheck and build failed because `useContext` was not imported in `App.tsx`. Two of ten focused changelog tests failed, and the registered frontend suite had 47 of 49 tests pass. One assertion expected an unescaped apostrophe in static HTML; another searched raw serialized HTML for the same user-visible status copy.
- Evidence and reproduction: Reported frontend typecheck diagnostic: `src/App.tsx:545 Cannot find name 'useContext'`. React static markup serialized the copy as `New changelog status couldn&#x27;t be checked.` Focused tests: 8/10 passed; registered frontend suite: 47/49 passed. Lint reported 0 errors and 6 warnings; build failed due to typecheck. The unread/read state transition unit tests passed.
- Affected areas: `apps/frontend/src/App.tsx`; `apps/frontend/src/ChangeLogNavigation.test.tsx`; Plan 0009 T-05.1.
- Contract and ADR review: Spec 0009 and the UX flow require the exact visible polite status while preserving the same user's confirmed read/unread state on later failures. ADR 0002 and ADR 0004 require declarative React Router navigation; ADR 0005 requires accessible status and focus behavior; ADR 0013 requires isolation across local profiles and hosted accounts. No contract or architecture change is needed.
- Root cause: `WorkspaceShell` used React's `useContext` without importing it. Both navigation-test failures came from asserting against React's escaped static-HTML serialization instead of the visible text; the supplied state retained the confirmed unread/read values, so these failures do not demonstrate a navigation-state defect.
- Resolution: Imported `useContext` from React. Updated the navigation test helper to extract the status text and decode the serialized apostrophe entity before exact comparison. The tests continue to assert the status role/live announcement, absence/presence of **New**, and non-interactive single-link keyboard behavior; production navigation state logic was not changed.
- Verification: Not rerun after correction. T-05.1 remains blocked until the frontend typecheck, focused changelog tests, registered test suite, lint, and build are rerun successfully.
- Follow-up: Run the frontend T-05.1 verification commands recorded in Plan 0009. Do not begin T-05.2 until T-05.1's Verify conditions pass.
