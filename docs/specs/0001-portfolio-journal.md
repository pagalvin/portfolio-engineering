# Portfolio Journal

## Status

- Readiness: Ready for planning
- Owner: TBD
- Date: 2026-07-28

## Summary

Portfolio Journal is a private-by-default journaling feature for authenticated users to capture daily portfolio notes in Markdown, review them by timezone-aware day/week/month groupings, and export structured journal content for external analysis.

## Business objective

Help users build a consistent review habit around portfolio decisions, outcomes, and next-step experimentation.

## Problem / opportunity

- Users need a durable place to record what happened each day and why.
- Reflection is more useful when journal content can be reviewed in time-based groupings.
- Future AI assistance requires shared application infrastructure rather than a Journal-specific integration.

## Desired outcomes

- Users can maintain a daily journal inside the product.
- Journal content is easy to author, review, and reuse outside the app.
- The initial design supports private use now without blocking future organization-aware expansion.

## Scope

- Private journal experience for an authenticated user.
- Timezone-aware day-based journal organization with:
  - day views
  - week grouping using Sunday-Saturday weeks
  - month views based on calendar months
- Markdown as the canonical authoring and storage format.
- Direct Markdown authoring and a rendered Markdown preview behind an owned, replaceable viewer component.
- A WYSIWYG editor is deferred. It shall appear as the shared not-yet-implemented placeholder until a future specification enables it.
- A "New experiments" placeholder state with a clear not-yet-implemented message until the feature is implemented.
- A Rules adherence placeholder state with a clear not-yet-implemented message until the feature is implemented.
- Placeholder context injection for a future AI-assisted workflow.
- Clipboard export for:
  - a day
  - a week
  - a month
  - the entire journal
  - selected entries from a Week, Month, or All review table
- File download export for:
  - a day
  - a week
  - a month
  - the entire journal
  - selected entries from a Week, Month, or All review table
  - Markdown format with included metadata, suitable for user backup, analysis, and portability

## Non-goals

- AI summary generation and the shared provider, credential, data-handling, rate-limit, and error infrastructure it requires. These are deferred to a dedicated future cross-feature story and specification.
- Shared journals, cross-user visibility, or organization collaboration workflows.
- A rich or deeply customized editor experience.
- Non-markdown storage formats.
- Export formats or integrations other than clipboard copy and Markdown file download.
- Selection-based export outside the entries currently rendered in the active Week, Month, or All review table. Cross-page, cross-scope, saved, and shareable selections are out of scope.
- Image and screenshot embedding, media storage, and media lifecycle management. These are deferred to a dedicated future specification and plan.
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
   - A user shall be able to choose a valid calendar date and start a new entry for that date through the Day view, including from an empty Week, Month, or All review state. Starting the workflow shall navigate to the URL-owned Day view for that date; a record is created only when non-blank content is saved.
   - Users shall be able to move an existing journal entry to a different calendar date.
   - Day, week, and month grouping shall use the timezone reported by the user's environment.
   - The system shall support reviewing journal content by day, by week, and by month.
   - **Product instruction (verbatim): “all Journal weeks Sunday-Saturday.”** A Week location shall use the canonical URL form `/workspace/journal?mode=week&weekStart=YYYY-MM-DD`, where `weekStart` is the actual Sunday calendar date that begins the seven-day grouping. `YYYY-Www`, ISO week numbering, and Monday-Sunday semantics shall not be accepted or emitted for Journal Weeks.
   - A `weekStart` value shall be a valid `YYYY-MM-DD` calendar date whose weekday is Sunday. The Week contains that date through the following Saturday, inclusive. This date-based identifier has no separate week-year: a Week spanning New Year belongs to the Sunday date in its identifier (for example, `weekStart=2025-12-28` means Sunday, December 28, 2025 through Saturday, January 3, 2026).
   - The current Week shall be calculated from today's date in the user's reported environment timezone by finding the Sunday on or before that date. It shall emit that Sunday's `YYYY-MM-DD` value. Week display shall show the inclusive Sunday-to-Saturday range, including both years when applicable; it shall not display an ISO week number.
   - The Week page URL permits `mode=week` and one `weekStart` only. Conflicting scope parameters (`date`, `month`, `offset`, or legacy `week`) and repeated `mode` or `weekStart` are invalid. The protected Week API may additionally receive the validated request timezone, but shall reject the same conflicting or repeated scope parameters. Invalid input shall preserve the requested URL, show an actionable invalid-link state with an explicit control to open the current canonical Week, and shall not select a different Week. A valid canonical deep link loads exactly the identified seven dates. UI navigation may create a canonical current-Week link, but refresh and browser back/forward shall retain and reload the exact valid Week URL; they shall not recalculate it as a new current Week.
   - Month groupings shall follow calendar months.
   - The primary control that opens the current calendar-day scope shall be labelled **Today**. It shall navigate to `mode=day` with the current environment-timezone date; it does not create a second “Today” scope.
   - Each populated Week, Month, and All review table shall include an Actions column with a **View** control for every entry. View shall navigate to that entry's URL-owned Day view; it shall not expose entry content from any other user.

