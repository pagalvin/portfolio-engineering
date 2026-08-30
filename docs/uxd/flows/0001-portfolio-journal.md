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
| `/workspace/journal?mode=week&week=YYYY-Www` | Week view for a specific week (Sunday–Saturday) | `mode=week`, `week` (ISO 8601 week format) | URL owns the week; client derives Sunday–Saturday bounds in env timezone | Deep link loads exact week |
| `/workspace/journal?mode=day&date=YYYY-MM-DD` | Day view for a specific date | `mode=day`, `date` (YYYY-MM-DD) | URL owns the date; interpreted in env timezone as a local calendar day | Deep link loads exact day |
| `/workspace/journal?mode=all` | Entire journal view (all entries, reverse chronological) | `mode=all` | Fixed view; all entries in one scope | Deep link loads all entries |

### URL state vs. component state

| Data | Owner | Rationale |
|------|-------|-----------|
| `mode` (day/week/month/all) | URL | Per ADR 0002: this is the primary navigation context and must survive refresh and back/forward |
| `date`, `month`, `week` | URL | Per ADR 0002: represents the user's current workflow location; must be deep-linkable and refresh-safe |
| Active editor mode (Markdown vs. WYSIWYG) | Component | Ephemeral UI state; defaults to WYSIWYG; can change without affecting URL |
| Unsaved draft text | Component | Ephemeral; lost on navigation; not restored from URL |
| Open/expanded sections (export options, summary panel) | Component | Ephemeral UI; not critical to restore on refresh |
| Week multi-selection checkboxes | Component | Ephemeral; selection is live-only, not persisted |
| Copy/download feedback toast | Component | Ephemeral notification; clears after action completes |
| Summary generation loading state | Component | Ephemeral; summary output is never persisted |

---

## Core Workflows

### 1. Day View Workflow

**User goal:** Write and review a single day's journal entry.

**Primary flow:**
1. User lands on `/workspace/journal?mode=day&date=YYYY-MM-DD`
2. Page loads the entry for that date (or renders "no entry" state if empty)
3. User edits in either Markdown or WYSIWYG mode (toggle switches between them)
4. User saves; entry persists to backend
5. User navigates to a different date or scope via navigation controls or browser back/forward
6. Route updates, component unmounts, and a new date's data loads

**Key states:**

| State | Trigger | Display | User actions available |
|-------|---------|---------|---|
| **Loading** | Page load / date change | Skeleton loaders for entry container; navigation disabled | None (wait for load) |
| **No entry (empty day)** | GET returns 404 or null for the requested date | "No journal entry for [date]." with CTA button "Create entry" | Create entry (focuses editor), navigate to another date |
| **Loaded (entry exists)** | GET returns an existing entry | Full entry text (Markdown or WYSIWYG view) with all controls | Edit, save, move to another date, export, request summary (if ≥100 chars), view placeholders |
| **Editing (unsaved)** | User types in the editor | Unsaved indicator (e.g., "Unsaved changes"); save button enabled | Continue typing, save, abandon (on navigation), switch editor mode |
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
1. User lands on `/workspace/journal?mode=week&week=YYYY-Www`
2. Page loads all entries for that week (Sunday–Saturday, env timezone)
3. Page displays a table: row per day with entry date, preview text, selection checkbox
4. User may click a day row to open its day view (navigates to `/workspace/journal?mode=day&date=YYYY-MM-DD`)
5. User may check boxes to select specific days
6. User clicks export (clipboard or download); selected rows are serialized and copied/downloaded
7. User can navigate to previous/next week or switch to month/all view

**Key states:**

| State | Trigger | Display | User actions |
|-------|---------|---------|---|
| **Loading** | Page load / week change | Table skeleton; nav controls disabled | None |
| **Empty week** | All days in the week lack entries | "No entries this week." with CTA to create one | Navigate to another week, or click to create entry for a specific day |
| **Partial week** (some days have entries) | Mix of populated and empty days | Table rows for each day; empty-day rows show "—" or "(no entry)" | Check boxes, click rows to edit, select and export |
| **Full week** | All 7 days have entries | Full table with 7 rows | Check boxes, click rows to edit, select and export |
| **Multi-select enabled** | User checks one or more boxes | Checked boxes highlighted; action buttons (export) active | Select/deselect rows, export selection |
| **Export selected (clipboard)** | User clicks "Copy selected" with ≥1 row checked | Toast: "Copied [N] entries to clipboard" | Continue, navigate, or export all |
| **Export selected (download)** | User clicks "Download selected" with ≥1 row checked | Browser download; filename: `journal-week-YYYY-Www.md` | Normal |
| **Export all week** | User clicks "Copy/Download entire week" (no selection required) | Toast for clipboard; filename for download | Normal |
| **Export empty selection** | User clicks export with no rows checked | Validation error: "Select at least one entry" | Check boxes and retry |

