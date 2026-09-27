# Debugging Log: 0009 Intuition Ledger

- Spec: [0009-intuition-ledger](../specs/0009-intuition-ledger.md)
- Plan: [0009-intuition-ledger](../plans/0009-intuition-ledger.md)
- Status: active (feature implementation in progress)

# Lessons Learned

## TypeScript & Type Safety
- When validating URL values stored as `Record<string, string>`, convert them to contract unions through typed lookups before returning parsed query objects; a generic includes guard may not narrow every compound value as expected.

## API & Persistence
- Frontend API clients must preserve the shared request field names, including `confirmAmend`; server adapters own any mapping to store-specific names.

## React & Routing
- URL parsers should distinguish URL-owned filters from operational API query values such as `asOfLocalDate`.

## Build & Environment
- Frontend scripts that consume built workspace exports need pre-hooks to build packages that may have no existing `dist` output.

## Issue History

### Issue #001: TypeScript query status assignment is not narrowed

**Date:** 2026-09-27 12:07 (local)
**Status:** resolved
**Environment:** typecheck
**Severity:** minor

### Error
`src/intuitionLedgerApi.ts(126,7): error TS2322: Type 'string' is not assignable to type 'PredictionStatus | undefined'.` The next run identified TS6133 for the now-unused generic guard, which was removed.

### Context
- **File(s):** `apps/frontend/src/intuitionLedgerApi.ts`
- **Trigger:** Ran `corepack pnpm --filter @portfolio-engineering/frontend typecheck` after deleting `packages/domain/dist`.
- **Recent changes:** Added list-query parsing for the shared Intuition Ledger URL contract.
- **Reproduction steps:** Delete `packages/domain/dist` and run the frontend typecheck; the `pretypecheck` hook successfully builds domain, then TypeScript reports the status assignment error.

### Root Cause
A generic array-membership type guard did not narrow the status value to the shared `PredictionStatus` union at the result object assignment. The parser's runtime validation was correct, but its static result type remained `string`.

### Related ADRs
- ADR-0002: URL filters are URL-owned state; no decision violation, but the parser must return contract-typed values.
- ADR-0004: The parser is intended for use with React Router query state; no routing behavior is implicated.

### Resolution
Resolved by converting URL values through the typed status/type arrays (`find`) before constructing the shared query contract and removing the obsolete generic membership guard. Clean frontend typecheck, build, and tests all passed; the new test file covers valid and invalid status values.

### Lessons Learned
- Pattern to watch for: returning untrusted URL strings after a generic validation guard.
- Avoid: type assertions to make parsed URL values look contract-valid.
- Best practice: map values to the contract union explicitly, then return only narrowed values.
- Configuration note: the `pretypecheck` hook built the domain package successfully from an absent `dist` directory before TypeScript ran.

### Follow-up
- [x] Add/retain tests for valid and invalid status query values.
- [x] Update documentation if parser contract changes (the contract did not change).
- [ ] Flag for code review.
- [ ] Related issue: none.