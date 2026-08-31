# Journal UX Flow & Contract – Plan 0001

- **Date:** 2026-08-30
- **Task:** T-01.1 (Designing Journal flows and states)
- **Owner:** uxd
- **Referenced ADRs:** [0002 (routing)](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003 (placeholder)](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004 (React Router)](../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005 (Tailwind/shadcn)](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md)

---

## Route Map & URL Contract

All Journal routes live under `/workspace/journal` and preserve timezone-aware date/scope context in the URL per [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) and [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md).

### Routes (URL-owned context)

| Route | Purpose | URL parameters | State ownership | Refresh/deep-link safety |
|-------|---------|---|---|---|
| `/workspace/journal` | Month view (current month, env timezone) | _(none)_ | Defaults to `mode=month&month=YYYY-MM` | Loads current month on any refresh |
| `/workspace/journal?mode=month&month=YYYY-MM` | Month view for a specific month | `mode=month`, `month` (YYYY-MM) | URL owns the month; client derives grouping from env timezone | Deep link loads exact month |
| `/workspace/journal?mode=week&weekStart=YYYY-MM-DD` | Week view for the Sunday beginning a specific Sunday–Saturday Week | `mode=week`, `weekStart` (valid Sunday calendar date) | URL owns the Week's actual Sunday start date; client derives its fixed seven calendar dates | Deep link loads exact Week |
| `/workspace/journal?mode=day&date=YYYY-MM-DD` | Day view for a specific date | `mode=day`, `date` (YYYY-MM-DD) | URL owns the date; interpreted in env timezone as a local calendar day | Deep link loads exact day |
| `/workspace/journal?mode=all&offset=N` | Entire journal review view (reverse chronological, paginated as needed) | `mode=all`; optional `offset` (non-negative result offset) | URL owns the result page when pagination is available | Deep link loads the same All-results page; omitted offset means the first page |

### URL state vs. component state

| Data | Owner | Rationale |
|------|-------|-----------|
| `mode` (day/week/month/all) | URL | Per ADR 0002: this is the primary navigation context and must survive refresh and back/forward |
| `date`, `month`, `weekStart`, `offset` (All only) | URL | Per ADR 0002: represents the user's current workflow location; must be deep-linkable and refresh-safe |
| Active content mode (Focus, Live preview, or Reading view) | Component | Ephemeral UI state; defaults to Focus; can change without affecting URL |
| Unsaved draft text | Component | Ephemeral; lost on navigation; not restored from URL |
| Open/expanded sections (export options, summary panel) | Component | Ephemeral UI; not critical to restore on refresh |
| Review-table multi-selection checkboxes (Week, Month, All) | Component | Ephemeral; only currently rendered rows may be selected. Clear selection when the URL scope or rendered All-results page changes; do not put selection in the URL or persist it. |
| Copy/download feedback toast | Component | Ephemeral notification; clears after action completes |
| Summary generation loading state | Component | Ephemeral; summary output is never persisted |

---

### Canonical Week identifier and validation

- **Canonical form:** `/workspace/journal?mode=week&weekStart=YYYY-MM-DD`. `weekStart` is the actual Sunday calendar date beginning the Week; the seven included dates are that Sunday through the following Saturday, inclusive.
- **No ISO mapping:** Journal does not use ISO `YYYY-Www` identifiers, ISO week-years, or Monday-Sunday Week semantics. `week=YYYY-Www` is a legacy, invalid query—not an alias—and must not be silently mapped because it cannot unambiguously represent the Sunday-Saturday product Week.
- **Cross-year semantics:** The identifier is always the Sunday date, even when Saturday falls in the following calendar year. For example, `weekStart=2025-12-28` identifies December 28, 2025 through January 3, 2026. There is no separate Week-year.
- **Current Week:** Determine today's `YYYY-MM-DD` in the reported environment timezone, then use the Sunday on or before that date as `weekStart`. Navigating to Week from another scope creates that exact canonical URL.
- **Display:** Show the complete inclusive range, for example, “Week of Sunday, December 28, 2025 – Saturday, January 3, 2026.” Do not display an ISO week number.
- **Validation:** A Week page URL permits only `mode=week` and one `weekStart`; a protected Week API request may additionally include its validated timezone. `weekStart` must be a real `YYYY-MM-DD` date and must fall on Sunday. Missing, repeated, malformed, non-Sunday, conflicting `date`/`month`/`offset`/legacy `week`, and legacy ISO Week parameters preserve the requested URL, show an actionable invalid-link state with an explicit “Open current Week” control, and do not issue a Week data request or select a substitute Week.
- **Continuity:** A valid direct link loads exactly its seven dates. Refresh and browser back/forward retain the literal canonical URL and reload the same Week. Previous/next Week controls add or subtract seven calendar days from `weekStart` and create a history entry; they do not renumber a Week.

