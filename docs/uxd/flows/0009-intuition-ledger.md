# Intuition Ledger UX Flow & Contract

- **Date:** 2026-09-27
- **Spec:** [0009-intuition-ledger](../../specs/0009-intuition-ledger.md). FR numbers below refer to this BRD.
- **Prototype:** [0009-intuition-ledger.html](../prototypes/0009-intuition-ledger.html) (static, illustrative only)
- **Referenced ADRs:**
  - [0001 (organization scoping)](../../ADRs/0001-organization-aware-data-access.md)
  - [0002 (URL-addressable routing)](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md)
  - [0003 (planned-feature placeholder)](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md)
  - [0004 (React Router)](../../ADRs/0004-use-react-router-for-frontend-navigation.md)
  - [0005 (Tailwind/shadcn)](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md)
  - [0006 (Sunday–Saturday weeks)](../../ADRs/0006-use-sunday-through-saturday-weeks.md)
  - [0012 (no WYSIWYG editor; direct Markdown authoring)](../../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md)
  - [0014 (profile backup/delete)](../../ADRs/0014-require-delete-backup-review-for-profile-related-data.md)
  - [0015 (help content)](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md)
  - [0016 (referenced-security deletion)](../../ADRs/0016-restrict-deletion-of-referenced-securities.md)
  - [0017 (data grid list behaviors)](../../ADRs/0017-standardize-data-grid-list-behaviors.md)
- **Navigation:** **Intuition Ledger** link in the **Learning** group, directly after Journal. The link shows the due count as text when any predictions are due (FR 36).

## UX Summary

The Intuition Ledger is a private workspace where a user records predictions, returns when they are due to record whether they came true, and reviews patterns in their accuracy and calibration.

The design is built around three moments:

1. **Capture:** a fast, sentence-style form: *I predict [MSFT] will [Rises] [1 %] by [End of week]*, then confidence and the price at prediction.
2. **Resolve:** a due queue where each prediction can be resolved in place, without leaving the page.
3. **Reflect:** a dashboard with neutral, descriptive stats and charts that each have a table alternative.

Honest measurement is protected by visible rules, not hidden penalties:

- a countdown during the 5-minute grace window
- confirmation before an edit marks a prediction **Amended**
- a visible result history when a result is changed

## User Jobs

1. Capture a prediction in the moment, with only the fields that matter for its type.
2. Know exactly what was predicted, including prices, even weeks later.
3. See what is due and record results quickly.
4. Correct a typo right after saving without penalty; understand the consequence of changing a claim later.
5. Retire a prediction that can't be fairly scored (Void) and, if wanted, remove it permanently.
6. Understand how often they are right, and whether their stated confidence matches reality.

## Route Map and URL Contract

All routes are React Router v7 declarative routes (ADR 0004). All views support deep links, refresh, and back/forward (ADR 0002).

| Route | Purpose | URL-owned state | Refresh/deep-link behavior |
| --- | --- | --- | --- |
| `/workspace/intuition-ledger` | Dashboard: summary, due preview, charts | `period` (`week`\|`month`; omitted = `week`), `amended` (`include`\|`exclude`; omitted = `include`) | Reloads the same period and Amended setting. |
| `/workspace/intuition-ledger/due` | Due-for-review queue | none | Reloads the current due list. |
| `/workspace/intuition-ledger/predictions` | Full list (grid) | `q`, `status`, `type`, `symbol`, `result`, `tag`, `amended` | Reloads the same search/filter result; back/forward restores prior filters. |
| `/workspace/intuition-ledger/predictions/new` | Create a prediction | optional validated `returnTo` | Opens a blank form. Unsaved input is not restored. |
| `/workspace/intuition-ledger/predictions/:predictionId` | Detail: claim, prices, outcome, amendment and result history, lifecycle actions | prediction ID in path; optional validated `returnTo` | Resolves only the current user's prediction; otherwise not found. |
| `/workspace/intuition-ledger/predictions/:predictionId/edit` | Edit a prediction | prediction ID in path; optional validated `returnTo` | Form renders only after the record loads. |

The dashboard, due queue, and list share a secondary tab row: **Overview**, **Due (N)**, and **All predictions**. **New prediction** is the primary action in the header of all three.

### Query parameter contract

