# ADR 0017: Standardize data grid list behaviors

- Status: accepted
- Date: 2026-09-26
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Building or changing a list page that shows records in a table/grid with search or filters, such as the Security Master list.
- Adding a new record type whose primary browse experience is a grid.
- Reviewing a UX flow, plan, or pull request that includes a results grid.
- Not applicable to read-only label/value detail views, calendars, or small static tables that have no filters or row navigation.

## Context

- The Security Master list ([0008 UX flow](../uxd/flows/0008-security-master.md)) set several grid behaviors through iterative user feedback: row hover, a compact page heading, a one-row filter bar, a visible default status filter, and a count status line under the grid.
- The Journal review table (`apps/frontend/src/components/JournalReviewTable.tsx`) already uses row hover, but with a different token (`hover:bg-surface-emphasis`). Without a standard, grids drift apart.
- Upcoming features (Experiments, Rules, Positions, Orders, and imports into the Security Master) will add more grids. Agents need one reference instead of reverse-engineering the latest page.
- Related decisions:
  - Filter state must live in the URL ([ADR 0002](0002-url-addressable-routing-and-history-safe-navigation.md), [ADR 0004](0004-use-react-router-for-frontend-navigation.md)).
  - UI must use semantic Tailwind tokens and shared shadcn/ui primitives ([ADR 0005](0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md)).
  - Data and counts must be organization-scoped ([ADR 0001](0001-organization-aware-data-access.md)).

## Decision Statement

Every filterable data grid uses a shared set of list behaviors:

- compact page heading and one-row filter bar
- URL-owned filters with visible defaults
- semantic table markup
- subtle row hover plus an explicit row action
- distinct loading, error, and empty states
- a count status line below the grid that reads "Showing N of T {items}", computed from organization-scoped server data

## Do

### Layout and heading

- Use a compact page title (`text-2xl font-semibold`), not the global large `h1` size, so the grid stays the focus.
- Put the primary create action (for example, **Add security**) in the header, next to the title.
- Put search and filters in one row at wide desktop widths. Wrap to two columns on tablet and one column on narrow mobile. Give search the widest column.

### Filters

- Store search and filter values in the URL query. Preserve the other filters when one changes. Use `replace` history for filter edits.
- Use a native `Select` for any filter with a fixed set of values. Include an "All ..." choice. If the URL holds an unlisted value, show it as a labelled current option rather than silently changing it.
- When a filter has a non-"all" default, such as Status = Active:
  - show that default as the selected value in the control
  - treat an omitted URL parameter as the default
  - write an explicit URL value (for example `status=all`) when the user picks a non-default option
- Treat malformed, repeated, or unknown query parameters as an explicit invalid-filter state that offers a **Clear filters** action.

### Table semantics

- Use `<table>`, `<thead>`, and `<th>`, plus a screen-reader-only `<caption>`.
- Convey status with text, never with color alone.
- Show a clear placeholder (for example "Not provided") for missing values.
- Allow horizontal overflow (`overflow-x-auto`) instead of truncating the key column (for example, Symbol) or hiding row actions.

### Row hover and actions

- Give each body row a subtle hover background: `transition-colors hover:bg-surface-muted`. This is the standard grid row-hover token.
- Always provide an explicit, keyboard-reachable row action, such as a **View** link. Hover is only a visual aid for tracking across a row.
- Carry the current list URL into detail routes through a validated `returnTo`, so returning restores the same filtered view.

### Result states

- Show these states separately, and never present one as another:
  - loading (`role="status"`)
  - load error (`role="alert"` with **Try again**)
  - empty
  - results
- Never render an auth or network failure as an empty grid.
- In the empty state, suggest adding a record or adjusting filters.

### Count status line

- Show a muted status line at the bottom of the results panel:
  - it sits below the table and inside the same panel
  - classes: `mt-3 border-t border-border-subtle pt-3 text-sm text-text-muted`
  - text: **Showing N of T {singular/plural noun}**
- Define N and T as follows:
  - **N** is the number of records matching the current search and filters.
  - **T** is the organization's total for that record type, ignoring filters and including inactive records.
- Also show the count line in the empty state (for example "Showing 0 of 12 securities"), so users can tell that records exist but are filtered out.
- Get T from the server, scoped by the verified organization, and return it in the same list response (for example `totalCount`). For the Security Master, `GET /api/securities` returns `{ securities, totalCount }`.
- Format numbers with `toLocaleString()`. Pluralize from T.
- Expose the line as `role="status"` so screen readers politely announce the new count after a filter change.

### Testing

- Include tests showing that:
  - filter changes update the URL
  - the default filter is shown when its parameter is omitted
  - an explicit "all" value round-trips
  - invalid filters show the invalid-filter state
- Include a test that the count response is organization-scoped: another organization's records never affect T.
- Include tests that N and T render in both the results state and the empty state.
- Include tests that the explicit row action works without hover and preserves `returnTo`.

## Do Not

- Do not compute T in the browser from a filtered list, or from a second unbounded "fetch all" request.
- Do not show an invented, placeholder, or stale count. Hide the count line during the loading and error states.
- Do not make whole rows the only clickable target or rely on hover to show actions. Do not add row-level tab stops beyond the explicit action.
- Do not use feature-specific CSS files or hard-coded colors for hover or status styling.
- Do not store unsaved form values, selection state, or dialog state in the URL.
- Do not silently change an unrecognized URL filter to another value.

## Open Questions and Follow-up

- **Pagination:** no grid paginates yet. When one does, extend the count line to show the visible range and the filtered and total counts (for example "Showing 1–50 of 240 matching · 1,200 total"). Record that in a follow-up ADR or amendment.
- **Empty states:** decide whether to show a different empty-state message when T is 0 ("No securities yet") than when filters hide everything.
- **Journal review table:** it uses `hover:bg-surface-emphasis`. Align it with this ADR the next time it changes.
- **Shared components:** consider extracting shared `DataGridStatus` and filter-bar components once a second grid adopts these behaviors.
