# ADR 0001: Require direct organization scoping for protected backend data access

- Status: accepted
- Date: 2026-07-24
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Adding or changing protected backend routes, services, jobs, or queries for organization-owned data.
- Creating or changing database tables that store organization-owned data.
- Reviewing whether tenant scope is explicit enough in auth, API, service, or persistence design.
- Not applicable to the `organizations` table itself or to future global/system-owned data covered by another ADR.

## Context

- Organizations are the tenancy boundary.
- Auth, API, and database work now exist, so weak tenant scoping would be expensive to unwind later.
- The codebase needs one default rule that agents can apply consistently.
- Update 2026-09-26: the Security Master review found a store that checked `{ id, organizationId }` in a pre-read but then wrote by `id` alone. The rules below now require the write predicate itself to carry the organization scope.

## Decision Statement

Treat `organizationId` as the required scope for all organization-owned backend data access. Require it in verified auth context, store it directly on organization-owned tables, and scope all protected organization-owned operations by it. The `organizations` table is the only current exception.

## Do

- Include `organizationId` in authenticated JWTs.
- Read `organizationId` from verified auth context before protected organization-owned work.
- Add a direct `organizationId` column to every organization-owned table.
- Filter every organization-owned read, write, update, delete, and aggregate by `organizationId`.
- Put `organizationId` in the predicate of the mutating statement itself, for example `updateMany`/`deleteMany` with `where: { id, organizationId }`. Treat a zero affected-row count as not found.
- If a store needs to return the mutated row, re-read it with an organization-scoped query. Prefer one transaction for the write and re-read.
- For each organization-owned store, test that calling update, lifecycle change, or delete with another organization's record ID returns not found and leaves that record unchanged.
- Treat missing organization scope as an error.
- Document any new exception in a separate ADR or an update to this ADR.

## Do Not

- Do not infer tenant scope from request body, query params, or headers when verified auth context exists.
- Do not rely only on parent joins or indirect ownership to enforce tenant scope.
- Do not perform an organization-scoped pre-read (for example `findFirst({ id, organizationId })`) followed by a write keyed only by `id` (for example `update({ where: { id } })`). The pre-read does not scope the write.
- Do not create organization-owned tables without a direct `organizationId`.
- Do not add undocumented exceptions.
