# ADR 0002: Require URL-addressable routing with history-safe navigation

- Status: draft
- Date: 2026-07-26
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Creating or changing frontend navigation, routes, or page-level state.
- Building new feature pages, including placeholders and production views.
- Designing behavior for browser refresh, deep links, and back/forward navigation.
- Not applicable to ephemeral UI-only state that does not represent user location or workflow context.

## Context

- Portfolio OS is intended for frequent, task-oriented use by active retail traders.
- Users must be able to reload pages, share links, and use browser navigation without losing place.
- Route reliability is foundational for scaffold-first delivery and later feature deep dives.

## Decision Statement

Treat every major app view as URL-addressable and navigable through standard browser history behavior. Persist user location and meaningful page context in the URL (path, query, or hash) so refresh and back/forward preserve workflow continuity.

## Do

- Create explicit routes for each major feature view.
- Ensure deep links load the intended page directly.
- Preserve navigation semantics for browser back and forward.
- Keep users on the same route after refresh.
- Store meaningful location context in URL state (for example selected tab, mode, or primary filters).
- Use a routing library with first-class history integration (for example React Router or equivalent).

## Do Not

- Do not gate major views behind in-memory-only navigation state.
- Do not rely on implicit defaults that change the visible page after refresh.
- Do not break back/forward behavior with non-route UI state hacks.
- Do not hide core workflow context only in transient component state.
