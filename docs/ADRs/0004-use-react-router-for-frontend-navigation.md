# ADR 0004: Use React Router for frontend navigation

- Status: draft
- Date: 2026-08-30
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Creating or changing frontend routes, navigation links, route parameters, or URL query state.
- Migrating an existing frontend route or replacing custom History API routing.
- Adding a major frontend feature view that must preserve location through deep links, refresh, or browser back/forward navigation.
- Not applicable to transient component state that does not represent user location or workflow context.

## Context

- ADR 0002 requires first-class, history-safe routing for major views and URL-owned workflow context.
- The current Vite/React frontend in [App.tsx](../../apps/frontend/src/App.tsx) implements navigation with `window.history`, `popstate`, and component state.
- The Journal feature needs nested time-scope routes and URL-addressable date context while preserving every existing workspace scaffold path.
- React Router v7 supports React 19 and provides a declarative `BrowserRouter` integration with the browser History API without requiring framework-mode, server rendering, or router-owned data loading.

## Decision Statement

Use React Router v7 in declarative mode as the frontend routing library. Use `BrowserRouter`, route components, route parameters, query parameters, and `Link`/navigation hooks to represent major view locations and meaningful context.

Continue using the existing frontend API client and component-level data loading for now. Do not adopt React Router framework mode, server rendering, file-system routes, loaders, actions, or router-owned data APIs unless a future ADR explicitly changes this decision.

## Do

- Add and maintain routes through React Router v7 declarative APIs.
- Preserve every existing workspace path while migrating the custom History API implementation.
- Use route parameters or query parameters for Journal time scope, date, and other meaningful location context.
- Use `Link`, `NavLink`, and navigation hooks instead of direct `window.history` calls.
- Provide a route-level not-found experience for unmatched URLs.
- Test direct navigation, refresh, and browser back/forward behavior for changed routes.

## Do Not

- Do not add new custom `popstate`, `pushState`, or `replaceState` routing logic.
- Do not store major view location or Journal date/scope only in component state.
- Do not introduce framework mode, SSR, server adapters, file-system routing, loaders, actions, or router-owned data fetching without a new ADR.
- Do not break existing workspace URLs during migration.
