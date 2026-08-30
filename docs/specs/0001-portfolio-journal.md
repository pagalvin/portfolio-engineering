# Portfolio Journal

## Status

- Readiness: Ready for planning
- Owner: TBD
- Date: 2026-07-28

## Summary

Portfolio Journal is a private-by-default journaling feature for authenticated users to capture daily portfolio notes in markdown, review them by timezone-aware day/week/month groupings, request on-demand AI analysis, and copy structured journal content to the clipboard for external analysis.

## Business objective

Help users build a consistent review habit around portfolio decisions, outcomes, and next-step experimentation.

## Problem / opportunity

- Users need a durable place to record what happened each day and why.
- Reflection is more useful when journal content can be reviewed in time-based groupings.
- Users also want lightweight AI assistance for summarizing patterns and suggesting experiments, without introducing background automation yet.

## Desired outcomes

- Users can maintain a daily journal inside the product.
- Journal content is easy to author, review, and reuse outside the app.
- AI features add value through explicit user-triggered actions.
- The initial design supports private use now without blocking future organization-aware expansion.

## Scope

- Private journal experience for an authenticated user.
- Timezone-aware day-based journal organization with:
  - day views
  - week grouping using Sunday-Saturday weeks
  - month views based on calendar months
- Markdown as the canonical authoring and storage format.
- Two editing modes:
  - direct markdown authoring
  - a simple WYSIWYG editor that can be replaced later without changing the underlying markdown requirement
    - WYSIWYG shall support markdown-equivalent formatting: bold, italics, headings, and image/screenshot embedding
    - WYSIWYG shall not be a general-purpose HTML editor; output shall be constrained to markdown-safe content
    - WYSIWYG output shall be validated on save to ensure clean markdown round-tripping
- On-demand AI summary generation.
- On-demand AI "New experiments" analysis that suggests experiments based on journal content.
- On-demand AI "Rules adherence" analysis that evaluates journal content against the user's rules and reports whether the user followed them.
- Placeholder context injection for adding current portfolio state and related market/account context before AI analysis.
- Clipboard export for:
  - a day
  - a week
  - a month
  - the entire journal
  - selected weekly entries from a week table
- Rules adherence placeholder state with a clear not-yet-implemented message until the feature is implemented.
- Placeholder context injection entry point with a clear not-yet-implemented message until the richer capability exists.

## Non-goals

- Scheduled or automatic AI summaries.
- Shared journals, cross-user visibility, or organization collaboration workflows.
- A rich or deeply customized editor experience.
- Non-markdown storage formats.
- Implemented rules adherence detection or enforcement.
- External export formats beyond clipboard copy in this phase.

## Functional requirements

1. **Access and privacy**
   - The system shall allow an authenticated user to create, read, update, and review only their own journal content in this phase.
   - Journal content shall be private to the user by default.
   - The feature shall not require design choices that prevent future support for multi-user organizations.

2. **Journal structure and time grouping**
   - Journal data shall be organized by calendar day.
   - The system shall support reviewing journal content by day, by week, and by month.
   - Week groupings shall run Sunday through Saturday.
   - Month groupings shall follow calendar months.

3. **Authoring and storage**
   - Markdown shall be the canonical format for journal authoring, persistence, and reuse.
   - Users shall be able to author content directly in markdown.
   - Users shall also be able to author through a simple WYSIWYG editor.
   - The WYSIWYG option shall preserve markdown compatibility and remain easy to replace later.

4. **AI-assisted actions**
   - AI summaries shall be user-invoked only.
   - The system shall not generate summaries automatically on a schedule in this phase.
   - The system shall prevent users from triggering AI actions on empty or insufficient journal content (e.g., empty day, single sentence).
   - The system shall support a user-invoked "New experiments" action that analyzes selected journal content and returns suggested experiments to try.
   - The system shall support a user-invoked "Rules adherence" action that evaluates selected journal content against the user's rules.
   - The system shall provide a placeholder context-injection entry point for adding portfolio snapshot data such as margin utilization or excess, current positions, NAV, and related context before AI analysis.
   - AI actions shall operate on explicit user-selected journal content or time scope; they shall not run implicitly in the background.

5. **Rules adherence placeholder**
   - The journal experience shall include a Rules adherence area or entry point if exposed in the UI.
   - That area shall display a clear not-yet-implemented message.
   - The feature shall not imply that rules adherence analysis is active when it is not.

6. **Context injection placeholder**
   - The journal experience shall include a placeholder entry point for injecting current portfolio or market context into AI analysis.
   - That entry point shall be clearly labeled as planned but not yet implemented.
   - The placeholder shall communicate the intended future capability (portfolio snapshots, margin utilization, positions, NAV, and similar data).
   - The placeholder shall include a friendly invite to request prioritization by creating a GitHub issue at: https://github.com/pagalvin/portfolio-engineering/issues
   - The placeholder may also direct users to the Portfolio Engineering subreddit for community discussion: https://www.reddit.com/r/PortfolioEngineering/