- `status`: `active` (all except Void), `open`, `due`, `resolved`, `void`, `all`. Omitted means `active`, and the control shows **All except void** as selected. Choosing any other value writes it explicitly (ADR 0017).
- `type`: `direction`, `percent_move`, `target_price`, `event_reaction`, `freeform`.
- `symbol`: normalized symbol string. Matches both Security Master and Other predictions (FR 40).
- `result`: `correct`, `incorrect`.
- `tag`: a single tag string.
- `amended`:
  - On the list: `only` or `exclude`. Omitted means no filter.
  - On the dashboard: `include` or `exclude`, as defined in the route table.
- `returnTo`: same-origin Intuition Ledger URL (dashboard, due, or list with its query), validated against known paths and parameters. Never treated as an arbitrary redirect.
- Each parameter appears at most once. Unknown or repeated values produce an actionable invalid-filter state, and an unlisted `tag` or `symbol` value is shown as the labelled current option (ADR 0017).
- Filter edits use `replace` history. Opening a prediction, form, or tab pushes a history entry.

### URL state vs. component state

| Data | Owner | Rationale |
| --- | --- | --- |
| List search/filters, dashboard period, Amended toggle | URL query | Define what the user is looking at; must survive refresh and back/forward. |
| Prediction identity | URL path | Detail and edit are directly addressable. |
| Create/edit draft, derived predicted price/% preview | Component | Transient. Never in the URL. |
| Record-result dialog (open state, draft result, actual price, suggestion) | Component | Short task inside the due queue or detail; not a major view. |
| Amended confirmation, void/restore/delete dialogs | Component | Transient confirmation state. |
| Grace-window countdown display | Component (derived from server `createdAt`) | Advisory display; the server is authoritative (see API contract). |
| "View as table" toggle per chart | Component | Presentation preference within a page. |

## Information Architecture and Page Composition

### Dashboard (`/workspace/intuition-ledger`)

1. **Header:** "Intuition Ledger" (`text-2xl font-semibold`), a short one-line description, and the **New prediction** button.
2. **Summary tiles:** Open, Due, Resolved, Voided, and Hit rate.
   - Hit rate reads "62% (31 of 50 resolved)", or "Not available yet" when there's no data (FR 39).
   - Tiles are text-first. Due links to the due queue.
3. **Due preview:** up to 5 of the oldest due predictions, each with **Record result**, plus a "View all due" link. Hidden when nothing is due.
4. **Chart controls:** a **Period** segmented control (Week/Month) and an **Include Amended predictions** switch. Both are URL-owned.
5. **Charts:** a two-column grid on desktop, one column on mobile. Each chart is a Card with a title, a one-sentence plain-language description, the chart, a **View as table** toggle, and an empty state.
   - **Hit rate over time:** a line with points by week or month of resolution date. The tooltip and table show hit rate and n.
   - **Calibration:** grouped bars per confidence bucket.
     - Each bucket shows "Your stated confidence" (the bucket midpoint) and "Actual hit rate".
     - An "n = X" label sits under each bucket.
     - When any bucket has n < 5, a note appears above the chart: "Some confidence levels have fewer than 5 predictions, so their results aren't meaningful yet." Those buckets are also visually de-emphasized with a hatched pattern, not just a lighter color (FR 41).
   - **Results by type:** horizontal stacked bars of Correct and Incorrect per type, with the count and % as text labels.
   - **Results by symbol:** the same form for the top 10 symbols by resolved count. The table alternative lists all symbols (FR 40).
   - **Predicted vs. actual % change:** a scatter plot with a dashed diagonal reference line labelled "Predicted = actual". It only includes predictions with both a predicted and an actual price, and the caption states how many are included.
6. **Descriptive insight line** (optional, per chart). Use neutral patterns only (FR 46), such as "Your 90–100% predictions were correct 60% of the time (n = 10)."

### Due queue (`/due`)

- Rows are sorted by oldest deadline first.
- Each row shows the claim summary, the deadline ("Due since Fri, Oct 2"), confidence, and the price at prediction.
- Actions on each row: **Record result** (opens the record-result dialog in place) and **Open**.
- Resolving a row removes it from the queue with a polite announcement, "MSFT prediction recorded as Correct. 2 predictions still due.", and moves focus to the next row's **Record result** button, or to the heading if the queue is empty.
- Empty state: "Nothing is due. Predictions appear here after their deadline passes." with a **New prediction** action.

