# Actionable Alerts Feature Brief

- Status: draft
- Date: 2026-09-05

## Summary

Establish a generic actionable alerting system for P/OS. Alerts should notify users about conditions that deserve attention and, when possible, provide a direct action that takes the user to the relevant app location.

The first motivating example is an alert such as "You have no AI providers set up." Clicking that alert should route the user to the AI provider configuration area. Later examples include market, portfolio, and workflow alerts such as "Stock XYZ increased by 5% in the last hour."

This feature does not need to be implemented before AI provider connections, but it is likely to become a near-term follow-on once provider configuration exists.

## Business objective

Help users notice important setup gaps, portfolio events, and workflow conditions at the right time, and reduce friction by making each alert actionable.

## Problem / opportunity

P/OS will increasingly contain features where user attention matters:

- setup prerequisites, such as missing AI provider connections;
- stale or incomplete configuration;
- portfolio and market movements;
- journal, rules, and review workflow reminders;
- product news or operational notices.

Without a generic alerting pattern, each feature may create one-off banners, badges, toasts, or notifications with inconsistent routing, dismissal, severity, and persistence behavior.

## Desired user outcomes

- As a user, I can see alerts that identify important conditions requiring my attention.
- As a user, I can click an actionable alert and go directly to the relevant place in the app.
- As a user, I can distinguish informational notices from warnings or urgent alerts.
- As a user, I can dismiss alerts that are no longer useful, where dismissal is appropriate.
- As a user, I am not repeatedly nagged by the same resolved or dismissed alert.
- As a user, I can rely on alerts to reflect current app state.

## Initial scope

### Generic alert model

Define a reusable alert model with fields such as:

- id;
- organization id, when organization-scoped;
- optional user id, when user-specific;
- source or category;
- title;
- message;
- severity;
- status;
- created timestamp;
- updated timestamp;
- optional expiry timestamp;
- optional dismissed timestamp;
- optional action target.

### Action target

Alerts should support an action target that can route users to the relevant app location.

Examples:

- missing AI providers -> Settings / Connections / AI provider configuration;
- product news -> news or release-notes surface;
- portfolio movement -> relevant portfolio or holding detail;
- journal reminder -> relevant journal view.

The action target should be route-safe and compatible with the existing URL-addressable navigation decisions.

### Setup-state alerts

The first likely alert class is setup-state or configuration-state alerts.

Example:

- If an organization has no enabled AI provider connections, show "You have no AI providers set up" with an action to configure AI providers.

### Alert presentation

Presentation can start simple:

- a global alert area, bell, or dashboard card;
- optional page-level inline alerts where contextually useful;
- consistent severity and action styling;
- clear dismissal behavior.

The first implementation should prioritize consistency and actionability over notification-center sophistication.

## Future scope

Future alert classes may include:

- market movement alerts;
- portfolio threshold alerts;
- watchlist alerts;
- rules adherence alerts;
- journal workflow reminders;
- AI provider failures or quota/authentication problems;
- repo-sourced product news;
- expiring or deprecated provider/model notices.

## Non-goals

Do not include these in the first slice unless a later spec explicitly expands scope:

- push notifications;
- email or SMS delivery;
- background market-data ingestion;
- user-authored alert rule builders;
- real-time streaming alert transport;
- advanced snooze schedules;
- alert analytics;
- cross-device read-state synchronization beyond normal persisted app data;
- broker/trading execution actions.

## Suggested architecture

### Alert producers

Treat alert generation as a producer pattern. Features can produce alerts from their own state while sharing a common alert contract.

Potential producers:

- configuration checks;
- scheduled jobs;
- runtime content/news ingestion;
- portfolio data processing;
- AI provider health checks.

### Alert storage

Use persistent storage for alerts that must survive refresh, dismissal, or cross-session use.

Some purely derived setup alerts may not need durable rows if they can be computed from current state. The decomposition should decide whether the first missing-AI-provider alert is:

- a persisted alert generated when setup state changes; or
- a derived alert returned by an alerts API while the condition is true.

### Alert actions

Actions should use typed route/action descriptors rather than arbitrary URLs where possible.

Suggested shape:

- action kind;
- route id or path;
- route params;
- query params;
- label.

Avoid action payloads that execute backend mutations directly from the alert click. Clicking an alert should navigate to a workflow; the user should then confirm any meaningful changes there.

### Relationship to repo-sourced runtime content

Repo-sourced runtime content may produce news or announcement alerts.

Important boundary:

- repo content can describe news items and safe action links;
- backend validation still controls which content becomes an alert;
- repo content must not create executable actions or privileged backend operations.

## Suggested first implementation path

1. Define the alert contract and severity/status vocabulary.
2. Add an alerts API that returns current alerts for the authenticated organization/user.
3. Add a simple frontend alert presentation surface.
4. Add the missing-AI-provider setup alert after AI provider connections exist.
5. Wire the alert action to the AI provider configuration section.

## Applicable constraints and ADR candidates

Existing ADRs:

- [ADR 0001](../../ADRs/0001-organization-aware-data-access.md): organization-scoped alerts must include direct organization scope.
- [ADR 0002](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md): alert actions should navigate to URL-addressable app locations.
- [ADR 0004](../../ADRs/0004-use-react-router-for-frontend-navigation.md): frontend alert actions should use React Router navigation patterns.

Related feature briefs:

- [AI Provider Connections Feature Brief](./ai-provider-connections-feature-brief.md)
- [Repo-Sourced Runtime Content Feature Brief](./repo-sourced-runtime-content-feature-brief.md)

Recommended new ADR:

- Use generic actionable alerts for attention-worthy app conditions.

Decision points to capture:

- Alerts use one shared model and presentation pattern.
- Alerts should be actionable when a meaningful destination exists.
- Alert actions navigate users to workflows rather than directly performing privileged mutations.
- Feature-specific alert producers must not create one-off alert UI or routing semantics.

## Open questions for decomposition

- Should setup-state alerts be persisted, derived, or a hybrid?
- What severity vocabulary should P/OS use initially?
- Should alert dismissal be per user, per organization, or both?
- Where should global alerts be displayed first?
- Should expired or resolved alerts remain visible in history?
- How should repo-sourced news become alerts without overwhelming users?
- Should "no AI providers configured" mean no saved providers or no enabled providers?

## Definition of done for the first slice

- A shared alert contract exists.
- Alerts can include safe action targets.
- The frontend can render at least one current alert.
- Clicking an actionable alert navigates to the expected app location.
- Alerts respect organization scope where applicable.
- Dismissal or resolution behavior is explicit.
- Feature-specific code can produce alerts without inventing custom UI patterns.