---

## Core Workflows

### 1. Day View Workflow

**User goal:** Write and review a single day's journal entry.

**Primary flow:**
1. User lands on `/workspace/journal?mode=day&date=YYYY-MM-DD`
2. The primary current-day scope control is labelled **Today** and navigates to this route with the current environment-timezone date. A separate date chooser can navigate to the same route for any valid calendar date.
3. Page loads the entry for that date (or renders "no entry" state if empty)
4. User chooses Focus for distraction-free Markdown authoring, Live preview to edit beside a rendered Markdown view, or Reading view for rendered Markdown only. WYSIWYG editing is shown as a not-yet-implemented feature; media embedding is deferred to a dedicated future specification.
5. User saves; entry persists to backend
6. User navigates to a different date or scope via navigation controls or browser back/forward
7. Route updates, component unmounts, and a new date's data loads

**Key states:**

| State | Trigger | Display | User actions available |
|-------|---------|---------|---|
| **Loading** | Page load / date change | Skeleton loaders for entry container; navigation disabled | None (wait for load) |
| **No entry (empty day)** | GET returns no entry for the requested date | "No journal entry for [date]." with CTA button "Create entry" | Create entry (focuses editor), navigate to another date |
| **Choose date / start entry** | User uses the date chooser or an empty-review CTA | Valid `YYYY-MM-DD` date | Navigate to `/workspace/journal?mode=day&date=YYYY-MM-DD`; show the empty-day create state | Enter non-blank content and save, or navigate away |
| **Invalid or occupied date** | Invalid date input, or selected date already has an entry | Invalid date / existing record | Invalid input remains unsubmitted with an actionable error; an occupied date opens its existing Day entry | Correct the date, or view/edit existing entry |
| **Loaded (entry exists)** | GET returns an existing entry | Focus editor, side-by-side Live preview, or Reading view with all controls | Edit, save, move to another date, export, request summary (if ≥100 chars), view placeholders |
| **Editing (unsaved)** | User types in Focus or Live preview | Unsaved indicator (e.g., "Unsaved changes"); save button enabled for non-blank content | Continue typing, save, abandon (on navigation), switch content mode |
| **Saving** | User clicks save button | Disabled buttons; brief spinner; entry text read-only | None (wait for save) |
| **Save success** | Server returns 200 | Brief confirmation toast "Entry saved"; clear unsaved indicator | Normal editing or navigation |
| **Save error** | Server returns error (validation, auth, server fault) | Error toast with retry button; keep unsaved text in editor | Retry save, revise text, abandon |
| **Move-to-date conflict** | User attempts to move to a date already occupied by an entry | Validation error: "You already have an entry on [target-date]" | Cancel move, or choose a different target date |
| **Move success** | Move completes | Toast: "Entry moved to [target-date]"; navigate to the target date | Normal |
| **Export feedback (clipboard)** | User clicks "Copy to clipboard" | Toast: "Copied to clipboard" (brief, 2–3 seconds) | Continue working; dismiss toast |
| **Export feedback (download)** | User clicks "Download" | Browser download triggered; no toast (browser handles it) | Normal |
| **Export error** | Clipboard or download fails (rare; usually user policy) | Error toast: "Unable to copy/download (browser denied access)" | Try again; may need browser settings change |
| **Summary request** | User clicks "Generate summary" with ≥100 chars | Loading spinner replaces button; summary text empty | None (wait or cancel) |
| **Summary result** | API returns summary | Ephemeral summary text displayed in a collapsible panel; copy/download/save actions available | Copy summary, download summary, insert into entry, close panel |
| **Summary error** | API error or 100-char threshold not met | Error toast: "Unable to generate summary" or "Entry too short (min 100 characters)" | None (revise entry or try different date) |

