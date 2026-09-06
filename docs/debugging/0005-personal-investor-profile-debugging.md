# Debugging Log: 0005 Personal Investor Profile

- Spec: [0005-personal-investor-profile](../specs/0005-personal-investor-profile.md)
- Plan: [0005-personal-investor-profile](../plans/0005-personal-investor-profile.md)
- Status: active

## Reusable lessons

- **API Client Methods:** Frontend API modules wrapped around `AuthenticatedApiClient` must invoke defined methods on `AuthenticatedApiClient` (e.g., `getInvestorProfile()`) rather than expecting a raw `.fetch()` method on the client instance.
- **Fastify JWT User Payload:** In Fastify API plugins, the authenticated user ID is stored on `request.user.sub` (JWT standard claim), not `request.user.id`.
- **Database Migrations:** Schema changes in `schema.prisma` require a corresponding migration folder created via `prisma migrate dev` so physical database tables exist at runtime (`P2021` / `relation "public.investor_profiles" does not exist`).

## Issue history

### 001: TypeError: apiClient.fetch is not a function on Investor Profile Tab

- **Date:** 2026-09-06
- **Status:** resolved
- **Environment:** dev | runtime | typecheck
- **Severity:** major
- **Reported behavior:** Navigating to `/workspace/settings/profile` threw `TypeError: apiClient.fetch is not a function`.
- **Evidence and reproduction:** `investorProfileApi.ts` invoked `apiClient.fetch(...)`, but `AuthenticatedApiClient` in `apiClient.ts` did not define a `.fetch()` method.
- **Affected areas:** `apps/frontend/src/investorProfileApi.ts`, `apps/frontend/src/apiClient.ts`, `apps/api/src/plugins/investorProfile.ts`
- **Contract and ADR review:**
  - ADR-0001: Scoped API requests using authenticated session user and organization.
  - Fastify JWT Contract: User identity retrieved via `request.user.sub`.
- **Root cause:**
  1. `investorProfileApi.ts` assumed `apiClient` exposed a generic `fetch()` method instead of structured domain methods on `AuthenticatedApiClient`.
  2. `apps/api/src/plugins/investorProfile.ts` used `request.user.id` instead of `request.user.sub`.
- **Resolution:**
  1. Added `getInvestorProfile()`, `updateInvestorProfile()`, and `getInvestorProfileCatalogs()` to `AuthenticatedApiClient` in `apps/frontend/src/apiClient.ts`.
  2. Updated `apps/frontend/src/investorProfileApi.ts` to call these methods.
  3. Fixed `request.user.sub` usage in `apps/api/src/plugins/investorProfile.ts`.
- **Verification:** Ran `pnpm typecheck`, `pnpm test`, and `pnpm build` across all workspace projects; all passed cleanly.

### 002: PrismaClientKnownRequestError: Table public.investor_profiles does not exist (P2021)

- **Date:** 2026-09-06
- **Status:** resolved
- **Environment:** dev | runtime
- **Severity:** critical
- **Reported behavior:** Saving profile via `PUT /api/investor-profile` resulted in HTTP 500 error with message `The table public.investor_profiles does not exist in the current database`.
- **Evidence and reproduction:** Prisma error code `P2021` (`relation "public.investor_profiles" does not exist`).
- **Affected areas:** `packages/database/prisma/migrations`
- **Contract and ADR review:**
  - ADR-0001 & ADR-0013: Relational persistence contract for investor profile requires physical PostgreSQL table `investor_profiles`.
- **Root cause:** The `InvestorProfile` model was added to `schema.prisma`, but a Prisma database migration SQL file was not generated and applied to the database.
- **Resolution:** Generated migration `20260906195425_add_investor_profiles` creating the `investor_profiles` table, indexes, unique constraint on `[organizationId, userId]`, and foreign keys, then applied it to the database.
- **Verification:** Ran `pnpm --filter @portfolio-engineering/database test` and `pnpm --filter @portfolio-engineering/api test`; all database and integration tests passed.