### Prediction list (`/predictions`)

Follows ADR 0017 exactly.

- **Filter row:** Search (widest), Status, Type, Result, Symbol, Tag, and Amended.
  - Wide desktop: one row. Tablet: two columns. Mobile: one column inside a labelled expandable filter section that shows how many filters are active.
- **Columns:** Subject, Claim, Deadline, Confidence, Status, Result, Flags (Amended / Result changed), and an explicit **View** action.
- **Claim cell:** a generated readable summary, for example "Rises 1.00% to 424.20 by Fri, Oct 2", or the claim text for Freeform.
- **Status and result cells:** text plus an icon (✓ Correct, ✗ Incorrect, ⏲ Due, ○ Open, ⊘ Void). Never color alone.
- **Count line:** "Showing N of T predictions" (T = all of the user's predictions, including void), announced politely.
- **Empty states:**
  - No predictions yet: "No predictions yet" with **New prediction**.
  - Nothing matches the filters: "No predictions match your filters" with **Clear filters**.

### Create / edit form

The form has a sentence-style primary section and a secondary section. Only fields relevant to the selected type are shown (progressive disclosure).

**Primary (always visible):**

1. **Prediction type:** a segmented control (Direction, Percent move, Target price, Event reaction, Freeform) with a one-line description of the selected type below it. It defaults to **Percent move**, the most common case, and changing type preserves compatible values.
2. **Subject:**
   - A security combobox listing active Security Master records ("MSFT — Microsoft Corp").
   - The last option is **Other symbol…**, which reveals a text input with suggestions from the user's past Other symbols.
   - For Freeform only, a **No security (topic)** option reveals a topic text input.
   - Inline match prompt (FR 6): when a normalized Other symbol matches an active Security Master symbol, a non-blocking inline message appears below the input: "MSFT is in your Security Master. [Use it]". It is announced politely once.
3. **Sentence row** (varies by type):

   | Type | Sentence |
   | --- | --- |
   | Direction | [Security] will [Rises ▾/Falls ▾] by [Deadline ▾] |
   | Percent move | [Security] will [Rises/Falls] [ _ %] by [Deadline] (or enter predicted price) |
   | Target price | [Security] will reach [ _ ] by [Deadline]. The direction is shown after the target is entered. |
   | Event reaction | [Security] will [Rises/Falls] on [event label] on [date]. Optional move size. |
   | Freeform | "I predict… [claim text]" by [Deadline] |

4. **Deadline control:** a segmented control (**End of today**, **End of week**, **End of month**, **Custom date**).
   - The resolved date always shows beside it: "End of week → Fri, Oct 2".
   - Custom date opens a date picker. A non-trading day shows a non-blocking hint: "Sat, Oct 3 isn't a trading day."
5. **Confidence:** a slider from 50 to 100 in steps of 1, paired with a numeric input. The value shows as text ("70%"). It defaults to 60%, and the helper text reads "How sure are you? 50% means a coin flip."

**Price section (measurable types only):**

- **Price at prediction** (required). Placeholder text: "Price now".
- **Captured at:** defaults to now and can be edited behind a "Change" link.
- **Move size (%)** or **Predicted price.** Whichever the user types is the source; the other is calculated and shown read-only with a "calculated" label. A small **Enter predicted price instead** link swaps which one is the source.
- **Live preview line** (`aria-live="polite"`, debounced): "Predicted price 424.20 (rises 1.00%)."
- No currency symbol anywhere. Inputs accept the locale decimal separator. Display uses `Intl.NumberFormat` with 2–4 fraction digits (FR 15).

**Reasoning (always visible, after Confidence):**

- A plain `Textarea` labelled **Why do you think this will happen? (optional)**, with helper text "Markdown formatting is supported." Visible by default on create and edit; never behind a disclosure (FR 11).
- About 4 rows tall, growing with content. The user types plain text or Markdown directly; there is no rich-text toolbar or WYSIWYG mode (ADR 0012). Saved exactly as typed.

**Secondary (collapsed "Add tags", expanded on edit if non-empty):**

- Tags use a chip input with suggestions from the user's past tags.

**Edit-only elements:**

- **Grace banner** (first 5 minutes after creation): "Claim edits won't mark this Amended for 4:12." Uses `role="timer"`, updates visually every second, and is not announced every tick. A single polite announcement fires when the window ends: "The grace period has ended. Claim changes will now mark this prediction Amended."
- **After the grace window,** a static notice: "Changing the claim (type, security, direction, prices, deadline, confidence) will mark this prediction Amended. Reasoning and tags can be changed without marking it Amended; reasoning edits are kept in its history."
- **Amended confirmation:** an AlertDialog on save. Title: "Mark as Amended?" The body lists the changed claim fields ("You changed: Deadline, Confidence") and explains "The original claim stays visible in the history." Buttons: **Save and mark Amended** or **Keep editing**.
- **Inactive current security:** shown as the labelled current value "ONDS (inactive)". It can't be re-selected once changed.

### Detail view (`/predictions/:id`)

- **Header:** the claim summary as a heading, plus status, result, and flags as text badges.
- **Actions:**
  - **Record result**, **Record Correct** before the deadline for Target price and Percent move goals that were reached, or the explanation "You can record a result after Fri, Oct 2" (FR 23).
  - **Edit** and **Void**.
  - When voided, **Restore** and **Delete permanently** replace Void.
- **Claim block:** label/value rows (same pattern as Security Master details): Security, Type, Direction, Price at prediction (captured at), Predicted price / %, Deadline, and Confidence.
- **Outcome block:** Result, Resolution date, Actual price and actual %, the suggestion that was shown, and outcome notes.
- **Reasoning:** a "Why I predicted this" section rendered with `MarkdownViewer`, placed directly after the claim block. When empty, show "No reasoning recorded." in secondary text. When the reasoning has been edited after the grace window, show "Reasoning edited on {date}" beneath it.
- **History** (disclosure sections, collapsed by default):
  - **Amendment history:** the original claim and each amendment, with timestamp and changed fields as before → after.
  - **Result history:** each change, for example "Oct 5: Incorrect → Correct", with a summary line "Result changed on Oct 5" visible when collapsed.
  - **Reasoning history:** the original reasoning and each later version with its timestamp, each rendered with `MarkdownViewer`, with a summary line "Reasoning edited on Oct 5" visible when collapsed (FR 19a).
- **Footer:** Created and Updated timestamps in secondary text.

### Record-result dialog

Opened from the due queue, the dashboard due preview, or the detail view.

1. **Actual price (optional):** helper text depends on type.
   - Target price: "Highest price reached (for a rising target)" or "Lowest price reached (for a falling target)".
   - Other measurable types: "Price when you judged the outcome".
2. **Suggestion line:** appears when an actual price is entered. Example: "Suggested: ✓ Correct. 425.10 is at or above the predicted 424.20."
   - If the user hasn't chosen a result yet, the suggestion pre-selects it with a visible "Suggested" label.
   - A later change to the price never overrides a result the user chose explicitly.
3. **Result:** a radio group: ✓ **Correct** / ✗ **Incorrect**.
   - Before the deadline, only Target price and Percent move predictions can open this dialog, and only **Correct** is enabled. **Incorrect** is disabled with "The deadline hasn't passed yet." Correct is labelled "Target reached" or "Goal reached" as appropriate.
4. **Resolution date:** defaults to the deadline, or today if earlier. It can't be before creation or after today (FR 24).
5. **Outcome notes** (optional, Markdown).
6. **Buttons:** **Save result** and **Cancel**.

When the prediction already has a result, the dialog title is "Change result". A note explains "The change will be recorded in this prediction's result history." A **Clear result** secondary action is also available.

## Core Workflows

### Create

1. The user selects **New prediction** from any Ledger tab.
2. They choose the type (or keep Percent move) and the security (or **Other symbol…**).
3. They complete the sentence row and choose a deadline preset, and the resolved date appears.
4. They set confidence.
5. For measurable types, they enter the price at prediction and then the move size or predicted price. The preview updates.
6. Optionally, they explain why in the reasoning field and add tags.
7. They save. On success, the app navigates to the new prediction's detail view with a polite "Prediction saved" status, and the grace banner is available from **Edit** for 5 minutes. On validation failure, the draft is kept and focus moves to the first invalid field.

### Resolve from the due queue

1. The user opens **Due (N)** from the nav link or tab.
2. They select **Record result** on a row.
3. Optionally, they enter an actual price, and a suggestion appears.
4. They confirm or choose a result, adjust the date, and save.
5. The row is removed, the result is announced, and focus moves to the next row.

### Edit within the grace window

1. The user opens **Edit**, and the grace banner counts down.
2. They change a claim field and save. It is not marked Amended.
3. If the window ends while they are editing, the notice changes, and saving a claim change triggers the Amended confirmation (the server is authoritative).

### Edit after the grace window

1. The user changes claim fields and selects **Save**.
2. The AlertDialog lists the changed fields.
   - **Save and mark Amended** saves, returns to the detail view, and shows the Amended badge and history.
   - **Keep editing** returns to the form with the draft intact and nothing saved.
3. Changing only reasoning or tags saves without a dialog. After the grace window, a reasoning change adds a reasoning-history entry, and the detail view shows "Reasoning edited on {date}".

### Change or clear a result

1. On the detail view, the user selects **Change result**.
2. They update or clear the result and save.
3. The result history gains an entry. If cleared, the status returns to Due or Open.

### Void, restore, delete

1. **Void:** a Dialog with an optional reason. "Voided predictions stay in your ledger but aren't counted in your stats. You can restore it later."
2. **Restore:** immediate, with a polite announcement. The prediction returns to its previous state.
3. **Delete permanently:** only available when voided. An AlertDialog names the prediction and says "This permanently deletes the prediction and its history. This can't be undone." The confirm button reads **Delete prediction**.
   - On success, the app returns to the list with its filters intact (`returnTo`).
   - If the server reports the prediction is not voided (stale state), the app shows "Void this prediction before deleting it" and changes nothing.

## State and Feedback Contract

| State | Trigger | User-visible behavior | Recovery/action |
| --- | --- | --- | --- |
| **Loading** (dashboard, list, due, detail, edit) | Route load or filter change | Accessible progress status; no empty state before data arrives; edit form renders only after load | Wait |
| **Empty ledger** | User has no predictions | Dashboard: "Your ledger is empty. Record a prediction to start measuring your intuition." with **New prediction**; charts hidden | Create |
| **Chart has no qualifying data** | No resolved non-void predictions (or none after Amended exclusion) | Card shows "Not enough resolved predictions yet" and, if the Amended toggle excluded data, "Amended predictions are excluded. [Include them]" | Resolve predictions or toggle |
| **Calibration sparse** | Any bucket n < 5 | Chart shown; note above; sparse buckets hatched and labelled with n | None required |
| **Nothing due** | Due count 0 | Due tab shows empty message; nav shows no count; dashboard hides due preview | Continue |
| **No filter matches** | List filters return 0 | "No predictions match your filters" plus **Clear filters**; count line retained | Clear/adjust filters |
| **Client validation** | Missing/invalid field | Field-level messages via `aria-invalid`/`aria-describedby`; focus first invalid field on submit | Correct input |
| **Validation messages** | Specific rules | "Enter a price greater than 0." "The target must be different from the price at prediction." "Enter a move size greater than 0." "Confidence must be between 50% and 100%." "Choose a deadline on or after today." "Choose a security, or pick Other symbol." | Correct input |
| **Non-trading custom date** | Weekend date chosen | Non-blocking hint beside the date | Optional change |
| **Other symbol matches Security Master** | Normalized match | Inline "MSFT is in your Security Master. [Use it]" | Accept or ignore |
| **Grace window active** | Edit within 5 min | Countdown banner | None |
| **Grace window ended mid-edit** | Timer reaches 0 | Single polite announcement; notice text changes | Continue; confirm on save |
| **Amended confirmation required** | Claim change after window (client-detected or server-returned) | AlertDialog listing changed fields | Confirm or keep editing |
| **Reasoning edited after window** | Reasoning-only change saved after 5 min | Saves without a dialog; polite "Prediction saved. Your earlier reasoning is kept in its history."; detail shows "Reasoning edited on {date}" | None |
| **Record before deadline** | Prediction is not a Target price or Percent move early Correct, or the user tries to record Incorrect before the deadline | Record action replaced with "You can record a result after {date}." or Incorrect disabled with "The deadline hasn't passed yet." | Wait or record Correct when eligible |
| **Save / record / void / restore / delete in progress** | Submitted | Buttons disabled against double submit; values kept visible | Wait |
| **Success** | Server confirmed | Polite status message; updated state shown | Continue |
| **Delete not allowed** | Server reports prediction not voided | "Void this prediction before deleting it." No change | Void first |
| **Not found** | ID missing or belongs to another user/org | Generic "Prediction not found"; never reveal that it exists for someone else | Back to ledger |
| **Invalid URL filters** | Unknown/repeated params | Actionable invalid-filter state; requested URL preserved | Clear invalid filter |
| **Permission/authentication failure** | Session expired or denied | Existing session-expiry flow; no data leakage | Reauthenticate |
| **Unexpected failure** | Unclassified API/network error | Explicit error alert with retry; drafts retained; never a success-shaped fallback or a 0% hit rate | Retry or leave intentionally |

## Content and Formatting Boundaries

- **Numbers:**
  - Prices display with 2–4 fraction digits and no currency symbol.
  - Percentages display with 2 fraction digits in claims and whole numbers in stats ("62%").
  - Parsing accepts the user's locale decimal and grouping separators. Anything ambiguous (for example, "1.234,5" in a period-decimal locale) is rejected with "Enter a number like 1234.56".
- **Symbols:** Other symbols are trimmed and uppercased on save. The input may show what the user typed until blur, then display the normalized value.
- **Markdown text** (reasoning and outcome notes) is typed directly into a plain `Textarea` and displayed with the existing `MarkdownViewer`, the same as Journal entries (ADR 0012). Text is stored exactly as typed; nothing is converted or normalized. ADR 0008 does not apply because there is no WYSIWYG mode.
- **Dates:** localized medium format with the weekday ("Fri, Oct 2"), in semantic `<time>` elements. Weeks are Sunday–Saturday for grouping.
- **Direction:** always shown as text plus an arrow icon ("▲ Rises", "▼ Falls"), in neutral text color (FR 45).

## API-Facing Workflow Contract

The BRD defines capability, not endpoints or storage. Backend planning owns endpoint names and persistence. All operations derive organization and user from verified auth context (ADR 0001). Predictions are visible only to their creator.

| User action | Required input | Expected success | Validation/conflict/failure feedback |
| --- | --- | --- | --- |
| Load security options | Verified session | The organization's **active** Security Master records only (may reuse the Security Master list with `status=active`) | Explicit error; never silently empty |
| Suggest Other symbols / tags | Partial text | The user's own previously used values, normalized, most recent first | Empty list is valid |
| Create prediction | Type, subject, direction (or derivable), move size or predicted/target price where required, deadline date, confidence, price at prediction + captured-at for measurable types, optional reasoning/tags | Stable ID; stored predicted price **and** %; server `createdAt` | Field-level errors mapped to form fields; direction derived server-side for Target price and predicted-price input |
| List predictions | Filters as in URL contract; user's local date for Due derivation | Matching predictions plus `totalCount` (all of the user's predictions) | Invalid filters are explicit; errors never become empty results |
| Due count | User's local date | Count of due predictions for nav and tabs | Failure hides the count without implying zero |
| Read prediction | ID | Prediction with claim, reasoning, outcome, amendment history, result history, reasoning history, server-authoritative `amended` flag and grace-window end time | Not-found for other users/orgs |
| Update prediction | ID, changed fields, and an explicit `confirmAmend` flag when saving claim changes after the grace window | Updated prediction; `amended` true if applicable; amendment-history entry for claim changes after the window; reasoning-history entry for reasoning changes after the window (no `confirmAmend` needed) | If claim fields changed after the window and `confirmAmend` is absent, return a distinct **amend-confirmation-required** result listing changed fields; nothing is saved |
| Record / change / clear result | ID, result or clear, resolution date, optional actual price and notes | Updated outcome; result-history entry for changes after the first record | Reject before deadline except Correct on Target price or Percent move ("deadline not passed"); reject resolution date outside creation–today |
| Void / restore | ID, optional reason (void) | Updated lifecycle state; restore returns the previous state | Explicit errors |
| Delete | ID | Prediction and its histories removed; security reference released | Distinct **not-voided** conflict; nothing changed |
| Dashboard stats | `period`, `amended` include/exclude, user's local date | Summary counts, hit rate with numerator/denominator, per-bucket calibration with n, per-type and per-symbol (normalized) results, scatter points | Explicit error; "not available" represented distinctly from 0 |