---

### 2. Week View Workflow

**User goal:** Review all entries in a calendar week; optionally select and export a subset.

**Primary flow:**
1. User lands on `/workspace/journal?mode=week&weekStart=YYYY-MM-DD`
2. Page loads all entries for that week (Sunday–Saturday, env timezone)
3. Page displays a review table: row per available entry with entry date, preview text, selection checkbox, and an Actions-column **View** control
4. User may activate View to open its day view (navigates to `/workspace/journal?mode=day&date=YYYY-MM-DD`)
5. User may check boxes to select specific days
6. User clicks export (clipboard or download); selected rows are serialized and copied/downloaded
7. User can navigate to previous/next week or switch to month/all view

**Key states:**

| State | Trigger | Display | User actions |
|-------|---------|---------|---|
| **Loading** | Page load / week change | Table skeleton; nav controls disabled | None |
| **Empty week** | All days in the week lack entries | "No entries this week." with CTA to create one | Navigate to another week, or click to create entry for a specific day |
| **Partial week** (some days have entries) | Mix of populated and empty days | Available-entry rows include checkbox and View; empty-day CTA can start an entry for that date | Check boxes, View, create for an empty date, select and export |
| **Full week** | All 7 days have entries | Full table with 7 rows; each includes checkbox and View | Check boxes, View, select and export |
| **Multi-select enabled** | User checks one or more boxes | Checked boxes highlighted; action buttons (export) active | Select/deselect rows, export selection |
| **Export selected (clipboard)** | User clicks "Copy selected" with ≥1 row checked | Toast: "Copied [N] entries to clipboard" | Continue, navigate, or export all |
| **Export selected (download)** | User clicks "Download selected" with ≥1 row checked | Browser download; filename identifies the Sunday-to-Saturday range | Normal |
| **Export all week** | User clicks "Copy/Download entire week" (no selection required) | Toast for clipboard; filename for download | Normal |
| **Export empty selection** | User clicks export with no rows checked | Validation error: "Select at least one entry" | Check boxes and retry |

---

### 3. Month View Workflow

**User goal:** Get an overview of the month; navigate between months; view entries or select a subset for export.

**Primary flow:**
1. User lands on `/workspace/journal?mode=month&month=YYYY-MM` (or defaults to current month)
2. Page displays a review table or calendar/list with entry indicators. Each rendered entry row has a checkbox and an Actions-column **View** control.
3. View navigates to that day's view; an empty-day CTA navigates to the selected date's Day view to start an entry.
4. Clicking a week navigates to that week's view
5. Previous/next month buttons update the URL
6. User can export the entire month, or copy/download only checked rows, or switch to all-entry view

**Key states:**

| State | Trigger | Display | User actions |
|-------|---------|---------|---|
| **Loading** | Page load / month change | Grid skeleton | None |
| **Empty month** | No entries in the entire month | "No entries this month." with CTA | Navigate to another month or create entry for a specific day |
| **Entries loaded** | One or more entries in the month | Each review row has checkbox, preview, and View | View, select/deselect, copy/download selected or entire month |
| **Selection export** | One or more rows checked | Selection count and selected-only actions | Copy/download checked rows; export is blocked with actionable feedback when zero rows are checked |
| **Month export (clipboard)** | User clicks "Copy entire month" | Toast: "Copied month to clipboard" | Normal |
| **Month export (download)** | User clicks "Download entire month" | Browser download; filename: `journal-YYYY-MM.md` | Normal |

---

### 4. All-Entries View Workflow

**User goal:** See all journal entries in a review table; view an entry or export the entire journal or a selected subset.

**Primary flow:**
1. User lands on `/workspace/journal?mode=all`
2. Page loads the URL-addressed All-results page in reverse chronological order (newest first)
3. Each review-table row shows a checkbox, date, preview, and an Actions-column **View** control
4. View navigates to its day view
5. User can export the entire journal, copy/download checked rendered rows, or switch to date-scoped views

**Key states:**

