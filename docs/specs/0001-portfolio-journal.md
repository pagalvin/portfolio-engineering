# Portfolio Journal

## Status

- Readiness: Ready for planning
- Owner: TBD
- Date: 2026-07-28

## Summary

Portfolio Journal is a private-by-default journaling feature for authenticated users to capture daily portfolio notes in markdown, review them by timezone-aware day/week/month groupings, request ephemeral on-demand AI summaries, and export structured journal content for external analysis.

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
- Image and screenshot embedding, persisted as Base64 data in PostgreSQL, delivered incrementally after the core journal workflow; a database architect agent will define the detailed schema and storage constraints.
- On-demand AI summary generation.
  - Available for a day, week, month, entire journal, or selected weekly entries.
  - Summary output is ephemeral. Users may copy it to the clipboard, save it into a journal entry, or download it.
- A "New experiments" placeholder state with a clear not-yet-implemented message until the feature is implemented.
- A Rules adherence placeholder state with a clear not-yet-implemented message until the feature is implemented.
- Placeholder context injection for adding current portfolio state and related market/account context before AI analysis.
- Clipboard export for:
  - a day
  - a week
  - a month
  - the entire journal
  - selected weekly entries from a week table
- File download export for:
  - a day
  - a week
  - a month
  - the entire journal
  - selected weekly entries from a week table
  - Markdown format with included metadata, suitable for user backup, analysis, and portability

## Non-goals

- Scheduled or automatic AI summaries.
- Shared journals, cross-user visibility, or organization collaboration workflows.
- A rich or deeply customized editor experience.
- Non-markdown storage formats.
- Export formats or integrations other than clipboard copy and Markdown file download.
- Media storage approaches other than Base64 data persisted in PostgreSQL.
- Implemented New experiments analysis.
- Implemented rules adherence detection or enforcement.

## Functional requirements

1. **Access and privacy**
   - The system shall allow an authenticated user to create, read, update, and review only their own journal content in this phase.
   - Journal content shall be private to the user by default.
   - The feature shall not require design choices that prevent future support for multi-user organizations.

2. **Journal structure and time grouping**
   - Journal data shall be organized by calendar day.
   - A user shall have at most one journal entry for each calendar day.
   - An empty calendar day shall display a no-journal-created state rather than persist a blank entry.
   - Users shall be able to move an existing journal entry to a different calendar date.
   - Day, week, and month grouping shall use the timezone reported by the user's environment.
   - The system shall support reviewing journal content by day, by week, and by month.
   - Week groupings shall run Sunday through Saturday.
   - Month groupings shall follow calendar months.

3. **Authoring and storage**
   - Markdown shall be the canonical format for journal authoring, persistence, and reuse.
   - Users shall be able to author content directly in markdown.
   - Users shall also be able to author through a simple WYSIWYG editor.
   - The WYSIWYG option shall preserve markdown compatibility and remain easy to replace later.
   - Image and screenshot embedding shall be implemented incrementally after core journal authoring.
   - Embedded image and screenshot data shall be persisted as Base64 data in PostgreSQL; a database architect agent shall define the detailed storage schema and constraints.

4. **AI-assisted actions**
   - AI summaries shall be user-invoked only.
   - The system shall not generate summaries automatically on a schedule in this phase.
   - The system shall prevent users from triggering an AI summary when the selected content contains fewer than 100 characters.
   - AI summaries shall operate on explicit user-selected day, week, month, entire-journal, or selected-weekly-entry content; they shall not run implicitly in the background.
   - AI summary output shall be ephemeral and shall not automatically alter or persist to journal content.
   - Users shall be able to copy an AI summary to the clipboard, save it into a journal entry, or download it.

5. **Planned-feature placeholders**
   - The journal experience shall include New experiments and Rules adherence areas or entry points.
   - Each area shall use the shared not-yet-implemented component required by ADR 0003.
   - Each placeholder shall clearly describe its planned capability and provide a community-prioritization call to action to the Portfolio Engineering subreddit.
   - Placeholders shall not imply that analysis is active or invoke AI, backend, persistence, or simulated-result behavior.

