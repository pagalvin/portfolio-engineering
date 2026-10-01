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

Copy [.env.example](.env.example) to `.env` at the repository root before starting the app, and set `APP_MODE=local` for passwordless household profiles or `APP_MODE=hosted` for OAuth-backed hosted login.

The root dev command starts the API first, waits for `http://127.0.0.1:3001/health`, and then starts the frontend:
- frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001`

## Local development modes

### Local household profile mode

Set `APP_MODE=local` to run the app with passwordless household profiles and no external OAuth setup.

### Hosted OAuth mode

Set `APP_MODE=hosted` and configure:
- API provider verification: `GOOGLE_CLIENT_ID`
- frontend Google button initialization: `VITE_GOOGLE_CLIENT_ID`
- optional callback payload overrides:
  - `VITE_OAUTH_ORGANIZATION_SLUG`
  - `VITE_OAUTH_ORGANIZATION_NAME`

Current auth behavior:
- `GET /auth/session` reports the configured app mode and resumes valid refresh-cookie sessions.
- `APP_MODE=local` exposes `/auth/profiles`, `/auth/profiles/select`, and passwordless profile creation/selection.
- `APP_MODE=hosted` requires OAuth sign-in and rejects passwordless local-profile sessions.
- `POST /auth/refresh` rotates the refresh token with a short grace window and returns a fresh access token.
- `GET /api/me` requires an `Authorization` header that carries the access token.
- Provider callback routes verify provider tokens in hosted mode:
  - `POST /auth/google/callback`
  - `POST /auth/microsoft/callback`
  - `POST /auth/facebook/callback`
- The hosted unauthenticated frontend state includes Google sign-in and posts the received ID token to `POST /auth/google/callback`.

## Current architecture snapshot

- Monorepo with React frontend, Fastify API, shared auth/validation packages, and Prisma-backed PostgreSQL persistence
- organization-aware auth and data access
- JWT session plus refresh-token rotation

Key docs:
- canonical schema docs and ER diagram: [docs/schema/current.md](docs/schema/current.md)
- architecture ADRs: [docs/ADRs/](docs/ADRs/)
- ADR follow-up recommendations: [docs/ADRs/ADR Recommendations.md](docs/ADRs/ADR%20Recommendations.md)
- business requirements specs: [docs/specs/](docs/specs/)
- spec template: [docs/specs/spec_template.md](docs/specs/spec_template.md)
- how to manage in-app Help content: [docs/specs/0007-help-system-content-guide.md](docs/specs/0007-help-system-content-guide.md)
- implementation plans: [docs/plans/](docs/plans/)
- plan template: [docs/plans/plan_template.md](docs/plans/plan_template.md)
- current tech debt checklist: [docs/tech-debt/checklist.md](docs/tech-debt/checklist.md)
- UX design artifacts and prototypes: [docs/uxd/](docs/uxd/)
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
- in-app Help system build session (recorded coding session): https://youtu.be/PfTcHUP4ISk
- early predecessor codebase: https://github.com/pagalvin/options-manager

## Changelog

The canonical changelog is maintained in [CHANGELOG.md](CHANGELOG.md) and is available to authenticated users under **System → Change Log** at `/change-log`.

## License

The full license is in [LICENSE.md](LICENSE.md).

In a nutshell, the license allows personal and educational use. Commercialization is restricted to the author and designated delegates; see the full license for details.