| State | Trigger | Display | User actions |
|-------|---------|---------|---|
| **Loading** | Page load | List skeleton | None |
| **Empty journal** | No entries exist | "No entries yet. Create your first entry." with CTA to create | Navigate to day/week/month to create entry |
| **Entries loaded** | Entries retrieved | Reverse-chronological review table; pagination if needed | View entry, select rendered rows, export selected or all, navigate to scoped view |
| **Selection export** | One or more rendered rows checked | Selection count and selected-only actions | Copy/download checked rows; selection clears when the All-results URL page changes |
| **Export all (clipboard)** | User clicks "Copy entire journal" | Toast: "Copied entire journal to clipboard" | Normal |
| **Export all (download)** | User clicks "Download entire journal" | Browser download; filename: `journal-all.md` | Normal |

---

### Review-table selection and View contract

This contract applies to the Week, Month, and All views whenever they render entries in a review table.

- Each populated row includes one checkbox and Actions-column controls labelled **View**, **Copy**, and **Download**. View navigates to `/workspace/journal?mode=day&date=YYYY-MM-DD&contentMode=reading` for that row; it does not open an in-table detail pane or a separate entry route. Copy and Download export that one entry using the same canonical Day Markdown serialization and filename as Day export.
- A select-all checkbox affects only the rows currently rendered in that table. Empty rows and dates without entries are not selectable.
- When one or more rows are selected, icon-labelled “Copy N selected entries” and “Download N selected entries” controls appear beside the Today, Week, Month, and All scope controls. They operate on exactly the checked, currently rendered entries, in chronological order, and never fall back to exporting the full scope.
- With no checked rows, selected-export controls are absent. The review grid has no copy/download controls below it.
- Every row action includes an icon and retains an accessible label.
- If an entry disappears or authorization changes before selected export retrieval, do not export a partial or substituted set; show an actionable refresh-and-retry error.
- Selection is not URL-owned, persisted, shareable, or retained across a Week/Month/All scope change. In All, it also clears on an `offset` page change.
- Selected-export files retain the normal metadata and identify the source scope and selected dates. Clipboard and download use the same serialized content.

---

## Markdown authoring and preview

### Supported Markdown elements (canonical)

The system persists Markdown exactly as authored. The owned viewer renders standard Markdown and GFM tables/strikethrough for review without changing the saved or draft value:

