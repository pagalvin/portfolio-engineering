# portfolio-engineering

Portfolio operating system app for retail traders.

## Quick start

From the repository root:

```powershell
corepack pnpm install
corepack pnpm db:up
corepack pnpm db:migrate:dev
corepack pnpm dev
```

This starts:
- frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001`

## Local development modes

### Mode A: quick demo flow (no provider setup required)

Use demo session states:
- authenticated: `http://127.0.0.1:5173/?demoAuth=authenticated`
- unauthenticated: `http://127.0.0.1:5173/?demoAuth=unauthenticated`

### Mode B: OAuth-enabled local flow

Copy `.env.example` to `.env` at the repository root and set:
- API provider verification: `GOOGLE_CLIENT_ID`
- frontend Google button initialization: `VITE_GOOGLE_CLIENT_ID`
- optional callback payload overrides:
  - `VITE_OAUTH_ORGANIZATION_SLUG`
  - `VITE_OAUTH_ORGANIZATION_NAME`

Current auth behavior:
- `GET /auth/session?demoAuth=authenticated` returns authenticated session data, an access token in `x-dev-access-token`, and an `httpOnly` refresh-token cookie
- `POST /auth/refresh` rotates the refresh token and returns a fresh access token
- `GET /api/me` requires an `Authorization` header that carries the access token
- provider callback routes verify provider tokens:
  - `POST /auth/google/callback`
  - `POST /auth/microsoft/callback`
  - `POST /auth/facebook/callback`
- the unauthenticated frontend state includes Google sign-in and posts the received ID token to `POST /auth/google/callback`

## Current architecture snapshot

- Monorepo with React frontend, Fastify API, shared auth/validation packages, and Prisma-backed PostgreSQL persistence
- organization-aware auth and data access
- JWT session plus refresh-token rotation

Key docs:
- canonical schema docs and ER diagram: [docs/schema/current.md](docs/schema/current.md)
- architecture ADRs: [docs/ADRs/](docs/ADRs/)
- ADR follow-up recommendations: [docs/ADRs/ADR Recommendations.md](docs/ADRs/ADR%20Recommendations.md)
- current tech debt checklist: [docs/tech-debt/checklist.md](docs/tech-debt/checklist.md)
- closeout notes archive: [docs/archive/](docs/archive/)

Database bootstrap:
- Prisma schema, generated client source, and migrations live in [packages/database/](packages/database/)
- local Postgres container config is in [docker-compose.yml](docker-compose.yml)
- `corepack pnpm db:up` starts Postgres
- `corepack pnpm db:migrate:dev` applies migrations and generates Prisma client

## For contributors

Useful verification commands:

```powershell
corepack pnpm build
corepack pnpm lint
```

Project origin and vision resources:
- dedicated YouTube channel: https://youtube.com/@portfolioengineering?si=_LJDWD_X4kDJUirB
- introduction: https://youtu.be/Srf49Z7D3DM
- vision session (mind mapping): https://www.youtube.com/watch?v=XURAgoB7XPc
- vision cleanup, MVP, and roadmap discussion: https://youtu.be/SrLCx27_n3g?si=7dmsvELCGpN9eaMZ
- early predecessor codebase: https://github.com/pagalvin/options-manager

## Changelog

### 2026-07-25

- Bootstrapped the first runnable pnpm monorepo slice with a React frontend, Fastify API, shared auth packages, and Prisma-backed PostgreSQL persistence.
- Added JWT-backed session and refresh-token flows with organization-aware user, OAuth identity, and token storage managed through the API and database packages.
- Wired the unauthenticated frontend state to Google sign-in, verified provider callback handling, and documented the local OAuth setup required for realistic auth testing.

## License

The full license is in [LICENSE.md](LICENSE.md).

In a nutshell, the license allows personal and educational use. Commercialization is restricted to the author and designated delegates; see the full license for details.