3. **Authoring and storage**
   - Markdown shall be the canonical format for journal authoring, persistence, and reuse.
   - Users shall be able to author content directly in markdown.
   - Users shall be able to preview their Markdown through an owned, replaceable viewer that does not alter persisted content.
   - WYSIWYG editing is deferred and shall use the shared not-yet-implemented placeholder.
4. **Planned-feature placeholders**
   - The journal experience shall include New experiments and Rules adherence areas or entry points.
   - Each area shall use the shared not-yet-implemented component required by ADR 0003.
   - Each placeholder shall clearly describe its planned capability and provide a community-prioritization call to action to the Portfolio Engineering subreddit.
   - Placeholders shall not imply that analysis is active or invoke AI, backend, persistence, or simulated-result behavior.

5. **Context injection placeholder**
   - The journal experience shall include a placeholder entry point for injecting current portfolio or market context into AI analysis.
   - That entry point shall use the shared not-yet-implemented component required by ADR 0003.
   - The placeholder shall communicate the intended future capability (portfolio snapshots, margin utilization, positions, NAV, and similar data).
   - The placeholder shall include a community-prioritization call to action to the Portfolio Engineering subreddit and may also link to GitHub issues.

6. **Clipboard export**
   - Users shall be able to copy journal content for a selected day, week, month, or the entire journal to the clipboard.
   - Users shall be able to select one or more entries with row checkboxes in each Week, Month, and All review table and copy only those selected entries to the clipboard.
   - Selection shall be limited to entries currently rendered in the active review table. It is transient UI state, is not included in the URL or persisted, and shall clear when the review scope or rendered All-results page changes.
   - A selection-only copy action with no selected entries shall not write to the clipboard and shall explain that at least one entry must be selected.
   - Clipboard export shall include contextual metadata, including date headers and section labels where applicable.
   - Clipboard export shall be in markdown format by default, suitable for ingestion by large language models or external analysis tools.
   - Clipboard export shall preserve markdown tables and structured content in a format that remains useful for future extension to human-readable formats (e.g., HTML, formatted text).

7. **File download export**
   - Users shall be able to download journal content for a selected day, week, month, or the entire journal as a file.
   - Users shall be able to select one or more entries with row checkboxes in each Week, Month, and All review table and download only those selected entries.
   - A selection-only download action with no selected entries shall not create a file and shall explain that at least one entry must be selected.
   - File download shall be in markdown format with included metadata (date headers, section labels, contextual markers).
   - Downloaded content shall be suitable for user backup, offline access, external analysis, and portability to other tools.
   - Downloaded files shall use descriptive naming based on scope and date range (e.g., `journal-2026-08-30.md`, `journal-week-2025-12-28-to-2026-01-03.md`, `journal-2026-08.md`). Week and selected-Week exports shall include both inclusive bounds rather than an ISO week number. Week export metadata shall include `week_start`, `week_end`, and `week_semantics: sunday-through-saturday`. Selection-only filenames shall identify both the source review scope and that the export is selected content.

