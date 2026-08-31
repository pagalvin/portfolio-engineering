# ADR 0006: Use Sunday-through-Saturday weeks

- Status: accepted
- Date: 2026-08-30
- Audience: [architect-agents, coding-agents, testing-agents, uxd, humans]

## Applicable When

- Creating or changing a feature that groups, queries, displays, exports, aggregates, or navigates calendar weeks.
- Defining an API, URL, persistence query, report, or scheduled behavior with a week-oriented scope.
- Sharing a calendar-week utility between frontend and backend code.
- Not applicable to an external provider contract that requires ISO weeks; isolate and explicitly translate that provider boundary.

## Context

- Product features use calendar weeks for Journal review and may use them for reports, learning, risk, tax, automation, and other future workflows.
- ISO week numbers use Monday-through-Sunday bounds and can assign dates near a year boundary to a different week-year.
- The product convention is that a week always runs from Sunday through Saturday.
- Feature-specific date arithmetic previously allowed an ISO-week implementation to conflict with the intended Journal week grouping.

## Decision Statement

Portfolio Engineering calendar weeks always start on Sunday and end on the following Saturday, inclusive. Identify a product week by its Sunday start date using `weekStart=YYYY-MM-DD`, never an ISO `YYYY-Www` identifier.

The local calendar date and timezone context applicable to the feature determine the week boundary. A week crossing a calendar-year boundary belongs to the year containing its Sunday start date.

## Do

- Use a valid Sunday `weekStart` calendar date as the canonical URL and API identifier for a product week.
- Resolve `weekStart` through the inclusive range `[weekStart, weekStart + 6 calendar days]`.
- Apply the feature's validated user or environment timezone before deriving a local calendar date or current week.
- Display Sunday-through-Saturday ranges in UI and use inclusive start/end dates in export metadata and filenames.
- Validate that `weekStart` is exactly one real calendar date and falls on Sunday; return a client validation error for missing, malformed, repeated, or non-Sunday values.
- Use shared, tested Sunday-through-Saturday utilities where they exist; otherwise add them at the owning shared boundary rather than duplicating date arithmetic across features.
- Test ordinary weeks, month boundaries, and cross-year boundaries such as Sunday 2025-12-28 through Saturday 2026-01-03.
- Document and isolate any translation to an external ISO-week contract at that integration boundary.

## Do Not

- Do not use ISO `YYYY-Www`, `getWeek`, ISO-week libraries, or Monday-through-Sunday calculations for product calendar-week behavior.
- Do not infer a week year from a date other than its Sunday start when naming, grouping, or exporting a cross-year week.
- Do not silently reinterpret a legacy ISO-week URL or API input as a Sunday-start week; reject it with actionable recovery guidance.
- Do not calculate week bounds from an API-server local timezone when the feature contract supplies a validated user or environment timezone.
- Do not create feature-specific week conventions or duplicate untested week-boundary logic.
