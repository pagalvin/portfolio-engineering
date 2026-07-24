# Candidate ADRs

Based on `docs/brainstorming/conversation-flow.md`, these are strong candidates for future ADRs:

## Single codebase for SaaS and self-hosted deployments

Document the decision to support both deployment modes from one monorepo, with behavior controlled by environment and configuration. This is a foundational product and architecture choice with long-term delivery and operations impact.

## Monorepo with pnpm workspaces

Record the choice of a monorepo and why pnpm was selected over alternatives. The ADR should focus on workspace management, dependency sharing, and CI/CD efficiency.

## Fastify as the backend framework

This deserves an ADR because it affects plugin architecture, request lifecycle, performance characteristics, and API tooling. It is more consequential than a routine package choice.

## OAuth-only authentication

The document clearly chooses external identity providers only, with no username/password flow. That has product, security, and support implications worth documenting explicitly.

## Schema-first support for account linking

The system is designed to support multiple OAuth providers per user in the database, even though the UI is deferred. This captures the tradeoff of accepting some upfront schema complexity to avoid painful data migrations later.

## Single-organization membership for now

The app intentionally enforces one organization per user today while keeping the schema extensible for multi-org later. This is a meaningful domain constraint with direct UX and data-model consequences.

## Prisma + PostgreSQL + migration-based schema management

This is a strong ADR because it replaces DACPAC-style thinking with Prisma Migrate and git-tracked migrations. It affects developer workflow, production deployment, and portability across environments.

## JWT auth with short-lived access tokens and refresh cookies

The token model, expiration strategy, and storage approach are deliberate security decisions. The two-token pattern should be documented separately from the broader OAuth decision.

## Fastify public/protected plugin split for route authorization

The route-protection model is opinionated and reusable across the codebase. An ADR here would explain why auth is enforced at plugin boundaries rather than per-route middleware.

## Shared-database multi-tenancy for SaaS and single-tenancy for self-hosted

This is a major architectural decision with implications for data isolation, schema design, and future scaling. It is exactly the kind of decision ADRs are meant to preserve.

## Terraform for Azure infrastructure

The document treats Terraform as a settled choice over alternatives like Bicep. That decision shapes infra modularity, environment promotion, and team workflows.

## Suggested first ADRs

If another agent is writing the ADRs, the highest-priority candidates are:

- Single codebase for SaaS and self-hosted deployments
- Schema-first support for account linking
- Prisma + PostgreSQL + migration-based schema management
- JWT auth with short-lived access tokens and refresh cookies
- Shared-database multi-tenancy for SaaS and single-tenancy for self-hosted