8. **Navigation and state continuity**
   - Journal views shall be reachable through URL-addressable navigation consistent with existing workspace routing.
   - Refresh and browser back/forward behavior shall preserve the user's current journal location and meaningful view context.
   - `mode` and the applicable Day date, Week `weekStart`, Month value, or All-results offset shall be URL-owned. Checkboxes, copy/download feedback, editor mode, drafts, and selection-only export progress are transient component state.

## Constraints / applicable ADRs

- **Applicable ADR 0002 - URL-addressable routing with history-safe navigation**
  - Applies because Portfolio Journal introduces major feature views and time-based page context.
  - Day/week/month/all journal views and an All-view results offset must be route-addressable and refresh-safe; row selection remains ephemeral because it is not user location.
- **Applicable ADR 0001 - Direct organization scoping for protected backend data access**
  - Applies as a product constraint for protected journal data in an organization-aware system.
  - Initial journal access is private to the authenticated user, but any protected backend handling must remain compatible with verified auth context and must not depend on client-supplied tenant scope.
- **Applicable ADR 0003 - Use a shared placeholder for planned features**
  - Applies to the New experiments, Rules adherence, and context-injection entry points.
  - These planned capabilities must use the shared presentation-only placeholder and community-prioritization call to action; they must not invoke unavailable services or simulated behavior.
- **No additional ADR applies to the Week identifier.** The Sunday-start calendar-date identifier is a product/UX contract. ADRs 0002 and 0004 require that this meaningful location context remain URL-addressable and history-safe.
- **Business constraints**
  - Markdown is required.
  - AI integration is out of scope for this specification and must be delivered through the future shared AI story/specification.
  - New experiments remains a placeholder in this phase.
  - Rules adherence remains a placeholder in this phase.
  - Context injection remains a placeholder in this phase.
  - Image and screenshot embedding is deferred to a dedicated future specification and plan.

## UX handoff context

- **Target users**
  - Authenticated individual users managing portfolios and reviewing trading or portfolio decisions.
- **User goals**
  - Record daily notes quickly.
  - Review journal content over time.
  - Review content and see planned experiment and AI-assisted capabilities as future features.
  - Copy structured journal content out of the app for external analysis.
- **Core workflow intent**
  - Use Today to open the current Day view or choose a date to start an entry; review entries in Week, Month, or All tables; view an entry in its Day view; and copy/download either the current scope or checkbox-selected rendered entries.
- **Permissions and visibility rules**
  - Private to the current user by default.
  - No sharing or multi-user collaboration in this phase.
  - View and selection-only export operate only on entries already returned for the authenticated user's verified organization and user scope. The client does not supply or choose an organization or user scope.
- **Content or terminology constraints**
  - Markdown is canonical.
  - Label the primary current-day scope control **Today**. Use Day to describe the date-based view or grouping, not as the label for that control.
  - All Journal weeks are Sunday-Saturday. Refer to a Week by its Sunday start date and displayed Sunday-to-Saturday range; do not use ISO week terminology or `YYYY-Www`.
  - New experiments, Rules adherence, and context injection must be clearly marked as not yet implemented.
- **Known edge cases**
  - Empty day, week, or month states.
  - Weeks that span two calendar months.
  - Weeks that span calendar years: retain the Sunday `weekStart` identifier and display both year values when they differ.
  - A malformed, non-Sunday, repeated, or legacy ISO Week query: reject it with actionable validation rather than silently choosing another Week.
  - Copy actions for empty periods.
  - A selection-only copy or download is requested with no checked rows.
  - A selected entry becomes unavailable before export is retrieved.
  - An All-review page changes after entries are selected; the selection clears rather than applying to a different page.
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
  - Time-based grouping is consistent with the timezone reported by the user's environment.

## Assumptions

- Portfolio Journal is available only to authenticated users.
- Journal date grouping uses the timezone reported by the user's environment.
- Clipboard export is intended for manual external analysis, not a formal file-export workflow.
- Selection-only exports use only the checked entries visible in the active review table; selection does not survive a scope or All-results-page change.
- The canonical Week URL and query semantics above are an approved product decision, not an assumption.