---

### 3. Month View Workflow

**User goal:** Get an overview of the month; navigate between months; access day/week views.

**Primary flow:**
1. User lands on `/workspace/journal?mode=month&month=YYYY-MM` (or defaults to current month)
2. Page displays a calendar grid (or compact list) with entry indicators
3. Clicking a day navigates to that day's view
4. Clicking a week navigates to that week's view
5. Previous/next month buttons update the URL
6. User can export the entire month or switch to all-entry view

**Key states:**

| State | Trigger | Display | User actions |
|-------|---------|---------|---|
| **Loading** | Page load / month change | Grid skeleton | None |
| **Empty month** | No entries in the entire month | "No entries this month." with CTA | Navigate to another month or create entry for a specific day |
| **Partial month** | Some days have entries | Calendar view; days with entries highlighted or marked (e.g., bold date, colored background) | Click day to edit, click week to review, export month, navigate months |
| **Full month** | All calendar days have entries | Full calendar with all days marked | Same as partial month |
| **Month export (clipboard)** | User clicks "Copy entire month" | Toast: "Copied month to clipboard" | Normal |
| **Month export (download)** | User clicks "Download entire month" | Browser download; filename: `journal-YYYY-MM.md` | Normal |

---

### 4. All-Entries View Workflow

**User goal:** See all journal entries in one continuous list; review and export the entire journal.

**Primary flow:**
1. User lands on `/workspace/journal?mode=all`
2. Page loads all entries in reverse chronological order (newest first)
3. Each entry shows date, preview, and action buttons
4. Clicking an entry navigates to its day view
5. User can export the entire journal or switch to date-scoped views

**Key states:**

| State | Trigger | Display | User actions |
|-------|---------|---------|---|
| **Loading** | Page load | List skeleton | None |
| **Empty journal** | No entries exist | "No entries yet. Create your first entry." with CTA to create | Navigate to day/week/month to create entry |
| **Entries loaded** | Entries retrieved | Reverse-chronological list; infinite scroll or pagination | Click entry to edit, export all, navigate to scoped view |
| **Export all (clipboard)** | User clicks "Copy entire journal" | Toast: "Copied entire journal to clipboard" | Normal |
| **Export all (download)** | User clicks "Download entire journal" | Browser download; filename: `journal-all.md` | Normal |

---

## Content Round-Trip: Markdown & WYSIWYG

### Supported Markdown elements (canonical)

The system supports and round-trips these Markdown elements through both Markdown and WYSIWYG editors:

