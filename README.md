# portfolio-engineering

Portfolio operating system app for retail traders.

This project was initialized on 7/6/2026.

# YouTube

- Channel: Dedicated YouTube channel here: https://youtube.com/@portfolioengineering?si=_LJDWD_X4kDJUirB
- Introduction: https://youtu.be/Srf49Z7D3DM
- Vision session (mind mapping): https://www.youtube.com/watch?v=XURAgoB7XPc
- Cleaned up vision, product features, MVP and road map discussion: https://youtu.be/SrLCx27_n3g?si=7dmsvELCGpN9eaMZ

# Basis

This project is an evolution and generalization of a very early implementation of this idea. You can see that code here: https://github.com/pagalvin/options-manager. Note that the "options-manager" code is an early version that was abandoned.

# Features

To-be-built feature list includes:
- Inventory selection (i.e., screening for stocks)
- Viewing and understanding your stock and options portfolio
- Risk management (margin utilization, margin crush, margin crisis plans, monte carlo simulations)
- Forecasting at the week and month level, weekly planning
- Journaling
- Decision support (e.g., which options to roll first during a week)
- Tax planning support including wash sales
- Cloud deployable
- Define your trading rules and use AI to help you follow them
- Use AI to analyze your decisions and detect patterns (good and bad)
- Capture daily snapshots of your portfolio for advanced long-term analysis
- Advanced order placement - select a minimum net credit, a starting credit and 'walk down' until an order is filled or you reach your minimum
- Automate actions, such as placing orders

# Tentative Tech Stack

- React/TypeScript/Vite on the front end
- NodeJS / TypeScript on the backend
- Postgres for persistence

# Current Local Bootstrap

From the repository root:

```powershell
corepack pnpm install
corepack pnpm db:up
corepack pnpm db:migrate:dev
corepack pnpm dev
```

That starts:
- frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001`

Before running `corepack pnpm dev`, copy [.env.example](C:/src/portfolio-engineering/portfolio-engineering.worktrees/plan-analysis-first-step/.env.example) to `.env` at the repository root and provide the OAuth env vars for both processes:
- API verification: `GOOGLE_CLIENT_ID`
- Frontend Google button initialization: `VITE_GOOGLE_CLIENT_ID`
- Optional callback payload overrides: `VITE_OAUTH_ORGANIZATION_SLUG`, `VITE_OAUTH_ORGANIZATION_NAME`

Demo session states:
- authenticated: `http://127.0.0.1:5173/?demoAuth=authenticated`
- unauthenticated: `http://127.0.0.1:5173/?demoAuth=unauthenticated`

Current development auth behavior:
- `GET /auth/session?demoAuth=authenticated` returns the authenticated session body, an access token in the `x-dev-access-token` response header, and an `httpOnly` refresh-token cookie
- `POST /auth/refresh` uses that cookie to rotate the refresh token and return a fresh access token
- `GET /api/me` requires an `Authorization: Bearer <access-token>` header
- Provider callback routes expect a provider token and verify it against provider systems:
  - `POST /auth/google/callback`
  - `POST /auth/microsoft/callback`
  - `POST /auth/facebook/callback`
- The unauthenticated frontend state includes a Google sign-in button that collects an ID token, calls `POST /auth/google/callback`, and updates the page to the authenticated session state.
- Callback role assignment is server-controlled (first user in an organization becomes admin; later users default to member unless already assigned)

Current database bootstrap:
- Prisma schema, generated client source, and migrations live in [packages/database/](C:/src/portfolio-engineering/portfolio-engineering.worktrees/plan-analysis-first-step/packages/database)
- The repo ships a local Postgres container in [docker-compose.yml](C:/src/portfolio-engineering/portfolio-engineering.worktrees/plan-analysis-first-step/docker-compose.yml)
- `corepack pnpm db:up` starts the database container
- `corepack pnpm db:migrate:dev` applies Prisma migrations and generates the client against that database
- Copy [.env.example](C:/src/portfolio-engineering/portfolio-engineering.worktrees/plan-analysis-first-step/.env.example) to a local `.env` if you need to override `DATABASE_URL`
- Populate OAuth env vars in [.env.example](C:/src/portfolio-engineering/portfolio-engineering.worktrees/plan-analysis-first-step/.env.example) before testing real provider callbacks
- The authenticated development auth path depends on a reachable PostgreSQL instance because the API persists development organization, user, OAuth identity, and refresh-token hashes

Useful verification commands:

```powershell
corepack pnpm build
corepack pnpm lint
```

# License

The full license is located here: https://github.com/pagalvin/portfolio-engineering/blob/main/LICENSE.md

In a nut shell, the license allows anyone to use this code for personal and educational purposes. No one except the author and his delegates are allowed to commercialize this solution. Read the license for full details.