7. **Clipboard export**
   - Users shall be able to copy journal content for a selected day, week, month, or the entire journal to the clipboard.
   - Users shall be able to select one or more weekly journal entries from a week table and copy only those selected entries to the clipboard.
   - Clipboard export shall include contextual metadata, including date headers and section labels where applicable.
   - Clipboard export shall be in markdown format by default, suitable for ingestion by large language models or external analysis tools.
   - Clipboard export shall preserve markdown tables and structured content in a format that remains useful for future extension to human-readable formats (e.g., HTML, formatted text).

8. **Navigation and state continuity**
   - Journal views shall be reachable through URL-addressable navigation consistent with existing workspace routing.
   - Refresh and browser back/forward behavior shall preserve the user's current journal location and meaningful view context.

## Constraints / applicable ADRs

- **Applicable ADR 0002 - URL-addressable routing with history-safe navigation**
  - Applies because Portfolio Journal introduces major feature views and time-based page context.
  - Day/week/month journal views must be route-addressable and refresh-safe.
- **Applicable ADR 0001 - Direct organization scoping for protected backend data access**
  - Applies as a product constraint for protected journal data in an organization-aware system.
  - Initial journal access is private to the authenticated user, but any protected backend handling must remain compatible with verified auth context and must not depend on client-supplied tenant scope.
- **Business constraints**
  - Markdown is required.
  - Scheduled AI summaries are out of scope.
  - Rules adherence remains a placeholder in this phase.
  - Context injection remains a placeholder in this phase.

## UX handoff context

- **Target users**
  - Authenticated individual users managing portfolios and reviewing trading or portfolio decisions.
- **User goals**
  - Record daily notes quickly.
  - Review journal content over time.
  - Generate summaries and experiment ideas on demand.
  - Copy structured journal content out of the app for external analysis.
- **Core workflow intent**
  - Navigate to a day/week/month journal view, author or review markdown-based content, optionally trigger AI analysis, and optionally copy the relevant journal scope to the clipboard.
- **Permissions and visibility rules**
  - Private to the current user by default.
  - No sharing or multi-user collaboration in this phase.
- **Content or terminology constraints**
  - Markdown is canonical.
  - Use day, week, month, journal, summary, and New experiments terminology consistently.
  - Rules adherence must be clearly marked as not yet implemented.
- **Known edge cases**
  - Empty day, week, or month states.
  - Weeks that span two calendar months.
  - Copy actions for empty periods.
  - AI actions attempted on empty or insufficient journal content.
  - Timezone-boundary behavior for entries near midnight or during timezone changes.
- **Business constraints**
  - Sunday-Saturday week grouping.
  - Calendar-month month views.
  - AI actions are on-demand only.
- **Success criteria**
  - Users can reliably record and retrieve daily journal content.
  - Users can review journal content by day/week/month without ambiguity.
  - Users can copy structured journal content with useful metadata.
  - AI actions are explicit, understandable, and bounded.
  - Time-based grouping is consistent with the configured timezone.

## Assumptions

- Portfolio Journal is available only to authenticated users.
- Journal date grouping uses the user's configured timezone unless a later product decision states otherwise.
- AI-generated output is advisory and does not automatically alter journal content.
- Clipboard export is intended for manual external analysis, not a formal file-export workflow.

## Open questions

- None at this time.

## Definition of done

- The business objective and private-by-default scope are reflected in the implemented feature.
- Journal content is organized by timezone-aware day boundaries and reviewable by Sunday-Saturday weeks and calendar months.
- Markdown is the canonical format across authoring, storage, and clipboard export.
- Users can author via markdown and a simple replaceable WYSIWYG editor.
- On-demand AI summary and New experiments actions are available.
- Rules adherence shows a clear not-yet-implemented message.
- Placeholder context injection is visible and clearly not yet implemented.
- Clipboard copy works for day, week, month, and entire journal scopes with metadata included.
- Applicable ADRs have been respected.
- UXD has sufficient product context to design the experience.

## Acceptance criteria

- An authenticated user can access only their own journal content.
- A user can create and edit journal content in markdown.
- A user can also edit journal content through a simple WYSIWYG experience supporting markdown-equivalent formatting (bold, italics, headings, images) without breaking markdown compatibility.
- WYSIWYG output is validated on save to ensure clean markdown round-tripping.
- Journal content is stored and organized by day using the configured timezone.
- The user can review journal content in day, week, and month groupings.
- Week views use Sunday-Saturday boundaries.
- Month views use calendar-month boundaries.
- The user cannot trigger AI summary, New experiments, or Rules adherence actions on empty or insufficient journal content; the UI prevents or gracefully declines the action.
- The user can explicitly trigger an AI summary for selected journal content with sufficient content.
- The user can explicitly trigger New experiments analysis for selected journal content and receive suggested experiments.
- The user can explicitly trigger Rules adherence for selected journal content and receive an assessment against their rules.
- No scheduled or automatic summary generation occurs.
- Rules adherence presents a clear not-yet-implemented message when the feature is not yet implemented.
- A placeholder context-injection entry point is available with a friendly message inviting users to request prioritization via GitHub issues or the subreddit.
- The user can copy a day, week, month, or entire journal to the clipboard in markdown format.
- The user can select weekly entries from a table and copy only the selected entries to the clipboard in markdown format.
- Copied content includes metadata such as date headers and section labels where applicable.
- Markdown tables and structured content are preserved in clipboard export for external analysis or LLM ingestion.
- Journal routes preserve location and context across refresh and browser back/forward navigation.
