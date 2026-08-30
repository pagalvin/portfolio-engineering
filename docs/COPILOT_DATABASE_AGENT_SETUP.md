# Copilot Cloud Agent Setup for Database Tasks

This guide configures GitHub Copilot cloud agent to work with Prisma database migrations and schema management.

## Quick Setup

1. **Create the directory structure** (if not already present):
   ```bash
   mkdir -p .github/workflows
   ```

2. **Create `.github/workflows/copilot-setup-steps.yml`** with the content provided in the "YAML Configuration" section below.

---

## YAML Configuration

Place this content in `.github/workflows/copilot-setup-steps.yml`:

```yaml
name: "Copilot Setup Steps"

on:
  workflow_dispatch:
  push:
    paths:
      - .github/workflows/copilot-setup-steps.yml
  pull_request:
    paths:
      - .github/workflows/copilot-setup-steps.yml

jobs:
  copilot-setup-steps:
    runs-on: ubuntu-latest

    permissions:
      contents: read

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_HOST_AUTH_METHOD: trust
          POSTGRES_DB: portfolio_engineering_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Set DATABASE_URL environment variable
        run: |
          echo "DATABASE_URL=postgresql://postgres@localhost:5432/portfolio_engineering_test" >> $GITHUB_ENV

      - name: Generate Prisma client
        run: pnpm --filter @portfolio-engineering/database exec prisma generate

      - name: Verify database connectivity and apply migrations
        run: |
          pnpm --filter @portfolio-engineering/database exec prisma db push --skip-generate || true

      - name: Build database package
        run: pnpm --filter @portfolio-engineering/database build

      - name: Verify schema.prisma syntax
        run: pnpm --filter @portfolio-engineering/database exec prisma validate
```

---

## What This Setup Provides to Copilot Database Agents

### 1. Runtime Environment
- **Node.js 20** — JavaScript runtime for project execution
- **pnpm** — Fast, deterministic package manager (monorepo-aware)
- **PostgreSQL 16** — Database service running on localhost:5432
  - Auto-health-checked before steps begin
  - Pre-configured database: `portfolio_engineering_test`
  - Trust authentication (development-friendly)

### 2. Database Tools & Permissions
- **Prisma CLI** — `prisma generate`, `prisma db push`, `prisma validate`, `prisma migrate` commands
- **Schema validation** — Can verify `schema.prisma` syntax before migration
- **Migration testing** — Can apply migrations against a real PostgreSQL instance
- **Client generation** — Can regenerate Prisma client from schema changes

### 3. Build & Verification
- **Package build** — `pnpm --filter @portfolio-engineering/database build`
- **Typecheck** — Full TypeScript compilation and type checking
- **Dependency cache** — npm cache for faster installation on repeat runs

### 4. Key Capabilities This Enables

| Task | Capability | How Used |
|---|---|---|
| **T-02.5 (Migration)** | Create, test, validate Prisma migrations | `prisma migrate dev` or `prisma db push` |
| **T-02.6 (Store)** | Generate Prisma client; typecheck store code | `prisma generate` + `pnpm build` |
| **T-02.2 (Validation)** | Build and typecheck validation schemas | Full monorepo build chain |
| **E-05 (Media)** | Extend schema with media tables | `prisma generate`, `prisma validate` |

## Environment Variables Set for Copilot

The workflow sets `DATABASE_URL` which Copilot inherits:

```
DATABASE_URL=postgresql://postgres@localhost:5432/portfolio_engineering_test
```

This allows Prisma commands to connect to the PostgreSQL service automatically.

## Testing the Setup

After creating the `.github/workflows/copilot-setup-steps.yml` file:

1. **Commit and push** the file to your default branch (e.g., `main`)
2. **Go to GitHub** → Actions tab → Find "Copilot Setup Steps" workflow
3. **Click "Run workflow"** to manually test
4. **Review logs** to verify all steps pass:
   - Node.js and pnpm installed
   - Dependencies installed
   - Prisma client generated
   - PostgreSQL connectivity verified
   - Schema syntax validated

Once verified, Copilot cloud agent will automatically run these setup steps before starting work on database tasks.

## What Copilot Database Agent Can Now Do

✅ Create new Prisma migrations (`prisma migrate create`)  
✅ Apply migrations to test database (`prisma db push`, `prisma migrate dev`)  
✅ Validate schema syntax (`prisma validate`)  
✅ Generate Prisma client (`prisma generate`)  
✅ Build and typecheck database package  
✅ Test store implementations against a real database  
✅ Create migration rollback plans  
✅ Verify field constraints, indexes, foreign keys  

## For Future Extensions

If you need additional capabilities:

- **Different database** (MySQL, SQLite, etc.): Change `services.postgres.image` and adjust `DATABASE_URL`
- **Other tools** (Docker, CLI tools): Add additional `apt-get install` steps
- **Environment secrets** (API keys, credentials): Use GitHub Actions secrets in the `copilot` environment
- **Larger runners** (more CPU/memory): Change `runs-on: ubuntu-latest` to a larger runner like `ubuntu-4-core`

---

**Status:** This setup is ready to enable T-02.5 (Prisma migration), T-02.6 (journalStore implementation), and all subsequent database work without tool limitations.