6. **Context injection placeholder**
   - The journal experience shall include a placeholder entry point for injecting current portfolio or market context into AI analysis.
   - That entry point shall use the shared not-yet-implemented component required by ADR 0003.
   - The placeholder shall communicate the intended future capability (portfolio snapshots, margin utilization, positions, NAV, and similar data).
   - The placeholder shall include a community-prioritization call to action to the Portfolio Engineering subreddit and may also link to GitHub issues.

7. **Clipboard export**
   - Users shall be able to copy journal content for a selected day, week, month, or the entire journal to the clipboard.
   - Users shall be able to select one or more weekly journal entries from a week table and copy only those selected entries to the clipboard.
   - Clipboard export shall include contextual metadata, including date headers and section labels where applicable.
   - Clipboard export shall be in markdown format by default, suitable for ingestion by large language models or external analysis tools.
   - Clipboard export shall preserve markdown tables and structured content in a format that remains useful for future extension to human-readable formats (e.g., HTML, formatted text).

8. **File download export**
   - Users shall be able to download journal content for a selected day, week, month, or the entire journal as a file.
   - Users shall be able to select one or more weekly journal entries from a week table and download only the selected entries.
   - File download shall be in markdown format with included metadata (date headers, section labels, contextual markers).
   - Downloaded content shall be suitable for user backup, offline access, external analysis, and portability to other tools.
   - Downloaded files shall use descriptive naming based on scope and date range (e.g., `journal-2026-08-30.md`, `journal-week-2026-08-24.md`, `journal-2026-08.md`).

9. **Navigation and state continuity**
   - Journal views shall be reachable through URL-addressable navigation consistent with existing workspace routing.
   - Refresh and browser back/forward behavior shall preserve the user's current journal location and meaningful view context.

## Constraints / applicable ADRs

- **Applicable ADR 0002 - URL-addressable routing with history-safe navigation**
  - Applies because Portfolio Journal introduces major feature views and time-based page context.
  - Day/week/month journal views must be route-addressable and refresh-safe.
- **Applicable ADR 0001 - Direct organization scoping for protected backend data access**
  - Applies as a product constraint for protected journal data in an organization-aware system.
  - Initial journal access is private to the authenticated user, but any protected backend handling must remain compatible with verified auth context and must not depend on client-supplied tenant scope.
- **Applicable ADR 0003 - Use a shared placeholder for planned features**
  - Applies to the New experiments, Rules adherence, and context-injection entry points.
  - These planned capabilities must use the shared presentation-only placeholder and community-prioritization call to action; they must not invoke unavailable services or simulated behavior.
- **Business constraints**
  - Markdown is required.
  - Scheduled AI summaries are out of scope.
  - New experiments remains a placeholder in this phase.
  - Rules adherence remains a placeholder in this phase.
  - Context injection remains a placeholder in this phase.
  - Image and screenshot embedding is required but shall be delivered incrementally after core journal authoring.

## UX handoff context

- **Target users**
  - Authenticated individual users managing portfolios and reviewing trading or portfolio decisions.
- **User goals**
  - Record daily notes quickly.
  - Review journal content over time.
  - Generate summaries on demand and see planned experiment ideas as a future capability.
  - Copy structured journal content out of the app for external analysis.
- **Core workflow intent**
  - Navigate to a day/week/month journal view, author or review markdown-based content, optionally generate an AI summary for an eligible scope, and optionally copy or download the relevant journal scope.
- **Permissions and visibility rules**
  - Private to the current user by default.
  - No sharing or multi-user collaboration in this phase.
- **Content or terminology constraints**
  - Markdown is canonical.
  - Use day, week, month, journal, summary, and New experiments terminology consistently.
  - New experiments, Rules adherence, and context injection must be clearly marked as not yet implemented.
