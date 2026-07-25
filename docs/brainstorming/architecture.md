# Architecture Brainstorming

> Last updated: 2026-07-24 (updated: local non-OAuth account mode brainstorm)

## Overview

A **hybrid SaaS + self-hosted application** built as a monorepo. Two classes of end users:

- **SaaS users**: Access via cloud (Azure). Non-technical users who pay for convenience. Multi-tenant.
- **Self-hosted users**: Deploy fully locally via Docker. Single-tenant. Full control over their own data.

The **same codebase** serves both deployment modes, controlled by environment configuration.

---

## Tech Stack

| Area | Technology | Latest Version |
|------|-----------|----------------|
| **Monorepo tool** | pnpm workspaces | 11.x |
| **Frontend framework** | React | 19.x |
| **Build tool** | Vite | 8.1.5 |
| **Language** | TypeScript | 7.0.2 |
| **Backend framework** | Fastify | current stable |
| **ORM** | Prisma | 7.9.0 |
| **Database** | PostgreSQL | local Docker (dev), Azure Flexible Server (SaaS prod) |
| **Styling** | Tailwind CSS | 4.3.3 |
| **Component library** | Shadcn/ui | latest |
| **API style** | REST with OpenAPI | — |
| **Runtime** | Node.js | 22.x LTS |

### Notes
- **TypeScript 7.0.2** ships with a new Go-based compiler (`tsc`) — dramatically faster builds.
- **Tailwind CSS 4.x** is now fully released (no longer beta).
- **Prisma** is database agnostic — switching from PostgreSQL to MySQL/SQL Server requires only a `datasource` change in `schema.prisma`.
- **Fastify** is similar to Express but ~2x faster, built TypeScript-first, with a structured plugin lifecycle and first-class OpenAPI support via `@fastify/swagger`.

---

## Monorepo Structure

```
monorepo/
├── apps/
│   ├── frontend/              # React 19 + Vite + Tailwind + Shadcn/ui
│   ├── api/                   # Fastify + TypeScript + OpenAPI
│   └── admin/                 # Admin dashboard (optional, future)
├── packages/
│   ├── shared-types/          # Shared TypeScript types across apps
│   ├── ui/                    # Tailwind + Shadcn/ui component library
│   ├── auth/                  # OAuth2 logic (Google / Microsoft / Facebook)
│   ├── database/              # Prisma schema + migrations
│   └── validation/            # Zod shared validation schemas
├── docker/                    # Docker configs (local dev + self-hosted deploy)
├── infra/
│   └── terraform/
│       ├── modules/           # Reusable modules (database, app-service, frontend, key-vault, networking, container-registry)
│       └── environments/      # Per-environment configs (dev, staging, prod)
└── docs/
    └── brainstorming/         # This folder
```

---

## Deployment Modes

### Local Development
- Docker Compose spins up PostgreSQL locally
- All developers use same setup: `docker-compose up`
- Environment variables switch behavior (local vs cloud)

### SaaS Production (Azure)
- Azure Container Registry
- Azure App Service or AKS
- Azure PostgreSQL Flexible Server (managed, multi-tenant)
- Multi-tenant mode enabled

### Self-Hosted Production
- User runs `docker-compose up` on their own infrastructure
- Single-tenant mode
- Their own PostgreSQL instance
- They manage their own data

---

## Authentication

### Providers
- Google OAuth2
- Microsoft OAuth2
- Facebook OAuth2

### Rules
- SaaS should stay OAuth-first (Google/Microsoft/Facebook)
- Self-hosted should support an optional local-account mode for non-technical users
- Local-account mode can coexist with OAuth mode behind configuration

### Local Non-OAuth Account Mode (Brainstorm)
Goal: let non-technical household users run locally without provider registration.

- First-run setup creates one organization and one initial admin user (email + password)
- Admin can create additional users in the same organization
- Admin sets a temporary password for each new user
- New user must change password at first login (`mustResetPassword = true`)
- Passwords are stored only as secure hashes (Argon2id), never plaintext
- This mode is intended for self-host/local installs; SaaS remains OAuth-first

### Account Linking
- **Schema**: Designed from day 1 to support multiple OAuth providers per user (via `oauth_providers` junction table)
- **Application logic**: Not exposed in UI initially — deferred feature
- **Rationale**: Schema change later = painful data migration. UI change later = easy sprint task.

```
oauth_providers table:
  userId → provider (google | microsoft | facebook) → providerUserId
```

---

## Organizations

### Concept
- Every deployment (SaaS or self-hosted) has at least one **Organization**
- An organization is like a family/group account — multiple people share access
- Self-hosted example: a household sets up one org, family members join it

### Admin / Setup Wizard
- On first run, app shows a **Setup Wizard**
- First person to sign in via OAuth automatically becomes **Organization Admin**
- Admin can then invite others to the organization