- **Text:** Plain text, no restrictions
- **Emphasis:** `**bold**`, `*italic*`
- **Headings:** `# H1`, `## H2`, `### H3` (most common; up to H6 allowed)
- **Lists:** Unordered (`- item`), ordered (`1. item`), nested lists
- **Code:** Inline `` `code` ``, code blocks with `` ``` ``
- **Links:** `[text](url)`
- **Blockquotes:** `> quote`
- **Horizontal rule:** `---`
- **Tables:** Markdown table syntax (per spec: "preserve markdown tables for future extension")
- **Images/screenshots:** `![alt text](data:image/...;base64,...)` (deferred to E-05; stub support in editor)

### Unsupported Markdown (fallback behavior)

If a user pastes or imports an entry with unsupported Markdown (e.g., raw HTML, custom syntax):

- **In Markdown editor:** Display as-is; user can manually clean it up
- **In WYSIWYG editor:** Render as plain text or code block (preserve the content; communicate that it's not editable in WYSIWYG mode)
- **On export:** Always export the canonical Markdown; WYSIWYG changes are round-tripped to Markdown

### Switching editor modes

- **Markdown → WYSIWYG:** Parse Markdown, render in rich editor; user sees rich formatting
- **WYSIWYG → Markdown:** Serialize back to Markdown; no loss of content (unless the WYSIWYG editor made unsupported changes)
- **Save from either mode:** Always persist as Markdown to the database

### Library selection note (R-3)

T-01.1 does **not** select a WYSIWYG library. T-03.3 (frontend-coding) will choose a library that:
- Outputs Markdown only (not HTML or proprietary formats)
- Supports bold, italic, headings, lists, code, links, blockquotes
- Provides a way to embed and reference Base64 images (for E-05)
- Allows round-tripping: Markdown → editor → Markdown with zero loss

Libraries like ProseMirror, TipTap, or react-md-editor are candidates; the final choice is backend by T-03.3 with UX sign-off.

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
| User switches to WYSIWYG editor | Entry text | Parses to rich editor | Rich editor with formatting controls | Save, switch mode | Markdown parsed |
| User saves entry | Entry text | Must be ≥1 char, valid Markdown | Spinner during save; then confirmation toast | Normal | Backend validates |
| Save fails (validation error) | Entry text | Invalid (e.g., >10000 chars) | Error toast + text kept in editor | Retry, revise | User corrects and retries |
| Save succeeds | Entry text | Valid | Toast + clear unsaved indicator | Normal | Entry persisted |
| User clicks "Move to [date]" | New date | Date must be after today or ≤ 365 days out | Modal picker or date input | None (disabled) during save | Prevents accidental moves |
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
| Single week | `journal-week-YYYY-Www.md` (e.g., `journal-week-2026-W35.md`) |
| Month | `journal-YYYY-MM.md` |
| All entries | `journal-all.md` |
| Selected entries (from week view) | `journal-week-YYYY-Www-selected.md` |

### Parity guarantee

- Clipboard export and file download use the **same serializer**
- Copied Markdown matches downloaded Markdown content exactly (except filename delivery mechanism)
- Weekly multi-selection filters the same way in both clipboard and download paths

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
      <Route path="?mode=week&week=..." element={<JournalWeekView />} />
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
  ├─ JournalWeekView (week table + selector)
  ├─ JournalMonthView (calendar or list + nav)
  └─ JournalAllView (infinite list + export)

Shared components:
  ├─ JournalEditor (Markdown + WYSIWYG modes)
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

1. **Week numbering:** Spec requires Sunday–Saturday weeks. This flow uses ISO 8601 week format (YYYY-Www) for URL clarity, but implementation may prefer local week numbers. Frontend-coding will confirm with backend team.

2. **Timezone handling:** The spec says "environment timezone." T-01.1 assumes `Intl.DateTimeFormat().resolvedOptions().timeZone` captures the user's timezone; API validates received timezone on each request. Backend will confirm if timezone should be immutable (stored with entry) or dynamic (client-reported per request).

3. **Draft recovery:** This flow does not include draft autosave or recovery. User's unsaved changes are lost on navigation. Clarify with product if autosave to browser IndexedDB is desired.

4. **Pagination / infinite scroll:** All-entries view may need pagination for journals with 1000+ entries. This flow assumes the backend supports limiting/offsetting. Frontend-coding will implement based on API capabilities.

5. **WYSIWYG library:** T-01.1 does not select a library. R-3 in the plan gates T-03.3 (frontend-coding) until this contract is finalized.

6. **Summary panel placement:** This flow suggests a collapsible panel; implementation may prefer an overlay, modal, or inline replacement. Frontend-coding will adjust based on responsive behavior testing.

7. **Placeholder interaction:** This flow marks placeholders as non-interactive presentation-only. No form submission, no backend requests. Frontend-coding will ensure no accidental API calls.

---

## Summary

This flow document defines the complete user journey for the Portfolio Journal MVP:

✓ Four primary views: day, week, month, all (with exact URL patterns)  
✓ URL-owned state ensures deep links, refresh, and back/forward work  
✓ All user-facing states and transitions documented  
✓ Markdown↔WYSIWYG round-trip contract specified  
✓ Export serialization is deterministic and testable  
✓ Three placeholders positioned and scoped (no backend calls)  
✓ Responsive behavior covers desktop, tablet, mobile  
✓ Accessibility checkpoints included  
✓ React Router v7 + shadcn/ui + Tailwind mapping provided  

**Next steps:**  
- uxd completes T-01.2 (scaffold reconciliation) after frontend team reviews this flow  
- frontend-coding uses this contract to build T-03.1 (router migration) and T-03.3 (UI implementation)  
- backend-coding uses the state tables and API contract to implement T-02.3 (protected routes)  