- **Known edge cases**
  - Empty day, week, or month states.
  - Weeks that span two calendar months.
  - Copy actions for empty periods.
  - AI summaries attempted with fewer than 100 characters of selected content.
  - Moving an entry to a date that already has a journal entry.
  - Timezone-boundary behavior for entries near midnight or during timezone changes.
- **Business constraints**
  - Sunday-Saturday week grouping.
  - Calendar-month month views.
  - AI summaries are on-demand only; New experiments and Rules adherence are planned-feature placeholders.
- **Success criteria**
  - Users can reliably record and retrieve daily journal content.
  - Users can review journal content by day/week/month without ambiguity.
  - Users can copy structured journal content with useful metadata.
  - AI actions are explicit, understandable, and bounded.
  - Time-based grouping is consistent with the timezone reported by the user's environment.

## Assumptions

- Portfolio Journal is available only to authenticated users.
- Journal date grouping uses the timezone reported by the user's environment.
- AI-generated output is advisory and does not automatically alter journal content.
- Clipboard export is intended for manual external analysis, not a formal file-export workflow.

## Open questions

- None at this time.

## Definition of done

- The business objective and private-by-default scope are reflected in the implemented feature.
- Journal content is organized by timezone-aware day boundaries and reviewable by Sunday-Saturday weeks and calendar months.
- Markdown is the canonical format across authoring, storage, clipboard export, and file downloads.
- Users can author via markdown and a simple replaceable WYSIWYG editor.
- Image and screenshot embedding is delivered incrementally and persists Base64 image data in PostgreSQL once implemented.
- On-demand AI summary is available.
- New experiments, Rules adherence, and context injection use clear shared not-yet-implemented placeholders with community-prioritization calls to action.
- Clipboard copy works for day, week, month, and entire journal scopes with metadata included.
- File download works for day, week, month, entire journal, and selected-weekly-entry scopes with metadata included.
- Applicable ADRs have been respected.
- UXD has sufficient product context to design the experience.

## Acceptance criteria

- An authenticated user can access only their own journal content.
- A user can create and edit journal content in markdown.
- A user can also edit journal content through a simple WYSIWYG experience supporting markdown-equivalent formatting (bold, italics, headings, images) without breaking markdown compatibility.
- WYSIWYG output is validated on save to ensure clean markdown round-tripping.
- A user can have at most one journal entry per calendar date, and an empty date displays a no-journal-created state without a persisted blank entry.
- A user can move a journal entry to another date when that date has no existing journal entry.
- Journal content is stored and organized by day using the timezone reported by the user's environment.
- The user can review journal content in day, week, and month groupings.
- Week views use Sunday-Saturday boundaries.
- Month views use calendar-month boundaries.
- The user cannot trigger an AI summary for selected content with fewer than 100 characters; the UI prevents or gracefully declines the action.
- The user can explicitly trigger an AI summary for a day, week, month, entire journal, or selected weekly entries with at least 100 characters of content.
- AI summaries are ephemeral, do not automatically change journal content, and can be copied, saved into a journal entry, or downloaded.
- No scheduled or automatic summary generation occurs.
- New experiments, Rules adherence, and context injection each render the shared not-yet-implemented component with feature-specific planned-capability copy and a community-prioritization link to the subreddit.
- New experiments, Rules adherence, and context-injection placeholders do not invoke AI, backend, persistence, or simulated-result behavior.
- The user can copy a day, week, month, or entire journal to the clipboard in markdown format.
- The user can select weekly entries from a table and copy only the selected entries to the clipboard in markdown format.
- Copied content includes metadata such as date headers and section labels where applicable.
- Markdown tables and structured content are preserved in clipboard export for external analysis or LLM ingestion.
- The user can download a day, week, month, or entire journal as a markdown file.
- The user can select weekly entries from a table and download only the selected entries as a markdown file.
- Downloaded files include metadata such as date headers and section labels where applicable.
- Downloaded files use descriptive naming based on scope and date range.
- Downloaded content is suitable for backup, offline access, external analysis, and tool portability.
- Journal routes preserve location and context across refresh and browser back/forward navigation.