- **Text:** Plain text, no restrictions
- **Emphasis:** `**bold**`, `*italic*`
- **Headings:** `# H1` through `###### H6`
- **Lists:** Unordered (`- item`), ordered (`1. item`), nested lists
- **Code:** Inline `` `code` ``, code blocks with `` ``` ``
- **Links:** `[text](url)`
- **Blockquotes:** `> quote`
- **Horizontal rule:** `---`
- **Tables:** Markdown table syntax (per spec: "preserve markdown tables for future extension")
- **Images/screenshots:** deferred; the viewer displays accessible image text and does not load image content.

### Raw HTML and unsupported Markdown

If a user pastes or imports an entry with raw HTML or custom Markdown:

- **In Markdown editor:** Display as-is; user can manually edit it.
- **In Preview:** Raw HTML is not rendered. Unsupported Markdown remains in the canonical Markdown source without transformation.
- **On export:** Always export the canonical Markdown unchanged.

### Switching content modes

- **Markdown → Preview:** Render the current Markdown draft or saved content without mutating it.
- **Preview → Markdown:** Return to the same editable Markdown source.
- **Save:** Persist Markdown only; Preview has no save mutation.

### WYSIWYG deferral

WYSIWYG editing is deferred and is presented through the shared placeholder. A future specification must activate it under ADRs 0007 and 0008; the current owned Markdown viewer remains replaceable independently of that decision.

---

## Placeholder Positioning & Messaging

Per [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), the Journal UI includes three intentionally visible, presentation-only placeholders. All use the shared `NotYetImplemented` component.

### Placement

1. **New Experiments panel**
   - Location: Day view, sidebar or collapsible section below the entry
   - Messaging: "New Experiments (coming soon) — Identify and track experimental trade ideas and outcomes."
   - Links: Portfolio Engineering subreddit (default)

2. **Rules Adherence panel**
   - Location: Day view, sidebar or collapsible section below the entry
   - Messaging: "Rules Adherence (coming soon) — Review compliance with your personal trading rules and journal patterns."
   - Links: Portfolio Engineering subreddit (default)

3. **Context Injection entry point**
   - Location: Summary request flow; button or link near the "Generate Summary" action
   - Messaging: "Add Context (coming soon) — Inject current portfolio state, positions, margin, and market data into AI analysis."
   - Links: Portfolio Engineering subreddit (default), optional GitHub issue link

### Implementation notes

- Placeholders **do not** call any backend APIs, AI services, or persistence operations
- Placeholders **do not** accept form input or pretend to store data
- Clicking a placeholder link navigates to the subreddit (external)
- Each placeholder is its own component instance (can be shown/hidden independently)

---

## Responsive Behavior

### Desktop (≥1024px)

- **Layout:** Multi-column layout
  - Left sidebar: Date navigation, month/week picker, or entry list
  - Main content: Entry editor or calendar/list view
  - Right sidebar (optional): Placeholder panels, summary results, export options
- **Editor width:** 600–800px (readable)
- **Controls:** Full-size buttons, dropdowns, keyboard shortcuts available
- **Navigation:** Breadcrumbs + sidebar navigation + keyboard arrows (←/→ for prev/next date)

### Tablet (640px–1023px)

- **Layout:** Two-column or single-column with collapsible panels
  - Top nav bar with date/month picker
  - Main content: Entry editor or week table
  - Bottom navigation: Previous/next, export controls
- **Editor width:** Adapt to viewport; use full width or constrain to ~90%
- **Controls:** Touch-friendly button sizing (min 44px height)
- **Navigation:** Hamburger menu for sidebar, swipe gestures optional

### Mobile (<640px)

- **Layout:** Single column
  - Top nav bar: Date (text) + hamburger menu
  - Main content: Entry editor or day/week summary
  - Bottom action bar: Save, export, summary, placeholders
- **Editor:** Full viewport width; scroll-friendly
- **Controls:** Large touch targets (min 48px height); modal-based pickers for date/month
- **Navigation:** Prev/next date buttons (large, thumb-accessible); date picker modal on tap
- **Export feedback:** Fullscreen or prominent toast (not small toast)

### Accessibility across all sizes

- **Keyboard navigation:** Tab through all controls; Enter to submit; Escape to close modals
- **Focus states:** Clear, visible focus outline (not removed)
- **Labels:** Every input has associated `<label>` or aria-label
- **Status announcements:** Summary generation, save feedback, export results announced via aria-live regions
- **Skip links:** Skip to main content, skip to entry editor
- **Color:** No status conveyed by color alone (e.g., "entry saved" is text + icon, not just green highlight)
- **Zoom:** Responsive design supports browser zoom up to 200%
- **Screen reader:** Entries, placeholders, and controls announced with semantic HTML and ARIA roles

---

## State Tables by Scope

### Day View State Table

| User action | Data loaded | Valid? | Display | Buttons enabled | Notes |
|---|---|---|---|---|---|
| Load `/workspace/journal?mode=day&date=YYYY-MM-DD` | Entry ≠ null | — | Entry text + controls | All | Normal editing |
| Load `/workspace/journal?mode=day&date=YYYY-MM-DD` | Entry = null (404) | — | "No entry" + create CTA | Create, navigate | Empty day state |
| User types in Markdown editor | Entry text | — | Live updating; unsaved indicator visible | Save, switch mode | Draft in-memory |
| User switches to Preview | Entry text | — | Rendered Markdown without editable controls | Switch to Markdown, export | Persisted/draft Markdown is unchanged |
| User saves entry | Entry text | Must be ≥1 char, valid Markdown | Spinner during save; then confirmation toast | Normal | Backend validates |
| Save fails (validation error) | Entry text | Invalid (e.g., >10000 chars) | Error toast + text kept in editor | Retry, revise | User corrects and retries |
| Save succeeds | Entry text | Valid | Toast + clear unsaved indicator | Normal | Entry persisted |
| User chooses a date / clicks "Create entry" | New date | Valid calendar date | Day URL for selected date; existing entry if occupied, otherwise empty create state | Enter content, save, or navigate | No blank entry is created |
| User clicks "Move to [date]" | New date | Valid calendar date | Modal picker or date input | None (disabled) during save | Prevents accidental moves |
| Move target already occupied | New date | Destination has entry | Error toast: "You already have an entry on [date]." | Move (retry with diff date) | Collision handling |
| Move succeeds | New date | Valid, not occupied | Navigate to new date's view | Normal | URL updates to new date |
| User clicks "Copy to clipboard" | Entry ≥1 char | — | Toast: "Copied" | Normal | Browser API handles write |
| Clipboard fails (browser policy) | Entry ≥1 char | — | Error toast | Retry | Rare; user may need permissions |
| User clicks "Download" | Entry ≥1 char | — | Browser download triggered (filename: `journal-YYYY-MM-DD.md`) | Normal | No toast (browser handles) |
| User clicks "Generate summary" | Entry ≥100 chars | Length check passes | Loading spinner; request sent to API | None (wait) | Summary panel opens |
| Summary generates successfully | API response | — | Ephemeral summary text displayed + copy/download/insert buttons | Copy, download, insert, close | Never persisted |
| Summary request fails | API error or threshold not met | — | Error toast | Retry, edit entry | User addresses error |

---

## Export Serialization Contract

### Exported Markdown format

All exports (day, week, month, all, selected-entries) use a deterministic, consistent Markdown structure:

```markdown
# Journal Export

