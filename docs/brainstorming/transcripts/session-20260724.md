# Architecture Design Session Transcript

**Date**: July 24, 2026  
**Topic**: Hybrid SaaS + Self-Hosted Portfolio Monorepo Architecture  
**Participants**: User, Copilot Assistant

---

## Session Summary

This session designed a complete technology stack and architecture for a portfolio application that supports both SaaS (cloud-hosted) and self-hosted deployment modes. The codebase is unified, with deployment mode controlled by environment configuration.

---

## Key Decisions Made

### 1. Monorepo Tool
- **Decision**: pnpm workspaces
- **Rationale**: 2-3x faster than npm for SaaS CI/CD cycles, better for frequent deployments
- **Comparison to npm**: Slightly steeper learning curve, but justified by performance gains

### 2. Deployment Architecture
- **Decision**: Hybrid SaaS + Self-Hosted (same codebase)
- **SaaS Mode**: Multi-tenant, hosted on Azure, managed by operator
- **Self-Hosted Mode**: Single-tenant, users deploy via Docker to their own infrastructure
- **Critical**: Same code path, environment-based configuration switches behavior

### 3. Frontend Stack
- **React**: 19.x (latest, improved form handling, async transitions)
- **Build Tool**: Vite 8.1.5 (ultra-fast, excellent dev experience)
- **Language**: TypeScript 7.0.2 (new Go-based compiler, 2x faster builds)
- **Styling**: Tailwind CSS 4.3.3 (now fully released, no longer beta)
- **Components**: Shadcn/ui (copy-paste component library, Tailwind + Radix primitives)

### 4. Backend Stack
- **Framework**: Fastify (not Express)
  - ~2x faster than Express
  - Built with TypeScript in mind
  - Structured plugin system
  - First-class OpenAPI support via `@fastify/swagger`
- **ORM**: Prisma 7.9.0 (type-safe, supports multiple databases)
- **Database**: PostgreSQL (database agnostic via Prisma)

### 5. Authentication
- **Providers**: Google, Microsoft, Facebook (OAuth2)
- **Rules**: OAuth required for all users (SaaS and self-hosted), no username/password auth
- **Account Linking**: Schema designed from day 1 to support multiple providers per user (deferred UI)
  - Rationale: Schema change later = painful data migration. UI change later = trivial sprint task.

### 6. Organizations
- **Concept**: Family/group account abstraction. Multi-user access to shared data.
- **Admin Setup**: First person to sign in becomes org admin via setup wizard
- **Single-Org Constraint**: Users belong to one org at a time (schema designed for multi-org expansion)
  - Practical consequence: User can't share a login across SaaS account AND self-hosted install
  - Assessment: Not a problem for household/family use case; revisit if B2B emerges

### 7. Database Migrations
- **Tool**: Prisma Migrate (replaces DACPAC concept for PostgreSQL)
- **Approach**: Migration-based (ordered SQL files in git)
- **Developer Workflow**: `prisma migrate dev --name <name>` generates + applies migrations locally
- **Production Deploy**: `prisma migrate deploy` in CI/CD (idempotent, safe on every deploy)
- **Self-Hosted**: Auto-runs in Docker entrypoint—users never see SQL scripts

### 8. API Authorization
- **Pattern**: JWT + refresh tokens
- **Access Token**: 15 min lifetime, sent via `Authorization: Bearer` header
- **Refresh Token**: 7-30 days lifetime, stored in `httpOnly` cookie (XSS-safe)
- **Protection**: Two-plugin route structure
  - **Public Plugin**: OAuth callbacks, health check, refresh endpoint (no JWT required)
  - **Protected Plugin**: All application routes (JWT hook auto-protects every route inside)
- **Organization Scoping**: Every request has `request.user` with `organizationId` embedded in JWT
- **Per-Deployment Secret**: `JWT_SECRET` in Key Vault (SaaS) or `.env` (self-hosted)

### 9. Infrastructure as Code
- **Tool**: Terraform (not Bicep)
- **Modules**: Database, App Service, Frontend, Container Registry, Key Vault, Networking
- **Environments**: dev (low-cost), staging (mirrors prod), prod (production SaaS)
- **Structure**: Stubbed out with documentation, implementation deferred

### 10. Version Verification
- All versions verified against npm registry (Context7 MCP used initially, then direct verification)
- React 19.x confirmed as latest
- TypeScript 7.0.2 is latest (Go-based compiler)
- Prisma 7.9.0 verified
- Tailwind 4.3.3 verified as production release

---

## Decisions Explicitly Deferred

1. **Account Linking UI**: Schema supports it; don't build UI until needed
2. **Multiple Organizations Per User**: Schema supports it; enforce single-org in app logic for now
3. **Terraform Implementation**: Folder structure and documentation stubbed; actual `.tf` files deferred
4. **Setup Wizard Details**: High-level flow decided; detailed UX deferred
5. **RBAC Beyond Admin/Member**: Beyond scope of architecture; revisit when needed
6. **License Key Mechanism**: For self-hosted; revisit when needed

---

## Artifacts Created

1. **docs/brainstorming/architecture.md** — Complete architecture document with all decisions, rationale, and open questions
2. **docs/brainstorming/conversation-flow.md** — Mermaid diagram showing decision flow through conversation
3. **infra/terraform/** — Folder structure with README stubs for each module and environment
4. **docs/brainstorming/transcripts/session-20260724.md** — This file

---

## Next Steps (Not Yet Implemented)

1. Scaffold monorepo with pnpm workspaces
2. Generate base folder structure for `apps/` and `packages/`
3. Initialize `package.json` files with shared dependencies
4. Create Docker Compose config for local PostgreSQL
5. Bootstrap Fastify + React Vite apps
6. Implement Prisma schema and migrations
7. Implement OAuth2 flows (Google, Microsoft, Facebook)
8. Implement JWT protection and API routes
9. Write Terraform modules

---

## Key Insights

- **Forward-Compatible Design**: Account linking and multi-org support designed into schema from day 1, allowing feature deferral without architectural pain later
- **Unified Codebase Strategy**: Single codebase for SaaS and self-hosted reduces maintenance burden; environment configuration handles mode switching
- **Prisma Migrate Advantage**: Eliminates need for DACPAC-like tooling; migrations live in git; works identically across local/staging/prod
- **Fastify Over Express**: Modern TypeScript-first framework justified by 2x performance and better DX for SaaS API development
- **Hybrid Deployment Model**: Same Docker image works for both SaaS (Azure App Service) and self-hosted (user's infrastructure)

---

## Open Questions for Future Sessions

- [ ] Setup Wizard UX flow (step by step)
- [ ] License key mechanism for self-hosted
- [ ] OAuth app registration strategy (per-environment)
- [ ] Terraform remote state backend configuration
- [ ] RBAC system design beyond admin/member
- [ ] CI/CD pipeline specifics (GitHub Actions workflows)
- [ ] Monitoring/alerting strategy for SaaS
