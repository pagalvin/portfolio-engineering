# Security Master UX Flow & Contract

- **Date:** 2026-09-26
- **Spec:** [0008-organization-security-master](../../specs/0008-organization-security-master.md)
- **Referenced ADRs:** [0001 (organization scoping)](../../ADRs/0001-organization-aware-data-access.md), [0002 (URL-addressable routing)](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003 (planned-feature placeholder)](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004 (React Router)](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005 (Tailwind/shadcn)](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [0016 (referenced-security deletion)](../../ADRs/0016-restrict-deletion-of-referenced-securities.md), [0017 (data grid list behaviors)](../../ADRs/0017-standardize-data-grid-list-behaviors.md)
- **Initial navigation:** Flat **Security Master** link under **System**. A future navigation refinement may group it under **System → Master Data → Securities**.

## UX Summary

The Security Master is an organization-level workspace where any organization member can browse, find, create, inspect, edit, deactivate, reactivate, and safely delete securities. A security represents a listed instrument. The stable record identity, rather than its symbol or display fields, is what future P/OS features should reference.

The destructive action is deliberately distinct from deactivation. An unreferenced record can be permanently deleted after confirmation. If another business record references it, deletion is rejected and the user is told that it is in use; they can still deactivate it. Deletion must never remove dependent business records.

Sector and industry are optional free-text fields entered and edited by the user. AI classification suggestions and related provider integration are deferred to a future phase; do not add AI controls or service calls to this implementation.

The Security Master is implemented as an in-progress working route. It supports manual entry and maintenance of securities; AI classification suggestions and related provider integration remain deferred.

## User Jobs

1. Find and review securities owned by the current organization.
2. Add a security with only its symbol, filling other details now or later.
3. Enter or correct optional free-text sector and industry classifications.
4. Correct details or classifications, including on inactive records.
5. Stop using a security without losing its record by deactivating it; reactivate it if needed.
6. Permanently remove an unreferenced record while understanding why an in-use record cannot be deleted.
7. Know that the list and all actions are limited to the current organization.

## Route Map and URL Contract

The implemented route contract is below. It follows React Router v7 declarative routing and URL/history requirements in ADRs 0002 and 0004.

| Route | Purpose | URL-owned state | Refresh/deep-link behavior |
| --- | --- | --- | --- |
| `/workspace/security-master` | Organization's searchable Security Master list | `q`, `status`, `type`, `exchange` query parameters; omitted filters mean no filter, except `status`, which defaults to `active` | Reloads the same search/filter result. Browser back/forward restores prior list filters. |
| `/workspace/security-master/new` | Create a security | Route identifies create workflow; optional validated `returnTo` query carries the originating list URL; no unsaved values in URL | Direct load opens a blank form. Refresh does not restore unsaved input. Invalid `returnTo` is ignored and falls back to the list. |
| `/workspace/security-master/:securityId` | View a security's details and lifecycle state | Stable security ID in path; optional `returnTo` query carries the originating list URL | Direct load resolves that record within the authenticated organization. Invalid `returnTo` is ignored and falls back to the list. |
| `/workspace/security-master/:securityId/edit` | Edit a security | Stable security ID in path; optional `returnTo` query carries the originating list URL | Direct load resolves that record within the authenticated organization. Invalid `returnTo` is ignored and falls back to the list. |

Query parameter contract:

- `q`: optional search text, matching symbol or name.
- `status`: `all`, `active`, or `inactive`; omitted means `active`. Choosing **All** writes `status=all` so the selection survives refresh and back/forward.
- `type`: optional one of `STOCK`, `ETF`, `INDEX`, or `OTHER`.
- `exchange`: optional exchange filter; value is an exchange string.
- `returnTo`: optional, URL-encoded same-origin Security Master list URL, allowed on create, detail, and edit routes. It preserves search and filter context after create save/cancel, edit save/cancel, delete, or an explicit return action. Validate it against the known list path and supported query parameters; never treat it as an arbitrary redirect.
- Each parameter may appear at most once. Unknown values, repeated parameters, or malformed URL state must produce an actionable invalid-filter state without silently changing to a different selection.
- Search and filter changes update the URL. Preserve other valid filters when one control changes. Use history behavior that keeps navigation predictable: filter edits may replace the current list entry; meaningful navigation to a record or form creates a history entry.
- The URL must not contain unsaved form values, AI prompts/responses, delete confirmation state, or other private/transient UI state.

### URL state vs. component state

| Data | Owner | Rationale |
| --- | --- | --- |
| Search text and list filters | URL query | They define which records the user is browsing and should survive refresh/back/forward. |
| Security identity | URL path | A record detail/edit view must be directly addressable and reloadable. |
| Unsaved create/edit fields | Component | Draft form data is transient and is not written to the URL. |
| Delete confirmation dialog and in-flight action | Component | Temporary confirmation/action state. |
| Toasts, validation messages, expanded optional sections | Component | Ephemeral interaction feedback. |

## Information Architecture and Page Composition

### List

- Page title: **Security Master**
- Use a moderate page-title size that establishes hierarchy without dominating the list and filters.
- Primary action: **Add security**
- Search field: **Search by symbol or name**
- Filters: **Status** (All, Active, Inactive), **Type**, and **Exchange**. Place search and all three filters on one row at wide desktop widths; allow them to wrap into two columns on tablet and a single column on narrow mobile.
- Exchange list filter is a native dropdown with **All exchanges**, the fixed exchange choices (NYSE, NASDAQ, AMEX, LSE, TSX, Other), and a clearly labelled current option if a URL filter contains an older/unlisted exchange. Keep the URL query value and API filter string unchanged.
- Results table columns: Symbol, Name, Type, Exchange, Sector, Industry, Status, and an accessible row action to open details.
- Give each result row a subtle background hover highlight to help users track across columns; keep the explicit View action and do not rely on hover as the only way to identify or open a row.
- Status must be conveyed with text, not color alone.
- Show a count only if it comes from actual result data.
- Below the grid (and in the no-results state), show a muted status line: **Showing _N_ of _T_ securities**, where _N_ is the number of rows returned by the current search/filters and _T_ is the organization's total securities regardless of filters (active and inactive). Expose it as a polite status so screen-reader users hear the updated result count after filter changes.
- Distinguish empty organization and filtered-zero states. When _T_ = 0, show **No securities yet** with **Add security**. When _T_ > 0 and filters return no rows, show **No securities match your filters** with a **Clear filters** action. Both states keep the **Showing _N_ of _T_ securities** line.
- **Add security** carries the validated list `returnTo` so create save/cancel preserve the user's list search and filter context.
- Allow horizontal overflow or a responsive alternative for the table; do not truncate the symbol or make row actions unreachable.

### Details

- Show the header as **Symbol - Name - Active/Inactive** on one line where space allows, with the symbol, name, and current lifecycle status in that order. Allow natural wrapping on narrow screens rather than clipping or shrinking text.
- Present each security field in a compact two-column label/value row: bold, high-contrast labels in a fixed-width first column and values in the second. Keep the label/value gap narrow, allow long content to wrap without horizontal overflow, and use a subtle background hover highlight to help track a row. Rows are read-only, not interactive controls; do not imply clickability or add keyboard focus stops.
- Show all available fields, including blank optional fields in a clear, consistent way. Keep the description in the value column and preserve line breaks exactly as entered; do not collapse it into a single paragraph.
- Show active/inactive state as text.
- Provide **Edit**, **Deactivate** or **Reactivate**, and **Delete** actions, subject to loading and action state.
- Provide an explicit **Back to Security Master** link. When navigating from the list, include its validated URL as `returnTo` on detail/edit links; preserve that list URL after save, delete, or return. Direct detail links and invalid `returnTo` values return to the unfiltered list.
- Place **Created** and **Updated** timestamps together at the bottom of the detail content, visually secondary in a smaller readable font. Use the established localized date/time format and semantic `<time>` elements. Do not mix audit metadata into the primary field list.
- Keep the symbol/name heading and primary actions easy to find before the details. On narrow screens, let the actions wrap naturally without obscuring the heading or detail content.

### Create/edit form

- Symbol is the only required field.
- Type, name, description, exchange, sector, and industry are optional according to the BRD.
- Type values are `STOCK`, `ETF`, `INDEX`, and `OTHER`.
- **Exchange uses a native closed dropdown/select**, labelled **Exchange (optional)**. Choices are blank (No exchange), NYSE, NASDAQ, AMEX, LSE, TSX, and Other. These initial choices are not a complete, official, licensed, or authoritative exchange catalog.
- Users cannot type or add arbitrary exchange values. “Other” is a literal selectable value and does not open a custom entry field or create/reference an exchange entity.
- Exchange remains an optional string/null field at the API boundary, not an exchange ID or master-data reference. Blank selection continues to persist as no exchange. Do not invent a default exchange.
- Use the native select's standard keyboard behavior, including Arrow Up/Down to move through choices and type-to-select where supported by the browser. Provide an explicit associated label and visible focus indication; do not add custom combobox/listbox semantics to the native select.
- If an existing record has a nonblank exchange value that is not one of the dropdown choices, preserve it when editing: include that current value as a clearly labelled legacy/current option until the user chooses one of the fixed options. Do not silently clear or rewrite it. New records cannot enter an arbitrary value.
- Sector and industry are optional free-text fields. Use editable text inputs; do not add controlled-value vocabularies or embed or imply a licensed GICS taxonomy.
- Include save and cancel actions. Canceling with unsaved changes requires a clear discard confirmation; retain form data if the user chooses to continue editing.
- On edit, render the form only after the record loads. Show a distinct loading status while loading, and if the load fails, show an alert with retry and back actions rather than editable stale values.
- Validation errors are associated with their field using `aria-invalid`/`aria-describedby` and a visible message, and focus moves to the first invalid field after failed submit. Duplicate-identity errors are associated with Symbol and Exchange, preserve the draft, and explain the conflict.
- On edit, active/inactive lifecycle controls are available independently of editing classification fields.

## Core Workflows

### Browse, search, and open

1. An authenticated organization member opens `/workspace/security-master`.
2. The application loads only records belonging to the organization in verified session context.
3. User searches by symbol or name and optionally filters by status, type, and exchange. The URL reflects the selected list context.
4. User opens a result to `/workspace/security-master/:securityId`.
5. User inspects details, then chooses Edit, Deactivate/Reactivate, or Delete.
6. After editing an existing security, both successful save and cancel return to that security's read-only detail route. Preserve the validated originating list URL as `returnTo` on the detail route so the user can still navigate back to their prior search/filter context.

### Create and edit

1. User selects **Add security** or **Edit**.
2. A new-security form starts with every field blank/unselected; prior form values must not carry over. User enters symbol; other fields are optional.
3. User may select a fixed exchange choice or leave Exchange blank. “Other” is a selectable value, not a custom-entry mode. The dropdown is not represented as a complete or authoritative catalog.
4. User may enter or edit sector and industry as optional free text.
5. User submits the form.
6. On successful create, navigate to the new security's read-only detail view. On successful edit, return to that existing security's read-only detail view. Preserve an accessible route back to the prior list context in both cases.
7. Canceling an edit (including its **Back to security details** link after confirming unsaved-change discard) returns to the existing security's read-only detail view. Canceling creation returns to the originating list.
8. On validation, duplicate conflict, or service failure, keep entered values and show actionable feedback; never imply a save succeeded when it did not.

### Deactivate/reactivate

1. User selects **Deactivate** or **Reactivate** on the details page.
2. Deactivation may use a concise confirmation if the implementation requires confirmation; if so, explain that it retains the record and is reversible.
3. On success, update the visible status and announce the result.
4. The record remains viewable/editable and can be found with the Inactive filter. Reactivation restores Active status without deleting history or changing identity.

### Delete

1. User selects **Delete**.
2. A confirmation dialog identifies the security using symbol and any available name/exchange, and states that deletion is permanent.
3. On confirmation, submit the delete request. The server/persistence result is authoritative; a frontend pre-check is not sufficient.
4. If the record has no references, delete only the security record, show success, and navigate to the list preserving its filters.
5. If one or more business records reference the security, keep all data unchanged, close or retain the dialog with a clear **This security is in use and can't be deleted. Deactivate it instead.** message and a Deactivate action.
6. Deletion never cascades to dependent business data. Deactivation remains available when deletion is blocked.

## State and Feedback Contract

| State | Trigger | User-visible behavior | Recovery/action |
| --- | --- | --- | --- |
| **Loading list/details** | Initial request or route ID/filter change | Accessible progress/status; avoid implying an empty result before the request finishes | Wait; retain route context |
| **Loaded list** | Successful response with records | Render results, current filter values, and row actions | Search, filter, open, add |
| **Empty organization list** | Successful response with no records and no search/filter narrowing | Explain no securities have been added; show **Add security** | Add a record |
| **No search/filter matches** | Successful response with active query/filters but no matching records | Explain no matches; offer clear/reset filters while retaining an add action | Revise query/filters |
| **Loading detail** | Direct or in-app navigation to record | Progress status without exposing another organization's data | Wait |
| **Not found / wrong organization** | ID is absent or not accessible within current organization | Generic not-found message; do not confirm another organization's record exists | Return to list |
| **Loading edit form** | Loading edit record | Distinct progress status; render the edit form only after the record loads, with no editable stale values presented as current | Wait |
| **Edit load failure** | Edit record cannot be loaded | Alert that the record could not be loaded; do not render the form | Retry or go back |
| **Client validation** | Missing symbol or invalid type/query value | Field-level message associated with control via `aria-invalid`/`aria-describedby`; visible message; focus first invalid field on submit | Correct input |
| **Duplicate conflict** | Another record has the same organization, normalized symbol, and exchange value | Preserve draft and associate the conflict with Symbol and Exchange; explain that a blank exchange matches only another blank-exchange record and may coexist with exchange-specific records of the same symbol | Review the existing same-organization record or change the symbol/exchange |
| **Save loading** | Create/update submitted | Disable duplicate submission; keep entered values visible | Wait |
| **Save success** | Confirmed persisted result | Success message; show saved details | Continue or return to list |
| **Save failure** | Network/server failure | Error alert; retain draft; do not show success-shaped fallback | Retry or cancel |
| **Delete confirmation** | User starts delete | Dialog explains permanent effect and names the record; focus is contained and Escape/cancel leaves data unchanged | Confirm or cancel |
| **Delete blocked by references** | Server reports references | Clear explanation; no record or dependent data changed; offer Deactivate | Deactivate or cancel |
| **Delete success** | Confirmed deleted result | Success status and return to prior list filters | Continue browsing |
| **Permission/authentication failure** | Session expired/unauthenticated or authorization denied | Use existing session-expiry flow; if access is denied, show a clear authorization message without leaking record existence | Reauthenticate or return to workspace |
| **Unexpected failure** | Unclassified API/network error | Explicit error with retry where safe; do not silently default, erase input, or report success | Retry or navigate away intentionally |
| **Invalid URL filters** | Malformed, repeated, or unsupported query values | Preserve requested URL and show an actionable invalid-filter state; do not silently choose another filter | Correct/remove invalid parameter using a clear action |

## API-Facing Workflow Contract

The BRD defines user-facing capability, not endpoint names or storage design. Planning/backend work must define the concrete API contract.

| User action | Required input | Expected success | Validation/conflict/failure feedback |
| --- | --- | --- | --- |
| List/search/filter | Verified organization session; optional `q`, `status`, `type`, `exchange` | Only matching records for current organization, plus the organization's unfiltered `totalCount` for the grid status line | Invalid filters are explicit; auth and unexpected errors do not become empty results |
| Read details | Stable security ID and verified organization session | Record visible only if owned by current organization | Not found/unauthorized response must not disclose cross-organization existence |
| Create | Symbol; optional type, name, description, exchange string, sector, industry; organization from verified session | Stable record ID and saved fields | Required-field/type validation and duplicate conflicts return field-appropriate, user-actionable feedback; exchange may be blank; the API field remains an optional string (max 100) for compatibility, but the UI offers only the fixed choices (blank, NYSE, NASDAQ, AMEX, LSE, TSX, OTHER) and preserves an existing unlisted value only while editing |
| Update | Stable security ID, changed fields including an optional exchange string, verified organization session | Persisted updated record and timestamp | Preserve edits on validation/conflict/unexpected failure; clearing exchange saves the optional blank value and does not create a synthetic exchange |
| Deactivate/reactivate | Stable security ID and requested lifecycle action | Same record identity with updated active status | Do not remove record or references; explicit auth/failure handling |
| Delete | Stable security ID and verified organization session | Security deleted only if unreferenced | Referenced security yields a conflict/block result, unchanged records, and clear UX; no cascade; errors are explicit |

All operations must derive organization scope from verified authentication context, not client-supplied organization IDs, in accordance with ADR 0001. Delete/reference safety follows ADR 0016. The UI must not infer that a record is unreferenced from list data or stale client state.

## Responsive Behavior

- **Desktop:** Full-width list with table columns and a visible filter/search row. Details and form use a readable bounded content width; destructive/lifecycle actions remain easy to find but visually distinct.
- **Tablet:** Keep primary search and status controls visible; allow less-used filters to wrap or collapse without hiding selected-filter state. Table may horizontally scroll with symbol and row action kept accessible.
- **Mobile:** Single-column list and form. Search spans available width; filters are in a labelled expandable filter section with active filter count/state. Each result may become a stacked summary card if a table is not readable. Actions remain in document flow; avoid a fixed bottom action bar covering fields or focus.
- Support text zoom and reflow at 200% without loss of fields, status, or actions.

## Accessibility and Inclusion

- Use semantic headings, form labels, table headers or equivalent labelled list semantics, and buttons/links with action names that make sense out of context.
- All functionality is keyboard operable. Provide visible focus, logical tab order, Escape/cancel behavior for dialogs, and focus return to the triggering control after a dialog closes.
- Associate validation messages with fields and focus the first invalid field after failed submission.
- Announce loading, save/delete outcomes, and errors through a polite status region; use assertive alerts only for urgent blocking failures.
- Convey active/inactive status using text and semantics, not color alone.
- Use readable contrast, allow browser scaling, and avoid relying on color, market jargon, or GICS familiarity to explain what the fields mean.
- Preserve description line breaks using text presentation that remains readable at 200% zoom and wraps long unbroken strings without horizontal page overflow.
- Use neutral, plain-language copy for optional sector and industry classifications.
- Preserve the exact user-entered symbol casing for display unless the business duplicate-normalization rule explicitly defines otherwise. Do not silently alter user-entered name/description/classification text.

## Component Mapping (React + shadcn/ui + Tailwind)

- Route-level page components for list, detail, create, and edit; use React Router route params/query state and navigation, not custom History API logic.
- Reusable search/filter controls and a semantic table (or mobile card presentation) composed from the repository's owned shadcn/ui primitives.
- Form controls with field-level validation and optional-field labels.
- Confirmation Dialog/AlertDialog for destructive delete and unsaved-change discard; use the shared design tokens and semantic Tailwind utilities.
- Accessible status/alert regions for loading, mutation outcomes, and errors.
- Follow ADR 0005: no new UI library and no ordinary feature-specific CSS file; preserve the existing semantic token system.

## Historical note (pre-implementation)

Before Security Master was implemented, ADR 0003 planned-feature placeholder rules applied to any visible feature entry. Those presentation-only placeholder constraints no longer apply to the working Security Master route.

## Planning Blockers / Decisions to Confirm

1. **Resolved - delete reference result:** The API returns 409 `SECURITY_BLOCKED_BY_REFERENCES` without dependent-record details.

## User Impact Assessment

- **Who benefits:** Organization members maintaining a curated list; users of future features that need stable security references.
- **Who might be disadvantaged:** Users unfamiliar with exchanges/classifications or expecting deletion to always work may need help understanding duplicate conflicts or blocked deletion.
- **Accessibility implications:** Keyboard, low-vision, and screen-reader users need labelled filters, non-color status, visible focus, usable responsive results, and announced async outcomes; these are explicit acceptance expectations above.
- **Cross-cultural/comprehension risks:** Market terminology and GICS may be unfamiliar or imply more authority than intended. Use plain-language labels/help and describe sector and industry as user-entered P/OS classifications, not official GICS data.
- **Severity of negative impact:** Medium if navigation or deletion behavior is ambiguous; high if cross-organization data leaks or dependent records are deleted.
- **Mitigations:** Treat a blank exchange as a distinct duplicate-key value; scope all data by verified organization; prohibit cascading deletion; provide clear blocked-delete recovery; keep classifications optional free text.