Additional contract notes:

- **Grace window:** the server is authoritative, based on its own `createdAt`. The client countdown is advisory.
- **Suggested result:** calculated client-side for immediacy, using the BRD rules. The server stores only the user's chosen result and may store the suggestion that was shown, for display on the detail view.
- **Security deletion:** the Security Master delete path must treat predictions (including voided) as references (ADR 0016, FR 48).
- **Profile lifecycle:** predictions, amendment history, result history, and reasoning history are included in profile backup and delete (ADR 0014, FR 47).

## Presentation-Only Placeholders

None are required. The quick-capture form must stay uncluttered, so do **not** add "Fetch price" or holiday-calendar placeholders to it. If a later iteration surfaces automatic price lookup (TD-020) or trading calendars (TD-021), use the shared `NotYetImplemented` component (ADR 0003). It must not call any API or simulate prices.

## Responsive Behavior

- **Desktop (≥1024px):**
  - Dashboard tiles in one row; charts in a 2-column grid.
  - List filters in one row.
  - Create form: the sentence row inline, with the price section in two columns.
  - The record-result dialog is centered.
- **Tablet (640–1023px):**
  - Tiles in 3 + 2 rows; charts in 1 column.
  - Filters in two columns.
  - The sentence row wraps into labelled groups.
- **Mobile (<640px):**
  - Tiles are 2-up.
  - Due and list rows become stacked cards with the claim summary first and actions in document flow.
  - The create form is a single column. The type segmented control scrolls horizontally with visible overflow cues, or becomes a native select.
  - The record-result dialog becomes a bottom Sheet that does not cover the focused field.
  - No fixed bars cover inputs.