**Scope:** [Day | Week | Month | All]  
**Date range:** [date] or [start-date to end-date]  
**Generated:** [ISO timestamp]  
**Week start:** [Sunday YYYY-MM-DD] _(Week exports only)_  
**Week end:** [Saturday YYYY-MM-DD] _(Week exports only)_  
**Week semantics:** sunday-through-saturday _(Week exports only)_  

---

## [Date as YYYY-MM-DD (Weekday)]

Entry content here (canonical Markdown).

---

## [Next date as YYYY-MM-DD (Weekday)]

Entry content here.

...
```

### Export filename conventions

| Scope | Filename |
|-------|----------|
| Single day | `journal-YYYY-MM-DD.md` |
| Single week | `journal-week-YYYY-MM-DD-to-YYYY-MM-DD.md` (e.g., `journal-week-2025-12-28-to-2026-01-03.md`) |
| Month | `journal-YYYY-MM.md` |
| All entries | `journal-all.md` |
| Selected entries from Week | `journal-week-YYYY-MM-DD-to-YYYY-MM-DD-selected.md` |
| Selected entries from Month | `journal-YYYY-MM-selected.md` |
| Selected entries from All | `journal-all-selected-YYYY-MM-DD-to-YYYY-MM-DD.md` |

### Parity guarantee

- Clipboard export and file download use the **same serializer**
- Copied Markdown matches downloaded Markdown content exactly (except filename delivery mechanism)
- Week, Month, and All review-table multi-selection filters the same way in both clipboard and download paths

---

## Implementation Mapping: React Router + shadcn/ui + Tailwind

### Route structure (React Router v7 declarative)

```
<BrowserRouter>
  <Routes>
    <Route path="/workspace/dashboard" element={<DashboardPage />} />
    ...existing scaffold routes...
    <Route path="/workspace/journal" element={<JournalLayout />}>
      <Route index element={<JournalMonthView />} />
      <Route path="?mode=day&date=..." element={<JournalDayView />} />
      <Route path="?mode=week&weekStart=..." element={<JournalWeekView />} />
      <Route path="?mode=month&month=..." element={<JournalMonthView />} />
      <Route path="?mode=all" element={<JournalAllView />} />
    </Route>
  </Routes>
</BrowserRouter>
```

### Component hierarchy

```
JournalLayout (shared header, nav, timezone display)
  ├─ JournalDayView (single-day editor + placeholders)
  ├─ JournalWeekView (review table + selector)
  ├─ JournalMonthView (review table/calendar + selector + nav)
  └─ JournalAllView (review table + selector + export)

Shared components:
  ├─ MarkdownViewer (owned rendered Markdown preview)
  ├─ ExportControls (clipboard, download buttons)
  ├─ SummaryPanel (loading, result, actions)
  ├─ PlaceholderPanel (NotYetImplemented for New Exp, Rules, Context)
  └─ DateNavigation (prev/next, date picker)