### Single Organization Per User (Current Constraint)
- **Decision**: A user belongs to one organization at a time
- **Schema**: Designed to support multiple orgs per user later (junction table)
- **Application logic**: Enforces single-org today; easy to relax later
- **Practical consequences of single-org**:
  - Works perfectly for household/family/small group use case
  - Pain point: A user with a home install AND a SaaS account can't share one login across both — needs separate logins per org
  - Pain point: A consultant invited to multiple clients' installs can't use one account across them
  - **Assessment**: Not a real problem for the target audience. Revisit if B2B multi-org use cases emerge.

---

## Database Strategy

### ORM
- **Prisma** — type-safe, supports multiple databases
- Switching database engine = change `datasource` in `schema.prisma` only

### Environments
| Environment | Database |
|---|---|
| Local dev | PostgreSQL via Docker Compose |
| Self-hosted prod | PostgreSQL (user's own server) |
| SaaS prod | Azure PostgreSQL Flexible Server |

### Connection
- All environments use a `DATABASE_URL` environment variable
- No code changes needed to switch environments

### Migrations
- **Tool**: Prisma Migrate (replaces DACPAC — PostgreSQL-native, TypeScript-integrated)
- **Approach**: Migration-based (ordered SQL files committed to git)
- Migration history tracked in `_prisma_migrations` table in the database

#### Developer workflow
```bash
# Edit schema.prisma, then generate + apply migration locally:
prisma migrate dev --name add-order-table
# → Creates packages/database/migrations/20260724_add-order-table.sql
# → Applies immediately to local Docker Postgres
```

#### SaaS production deploy (CI/CD)
```bash
# Runs automatically before app starts in pipeline:
prisma migrate deploy
# → Applies any unapplied migrations in order
# → Safe to run on every deploy (idempotent)
```

#### Self-hosted users
```bash
# Docker entrypoint automatically runs on container start:
prisma migrate deploy
# → Their Postgres is always up to date when they pull a new image
# → No manual SQL scripts required
```

---

## API Authorization

### JWT Strategy
- **Access token**: Short-lived (15 min), sent as `Authorization: Bearer <token>` header
- **Refresh token**: Long-lived (7–30 days), stored in `httpOnly` cookie (inaccessible to JavaScript — XSS safe)
- **Plugin**: `@fastify/jwt` (official Fastify plugin)

### JWT Payload
```typescript
interface JwtPayload {
  sub: string           // userId
  email: string
  organizationId: string
  role: 'admin' | 'member'
  iat: number           // issued at
  exp: number           // expiry
}
```

### Route Protection Pattern
Routes are split into two Fastify plugins:

```
Server
├── Public plugin  (no JWT check)
│   ├── POST /auth/google/callback
│   ├── POST /auth/microsoft/callback
│   ├── POST /auth/facebook/callback
│   ├── POST /auth/refresh
│   └── GET  /health
└── Protected plugin  (JWT hook applied — all routes inside auto-protected)
    ├── POST /api/orders
    ├── GET  /api/users
    └── ... all application routes
```

The `onRequest` hook on the protected plugin calls `request.jwtVerify()` before any route handler runs. Invalid or missing tokens return `401` immediately — route handlers never execute.

### Per-Request Organization Scoping
Every protected route handler has access to `request.user` (typed, no casting needed):
```typescript
const { sub: userId, organizationId, role } = request.user
```

An optional database membership check validates that the user's org membership is still current (catches cases where an admin removed a user after their JWT was issued).

### Token Refresh Flow
```
Access token expires
  → Frontend calls POST /auth/refresh (httpOnly cookie sent automatically)
  → Server validates refresh token
  → Issues new access token
  → Refresh token expires → user must log in again
```

### Per-Deployment JWT Secret
- **SaaS**: `JWT_SECRET` stored in Azure Key Vault, injected at runtime
- **Self-hosted**: `JWT_SECRET` in local `.env` file (generated during setup wizard)

---

## Multi-Tenancy

| Mode | Tenancy |
|---|---|
| SaaS | Multi-tenant — shared database, tenant isolation via `tenant_id` / organization row-level |
| Self-hosted | Single-tenant — database belongs entirely to the deploying organization |

---

## Open Questions

- [ ] Can a user belong to multiple organizations in the future? (Schema supports it; app logic currently enforces single-org)
- [ ] License key mechanism for self-hosted users?
- [ ] What does the Setup Wizard flow look like step by step?
- [ ] Role-based access control (RBAC) beyond admin/member?
- [x] Azure deployment tooling: **Terraform** (decided) — see `infra/terraform/`
- [ ] Terraform remote state backend (Azure Storage Account) — configure before first `apply`
- [ ] OAuth provider app registrations — separate registrations needed per environment (dev/staging/prod)