- **Zoom and reflow:** supported to 200% and 320px width. Charts reflow and keep axis labels readable, and the table alternative is always available.

## Accessibility and Inclusion

- **Semantics:** semantic headings for each page and card; a `<table>` with headers for the list and every chart table alternative; label/value lists for details.
- **Charts** (shadcn/ui Chart on Recharts):
  - Enable `accessibilityLayer`.
  - Give each chart an accessible name and a description sentence.
  - Every chart has a **View as table** toggle, a real button with `aria-pressed`.
  - Tooltips are never the only source of values: counts and percentages appear as labels or in the table.
- **Color:**
  - Correct and Incorrect use a colorblind-safe pair (for example, the primary indigo and an amber/orange token), plus icons (✓/✗) and, in stacked bars, a pattern for Incorrect.
  - Do not use red/green for price direction or imply that rising is good.
  - Chart colors come from semantic chart tokens added to the theme (for example, `--chart-1`…`--chart-5` mapped to semantic tokens), not literal colors (ADR 0005).
- **Forms:**
  - Every control has a visible label.
  - The segmented controls are radio groups with arrow-key navigation.
  - The slider is paired with a numeric input.
  - The combobox follows the shadcn/ui Command/Popover accessible pattern, with the listbox announced and typeahead.
- **Announcements:**
  - Polite status messages for the preview line (debounced), saves, resolutions, void/restore, the due-queue progress, and the end of the grace window.
  - Assertive alerts only for blocking failures.
  - No per-second countdown announcements.