## Open questions

- None for the Journal MVP. Shared AI integration decisions belong to the future dedicated cross-feature story and specification.

## Definition of done

- The business objective and private-by-default scope are reflected in the implemented feature.
- Journal content is organized by timezone-aware day boundaries and reviewable by Sunday-Saturday weeks and calendar months.
- Week routes, API retrieval, display, navigation, and Week export use the one approved Sunday-start `weekStart=YYYY-MM-DD` contract, including calendar-year boundaries.
- Markdown is the canonical format across authoring, storage, clipboard export, and file downloads.
- Users can author in Markdown and review it through a replaceable Markdown viewer.
- New experiments, Rules adherence, and context injection use clear shared not-yet-implemented placeholders with community-prioritization calls to action.
- Clipboard copy works for day, week, month, entire journal, and checkbox-selected Week, Month, and All entries with metadata included.
- File download works for day, week, month, entire journal, and checkbox-selected Week, Month, and All entries with metadata included.
- Today opens the environment-timezone current Day URL; users can choose another valid date and create a non-blank entry there.
- Every populated review-table row has a View control that opens its Day URL.
- Applicable ADRs have been respected.
- UXD has sufficient product context to design the experience.

## Acceptance criteria

- An authenticated user can access only their own journal content.
- A user can create and edit journal content in markdown.
- A user can preview journal content through a replaceable Markdown viewer without altering its persisted Markdown.
- WYSIWYG editing is visibly deferred through the shared not-yet-implemented placeholder.
- A user can have at most one journal entry per calendar date, and an empty date displays a no-journal-created state without a persisted blank entry.
- A user can choose a valid date, reach its Day URL, and start a new entry; no entry exists until non-blank Markdown is saved. Invalid dates are rejected without creating an entry, and an already occupied date opens its existing entry rather than creating a duplicate.
- A user can move a journal entry to another date when that date has no existing journal entry.
- Journal content is stored and organized by day using the timezone reported by the user's environment.
- The user can review journal content in day, week, and month groupings.
- The primary current-day scope control is labelled Today and navigates to the current environment-timezone Day URL.
- Week views use Sunday-Saturday boundaries.
- A canonical Week deep link uses `?mode=week&weekStart=<Sunday YYYY-MM-DD>`; refresh and browser history preserve that exact Week, and invalid or legacy ISO Week queries are rejected rather than remapped.
- Month views use calendar-month boundaries.
- AI summary generation and its shared supporting infrastructure are not implemented under this specification.
- New experiments, Rules adherence, and context injection each render the shared not-yet-implemented component with feature-specific planned-capability copy and a community-prioritization link to the subreddit.
- New experiments, Rules adherence, and context-injection placeholders do not invoke AI, backend, persistence, or simulated-result behavior.
- The user can copy a day, week, month, or entire journal to the clipboard in markdown format.
- The user can select entries with checkboxes in Week, Month, and All review tables and copy only the selected rendered entries to the clipboard in markdown format.
- The user can select entries with checkboxes in Week, Month, and All review tables and download only the selected rendered entries as a markdown file.
- A selection-only copy or download with no checked rows is blocked with an actionable message and does not copy or download the full scope.
- Review-table selection clears when the user changes review scope or All-results page and is never represented in the URL or persisted.
- Every populated Week, Month, and All review-table Actions column includes a View control that navigates to `/workspace/journal?mode=day&date=YYYY-MM-DD` for that row.
- Copied content includes metadata such as date headers and section labels where applicable.
- Markdown tables and structured content are preserved in clipboard export for external analysis or LLM ingestion.
- The user can download a day, week, month, or entire journal as a markdown file.
- Downloaded files include metadata such as date headers and section labels where applicable.
- Downloaded Week files use their Sunday-to-Saturday inclusive date range and Week metadata records both bounds and `week_semantics: sunday-through-saturday`.
- Downloaded content is suitable for backup, offline access, external analysis, and tool portability.
- Journal routes preserve mode, date/weekStart/month, and All-results offset across refresh and browser back/forward navigation.
