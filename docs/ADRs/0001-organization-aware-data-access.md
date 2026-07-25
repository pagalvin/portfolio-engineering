# ADR 0001: Require direct organization scoping for protected backend data access

- Status: draft
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

## Decision Statement

Treat `organizationId` as the required scope for all organization-owned backend data access. Require it in verified auth context, store it directly on organization-owned tables, and scope all protected organization-owned operations by it. The `organizations` table is the only current exception.

## Do

- Include `organizationId` in authenticated JWTs.
- Read `organizationId` from verified auth context before protected organization-owned work.
- Add a direct `organizationId` column to every organization-owned table.
- Filter every organization-owned read, write, update, delete, and aggregate by `organizationId`.
- Treat missing organization scope as an error.
- Document any new exception in a separate ADR or an update to this ADR.

## Do Not

- Do not infer tenant scope from request body, query params, or headers when verified auth context exists.
- Do not rely only on parent joins or indirect ownership to enforce tenant scope.
- Do not create organization-owned tables without a direct `organizationId`.
- Do not add undocumented exceptions.