```

### Tailwind + shadcn/ui usage

- **Layout:** Use Tailwind grid/flex utilities + shadcn `Layout` if available
- **Form inputs:** Use shadcn `Input`, `Textarea`, `Button`, `Checkbox`
- **Modals/panels:** Use shadcn `Dialog`, `Popover`, `Sheet` (for drawer on mobile)
- **Tables:** Use shadcn `Table` (for week view) or custom Tailwind-styled table
- **Notifications:** Use custom toast or shadcn `Toast` (if available)
- **Color & spacing:** Follow the existing semantic tokens mapped to Tailwind theme
- **Responsive:** Use Tailwind breakpoints (`sm:`, `md:`, `lg:`) for mobile/tablet/desktop layouts

---

## Accessibility Checklist

- [ ] All buttons and links have descriptive labels (no "click here")
- [ ] Form inputs have associated labels or aria-labels
- [ ] Focus states are visible (outline, background change, or both)
- [ ] Tab order is logical (left-to-right, top-to-bottom)
- [ ] Keyboard shortcuts documented and intuitive (e.g., Ctrl+S to save)
- [ ] Status updates announced via aria-live regions (summary generated, entry saved, error)
- [ ] Images/icons have alt text (placeholders have descriptive names)
- [ ] Color is not the only way to convey meaning (combine with text/icon)
- [ ] Text is readable (min 16px font, sufficient contrast ≥4.5:1 for normal text)
- [ ] No content is hidden by default without a visible control to show it
- [ ] Browser zoom up to 200% does not break layout
- [ ] Placeholder text is not used as a label replacement
- [ ] Loading states are communicated (spinner + "Loading..." text)
- [ ] Error messages are clear and actionable (not just "Error")
- [ ] Modals are keyboard-escapable and trap focus
- [ ] Links to external sites (Reddit) have `target="_blank"` with rel="noopener noreferrer"

---

## Open Questions & Notes

1. **Timezone handling:** The spec says "environment timezone." T-01.1 assumes `Intl.DateTimeFormat().resolvedOptions().timeZone` captures the user's timezone; API validates received timezone on each request. Backend will confirm if timezone should be immutable (stored with entry) or dynamic (client-reported per request). A Week identifier itself is an already-normalized Sunday calendar date; it is not reinterpreted into a different Week when opened in another environment timezone.

2. **Draft recovery:** This flow does not include draft autosave or recovery. User's unsaved changes are lost on navigation. Clarify with product if autosave to browser IndexedDB is desired.

3. **Pagination / infinite scroll:** All-entries pagination uses the URL-owned non-negative `offset`; selection is deliberately limited to the currently rendered results and clears on offset change. Page-size configuration is not a user-facing URL concern.

4. **WYSIWYG library:** T-01.1 does not select a library. R-3 in the plan gates T-03.3 (frontend-coding) until this contract is finalized.

5. **Summary panel placement:** This flow suggests a collapsible panel; implementation may prefer an overlay, modal, or inline replacement. Frontend-coding will adjust based on responsive behavior testing.

6. **Placeholder interaction:** This flow marks placeholders as non-interactive presentation-only. No form submission, no backend requests. Frontend-coding will ensure no accidental API calls.

---

## Summary

This flow document defines the complete user journey for the Portfolio Journal MVP:

✓ Four primary views: day, week, month, all (with exact URL patterns)  
✓ URL-owned state ensures deep links, refresh, and back/forward work  
✓ All user-facing states and transitions documented  
✓ Markdown authoring and safe rendered-preview contract specified  
✓ Export serialization is deterministic and testable  
✓ Today, chosen-date creation, review-table View, and bounded Week/Month/All selection contracts are explicit  
✓ Three placeholders positioned and scoped (no backend calls)  
✓ Responsive behavior covers desktop, tablet, mobile  
✓ Accessibility checkpoints included  
✓ React Router v7 + shadcn/ui + Tailwind mapping provided  
✓ One canonical Sunday-start Week URL, validation, cross-year, display, history, and export contract provided  

**Current implementation follow-up:**  
- frontend-coding completes T-03.4 for Week/Month/All selected export.  
- frontend-coding completes T-03.6 for Today, chosen-date creation, View controls, and URL-owned All offset.  
