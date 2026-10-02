# In-App Change Log UX Flow & Contract

- **Date:** 2026-09-28
- **Spec:** [0009-in-app-changelog](../../specs/0009-in-app-changelog.md)
- **Referenced ADRs:** [0002 (URL-addressable routing)](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0004 (React Router)](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005 (Tailwind/shadcn)](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [0009 (repo-sourced runtime content)](../../ADRs/0009-use-github-repo-sourced-runtime-content.md), [0013 (deployment modes and local profiles)](../../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md), [0014 (profile delete/backup review)](../../ADRs/0014-require-delete-backup-review-for-profile-related-data.md), [0015 (Help content synchronization)](../../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md)
- **Plan task:** [T-05.1 in Plan 0009](../../plans/closed/0009-in-app-changelog.md) owns the frontend navigation indicator.

## UX Summary

The Change Log is a read-only, authenticated System destination that presents
the complete repository changelog in the app. A compact, text-labelled
**New** indicator appears next to the navigation label while the current user
has not acknowledged a newly published dated changelog section.

The indicator is a reading aid, not a notification system. Opening the page
and successfully rendering the current available content acknowledges the
dated sections included in that rendered content. Scrolling is not required.
If the user sees stale cached or bundled content, only that content is
acknowledged; a later refresh that supplies newer dated sections can show
**New** again.

The visual and interaction patterns reuse the current System navigation,
Help content status pattern, safe Markdown viewer, semantic tokens, and
React Router conventions.

## User Jobs

1. Find the Change Log from the System navigation.
2. Read published product notes without leaving Portfolio OS.
3. Know when a dated changelog section has been added since the last
   successful view.

## Product Decisions

### What counts as new

- A **new release note** is a newly published top-level dated section in
  `CHANGELOG.md`.
- A dated section is considered a single published release-note unit.
- Editing, correcting, or adding bullets under an already-published dated
  section does not trigger **New** again. This avoids treating editorial
  maintenance as a new release.
- The UI does not show a count. One **New** label means one or more dated
  sections are unacknowledged.
- If the app cannot determine unread state, it must not represent the user as
  having no new content. Keep any previously confirmed state visible and show
  a separate, plain-text status beside the Change Log navigation entry.
  Unknown state is not itself evidence that new content exists, so do not show
  **New** solely because the request failed.
- On an initial unread-state failure with no previously known result, show the
  **Change Log** link without a **New** badge and show: “New changelog status
  couldn't be checked.” This explicitly communicates uncertainty rather than
  implying that there is nothing new.
- On a later unread-state failure in the same authenticated user session,
  preserve that user's most recently confirmed **New** or no-**New** state
  and show the same status text. A previously confirmed **New** badge remains
  visible until a successful response or acknowledgment confirms otherwise;
  a previously confirmed read state is retained but visibly identified as
  potentially out of date by the status. Never carry a previous user's state
  across a profile/account switch.
- The status is a non-interactive, accessible text message using the existing
  navigation/status presentation patterns. Place it adjacent to the Change
  Log entry, expose it to assistive technology, and announce it politely. No
  extra icon, badge variant, retry control, or separate notification surface
  is required.
- Product content must continue to use stable, unique dated section headings.
  If the changelog format changes to multiple releases per date or another
  structure, the product owner must define a new visible release identity
  before implementation changes the indicator semantics.

This is a product-level comparison rule, not a directive to use a date,
version, timestamp, hash, or another specific persistence token. The product
identity is the unique, stable dated heading as further specified under
First visit and acknowledgment.

### First visit and acknowledgment

- A user with no last-view marker sees **New** when changelog content with at
  least one dated section is available. On first successful view, the
  available sections are acknowledged.
- Acknowledgment occurs after content has loaded successfully and is rendered
  on the Change Log page. It does not require scrolling, waiting a minimum
  time, or opening each section.
- A failed load or a page with no renderable changelog content does not
  acknowledge anything.
- If content is rendered from a valid stale cache or bundled fallback, the
  user acknowledges only the dated sections contained in that rendered
  content. Newer sections delivered by a subsequent successful refresh are
  unacknowledged and produce **New**.
- Acknowledgment must be associated with the authenticated user, not the
  organization. Switching users/profiles must show that identity's own
  indicator state.
- In hosted mode, acknowledgment follows the authenticated user across
  devices. In local mode, it follows that local profile within the current
  installation only.
- Acknowledgment is nonessential presentation state: it is excluded from
  profile backup/export and removed when that profile/account is deleted.
- Each release-note identity is the exact unique, stable top-level dated
  heading in `CHANGELOG.md`. Editing an existing acknowledged section does
  not create a new identity.
- If saving acknowledgment state fails or is rejected, reading remains
  available. Keep or restore **New** when the client knows sections remain
  unacknowledged; show non-blocking status that the view could not be
  recorded. Retry behavior and marker concurrency belong to the API contract.

## Route Map & URL Contract

| Route | Purpose | URL-owned state | Component state | Refresh/deep-link behavior |
|---|---|---|---|---|
| `/change-log` | Authenticated full changelog | Route only; no selected section or filter | Content loading, source status, and transient acknowledgment request/result | Direct load and refresh display the same page; browser back/forward follows React Router |

- The **Change Log** navigation entry points to `/change-log`.
- There is no section selection, search, pagination, or scroll position encoded
  in the URL for this slice.
- Current navigation destination is derived from the route, not duplicated
  in local state.
- Loading, content, source freshness, and acknowledgement request status are
  ephemeral view state. Persisted last-view state is user data and is not
  represented in the URL.
- Do not add custom History API handlers or put content, identity, or marker
  values in the URL.

## Information Architecture & Page Composition

### System navigation

- Add **Change Log** as a peer destination in the existing **System** group.
- Display the label plus a compact **New** text badge when unread dated
  sections exist.
- When unread state cannot be loaded, keep the current user's last confirmed
  badge state from this authenticated session (if any) and show the
  non-interactive status text “New changelog status couldn't be checked.”
  beside the entry. With no prior result for this user, omit **New** but show
  the status; do not present unknown as a confirmed read state or carry state
  across a profile/account switch.
- Do not use a color-only dot or an unexplained icon. The visible word **New**
  is the non-color cue and remains available to assistive technology.
- Keep the link's normal and current-route states consistent with existing
  `NavLink` styling. Preserve visible keyboard focus.
- At narrow widths, allow the current navigation's responsive behavior to
  wrap or collapse without truncating or hiding the **Change Log** label or
  its **New** state.

### Change Log page

- Page heading: **Change Log**.
- Brief supporting copy: **See what's changed in Portfolio OS.**
- Show the source/freshness status using the existing Help content status
  pattern; do not add refresh controls or a separate notification surface.
- Render the complete Markdown document in its published order using the
  existing safe Markdown viewer. Do not create a custom changelog renderer.
- Preserve the date headings, heading hierarchy, lists, links, and other
  formatting supported by the existing Markdown renderer.
- Reuse current link behavior (open external links in a new tab with safe
  `rel` attributes) and current image fallback behavior; do not add embedded
  remote media or new Markdown extensions in this feature.
- Use semantic page heading and document structure. The content region must
  have an accessible name.

## State Model

| State | Trigger | User-visible behavior | Acknowledgment |
|---|---|---|---|
| Loading | Page opened; content request pending | Page heading and polite loading status, e.g. “Loading the change log.” Avoid a blank page. | Do not advance |
| Current content | Valid current content loaded and rendered | Full Markdown; no stale warning. If new dated sections exist, **New** remains until the rendered content's acknowledgment is confirmed. | Record the displayed dated sections after render |
| Stale cache | Current source unavailable; valid previously cached content served | Render the content and use existing Help freshness/status treatment to identify it as potentially out of date. | Acknowledge only the dated sections rendered |
| Bundled fallback | No valid cache; bundled content served | Render available fallback and identify its fallback/stale status using the existing content-status pattern. | Acknowledge only the dated sections rendered |
| Empty content | A valid changelog contains no dated sections | Show a calm empty state: “No change log entries are available yet.” Do not show a content error. | Do not advance beyond an empty/unidentified content state |
| Content unavailable | No renderable current, cached, or bundled content; network/server failure | Show an explicit error state: “The change log couldn't be loaded.” Provide a retry action if the existing API/client supports an explicit retry. Keep navigation usable. | Do not advance; do not clear **New** |
| Invalid/unsafe content | Existing backend validation rejects a new source payload | Keep showing the last valid cache if one exists, with stale status; otherwise show unavailable state. Never render rejected content or a success-shaped empty page. | Only acknowledge valid content actually rendered |
| Acknowledgment pending | Content rendered and marker update pending | Keep content readable; announce a brief polite status only if the operation is perceptibly delayed. | Do not optimistically hide **New** |
| Acknowledgment success | Server confirms marker update | Keep content visible; remove **New** for the sections included in the rendered content. | Advance through rendered content |
| Acknowledgment failure/conflict | Marker request fails, is rejected, or conflicts | Keep content readable; show non-blocking message “Your view couldn't be recorded. New items may still be marked.” Keep or restore **New** when the state is known to be unread. | Do not claim success; API must resolve/re-read concurrent state |
| Initial unread-state failure | Navigation unread-state request fails and no prior result exists for this authenticated user | Show the Change Log link without **New** and an adjacent polite status: “New changelog status couldn't be checked.” This communicates unknown state, not read state. | Do not infer read or unread; do not acknowledge |
| Subsequent unread-state failure | Request fails after a successful unread-state result for the same authenticated user session | Preserve that user's last confirmed badge state. If it was unread, keep **New** visible; if it was read, omit **New** but show the adjacent polite unknown-state status. Clear prior state on profile/account switch. | Do not change or acknowledge state |
| Unauthenticated/session expired | User opens the route without a valid authenticated session | Use the existing authentication/session recovery behavior; do not expose changelog APIs or user marker state publicly. | Do not advance |

There is no user-editable content, so form validation conflict states do not
apply. The only relevant conflict is a concurrent or rejected acknowledgment
update; its persistence semantics are an API/architecture decision.

## API-Facing Workflow Contract

This section describes user-visible contract, not endpoint design or storage.
Reuse the existing authenticated GitHub content path and Markdown validation
boundary; do not fetch GitHub content from the frontend.

| User action | Required input | Expected success | Validation/conflict/failure feedback |
|---|---|---|---|
| Open `/change-log` | Authenticated session | Backend returns validated changelog content and source/freshness metadata; frontend renders it using the shared Markdown viewer | Loading, stale, empty, invalid, unavailable, and session states follow the state table |
| Render loaded content | Validated content payload and its revision/release identity | Full document is visible in published order | Unsafe content must be rejected by the existing content validation boundary; show last valid content or explicit unavailable state |
| Acknowledge rendered content | Authenticated user identity and identity of exactly the rendered changelog release set; no client-supplied user identity | Personal marker advances after successful render | Failure/conflict must not be presented as success or clear the indicator; reading remains available |
| Evaluate navigation indicator | Current available release set and this user's marker | Show **New** when at least one available dated section is unacknowledged; otherwise omit it | If the request fails, retain this user's last confirmed badge state in the current session (if any), show “New changelog status couldn't be checked.” beside the link, clear state on profile/account switch, and do not infer read or unread |

Required API product behavior:

- Content is read-only and authenticated, consistent with Help.
- Acknowledgment is personal to the authenticated user.
- The backend must ensure marker updates cannot be made on behalf of another
  user by trusting a request-body identity.
- The content/read API and marker API may require new operations, but they
  must be integrated with the existing app API client and content pipeline.
- No persistence technology, table shape, endpoint path, cache schema, source
  revision format, profile backup rule, or deletion behavior is selected here.

## Responsive Behavior

- Reuse the existing authenticated workspace shell and System navigation.
- At desktop widths, show the Change Log as a single readable document in the
  main workspace column; do not add a separate desktop-only navigation panel.
- At tablet and mobile widths, use the existing single-column workspace flow.
  Markdown must wrap long text and links and remain horizontally usable.
- Do not use fixed-width content that clips under browser zoom or text scaling.

## Accessibility & Inclusion

- Use a real navigation link whose accessible name includes **Change Log**.
- Include the visible **New** word in the link's accessible name or as
  adjacent text exposed to assistive technology; do not rely on color, hover,
  tooltip, or `title` alone.
- When unread state is unknown, expose the adjacent status text to assistive
  technology through the existing polite status pattern. Do not use an
  unlabeled icon, hide the failure from screen-reader users, or make the
  status a second focus stop.
- Keep the badge non-interactive; the Change Log link is the sole focus stop.
- Preserve a strong visible focus indicator and normal link keyboard behavior.
- Announce loading and material load/acknowledgment failures through existing
  polite status or alert patterns without repeatedly announcing the entire
  changelog.
- Use a semantic `h1` for the page and preserve Markdown heading structure.
- Ensure contrast for text and badge against the existing semantic surface
  tokens, reflow at 200% zoom, and avoid meaning conveyed by color alone.
- Use plain, neutral copy. Avoid jargon such as “commit”, “hash”, or “revision”
  in user-facing messages.

## Explicit Non-goals

- A second GitHub fetcher, frontend direct GitHub request, or new notification
  system.
- Notifications outside the System navigation **New** label.
- Search, filters, subscriptions, email, per-release routes, or separate
  section acknowledgment.
- Scroll-depth or dwell-time tracking.
- Changelog editing inside the app, Markdown authoring, embeds, or new
  Markdown capabilities.
- Selecting a persistence technology, API design, or physical content-marker
  representation.

## Downstream Implementation Notes

Spec 0009 records the architecture direction: durable acknowledgments are
user-owned, represented per stable dated-section identity, and updated with
idempotent insert semantics so concurrent views do not overwrite one another.
It also assigns database-design to finalize the Prisma relations, constraints,
indexes, and migration before persistence implementation. This UX flow does
not prescribe endpoint paths or physical schema details.

## User Impact Assessment

- **Who benefits:** users who want to learn about product changes without
  leaving the app, especially returning users who need a clear cue for a
  newly published dated section.
- **Who might be disadvantaged:** users who treat edits to an existing dated
  section as newly relevant will not receive a second badge. This is an
  intentional noise-reduction tradeoff; substantive release information
  should be published under a new dated section.
- **Accessibility implications:** a visible text badge avoids color-only
  communication; one keyboard stop preserves predictable navigation; the
  page retains semantic headings and status announcements. When unread state
  is unavailable, adjacent text communicates the uncertainty without
  implying that nothing is new. Low-vision users benefit from reflow and
  readable text; screen-reader users receive both the **New** state and
  material status messages without relying on a tooltip.
- **Cross-cultural/comprehension risks:** date formats and the word “New” may
  be interpreted differently across locales. Keep date headings in their
  authored content format, avoid idioms, and localize the short badge and
  status copy if/when the app introduces localization.
- **Severity of negative impact:** low.
- **Mitigations:** use stable, unique dated release headings; display a text
  badge and explicit freshness states; preserve confirmed unread state when
  requests fail; show an accessible unknown-state message rather than
  implying everything is read; do not auto-acknowledge failed loads; keep the
  complete content accessible regardless of indicator state.