- **Dialogs:** focus is trapped; Escape cancels without saving; focus returns to the triggering control. The AlertDialog is used for Amended confirmation and permanent delete.
- **Plain language:** "Amended", "Void", and "Calibration" each have a nearby info tooltip or help link with a one-sentence explanation, for example "Calibration compares how sure you said you were with how often you were right."
- **Tone:** neutral and non-judgmental. No streaks, trophies, or "you're bad at…" copy. An Incorrect result is framed as information ("Recorded as Incorrect").
- **Numbers and dates:** locale-aware formatting and parsing; no currency symbol; weekday names come from `Intl`, not hard-coded English.

## Component Mapping (React + shadcn/ui + Tailwind)

| UI element | Components |
| --- | --- |
| Routing | Route-level pages for dashboard, due, list, new, detail, and edit under a shared `IntuitionLedgerLayout` with a tab row (React Router `NavLink`) |
| Summary tiles, chart cards | `Card` |
| Charts | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend` (added with `npx shadcn@latest add chart`); Recharts `LineChart`, `BarChart`, `ScatterChart` with `accessibilityLayer` |
| Chart table alternative | `Table` |
| Filters | `Input` (search), native `Select` for fixed-value filters (ADR 0017), `Switch` for the Amended toggle, `ToggleGroup` for Period |
| Security picker | `Popover` + `Command` combobox; Other-symbol `Input` with suggestion list |
| Type, direction, deadline presets | `ToggleGroup` (single) / `RadioGroup` |
| Confidence | `Slider` + `Input type="number"` |
| Custom date | `Popover` + `Calendar` with a Sunday week start |
| Notes (reasoning, outcome) | `Textarea` for direct Markdown input; existing `MarkdownViewer` for display (ADR 0012) |
| Tags | Chip input composed from `Badge` + `Input` |
| Record result | `Dialog` (desktop) / `Sheet` (mobile) |
| Amended confirmation, delete | `AlertDialog` |
| Void | `Dialog` with an optional reason `Textarea` |
| Status and flag badges | `Badge` with icon + text |
| Grace banner, notices | `Alert` |
| Histories | `Collapsible` or `Accordion` |

Follow ADR 0005: no new UI or chart library beyond shadcn/ui Chart and its Recharts dependency, and no feature-specific CSS files.

## Acceptance Checklist (UX)

- [ ] Every route deep-links, refreshes, and supports back/forward; filters, period, and the Amended toggle are in the URL.
- [ ] A Percent move prediction can be created with keyboard only, and the preview line is announced.
- [ ] The Other-symbol match prompt appears and does not block save.
- [ ] The countdown shows during the grace window, and a claim change after it opens the confirmation listing changed fields.
- [ ] Record result is unavailable before the deadline, except Correct for Target price and Percent move; Incorrect is disabled with the deadline message.
- [ ] The due queue resolves in place and moves focus to the next row.
- [ ] Result changes appear in the result history, with "Result changed on {date}" on the detail view.
- [ ] The reasoning text area is visible without expanding anything, is labelled "Why do you think this will happen? (optional)", and saves exactly what was typed; Markdown renders formatted on the detail view.
- [ ] A reasoning edit after the grace window adds a reasoning-history entry and "Reasoning edited on {date}", with no Amended badge.
- [ ] Every chart has a table alternative; calibration shows n and the sparse note.
- [ ] No red/green-only cues; direction is uncolored; no currency symbol.
- [ ] The nav due count is exposed as text to screen readers.
- [ ] Layout is usable at 320px width and 200% zoom.
- [ ] Usability-test targets: price-based capture in under 30 seconds; resolve without leaving the due queue.

## Open Questions

None. BRD open question 1 was resolved on 2026-09-27: Percent move allows an early Correct before the deadline.

## User Impact Assessment

- **Who benefits:**
  - Users who want fast capture and honest feedback.
  - Keyboard and screen-reader users, through table alternatives and announced previews.
  - Users outside the US, through no currency symbol, locale number input, and uncolored direction.
- **Who might be disadvantaged:**
  - Users near exchange holidays: presets may land on a market holiday until TD-021.
  - Users with few predictions: calibration is shown anyway, so they rely on the note.
  - Users who don't return: the due count helps, but there are no reminders yet.
- **Accessibility implications:**
  - The charts are the highest-risk element, mitigated by the table alternatives, `accessibilityLayer`, text labels, and patterns.
  - The countdown is a potential noise source, mitigated by `role="timer"` and a single end-of-window announcement.
- **Cross-cultural and comprehension risks:**
  - Red/green meaning, mitigated.
  - "Calibration", "Amended", and "Void" jargon, mitigated with inline explanations.
  - Locale decimal parsing, mitigated with strict rejection of ambiguous input.
- **Severity:** Low overall with the mitigations above. Medium for the holiday gap until TD-021, lessened by the resolved date always being shown and custom date being available.
- **Acceptable for end users:** Yes. The rules that protect honest measurement are visible and confirmed rather than hidden, and no core task depends on color, pointer input, or charts alone.
