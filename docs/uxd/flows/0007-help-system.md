# Help System UX Flow

- Spec: [0007-help-system](../../specs/0007-help-system.md)
- Status: Ready for implementation planning
- Scope: Initial official-help delivery only
- Notes feature: Deferred to a future feature

## Product direction

Help is an authenticated in-app product resource backed by official content in a public GitHub repository. Users authenticate to the application through the existing flow, then can open and share help URLs within the authenticated app. The experience should answer two related jobs:

1. **Find it:** browse help by the application's global navigation and user goal.
2. **Understand it:** read a focused topic or get a short contextual explanation.

Help content is global/system-scoped rather than organization-owned, but the in-app Help experience remains behind the existing application authentication boundary.

## Routes and URL state

Recommended routes:

| Route | Purpose | URL-owned state | Ephemeral state |
| --- | --- | --- | --- |
| `/help` | Help landing page | None | Expanded navigation groups, loading state |
| `/help/:helpKey` | Long-form help topic | `helpKey` | Scroll position, tooltip visibility |

Route rules:

- Use React Router declarative APIs.
- `helpKey` is the stable index key or a canonical alias resolved by the backend.
- Do not expose repository paths in URLs.
- A renamed key may redirect to the canonical topic URL.
- A removed key shows an unavailable-topic view; it must not resolve to an unrelated topic.
- Direct load, refresh, back, and forward must preserve the intended help location.
- A topic URL may be shared, but opening it requires the normal application authentication flow.

## Information architecture

The landing page uses the existing global navigation groups as the primary structure:

- Portfolio
- Execution
- Risk
- Learning
- System

Within each group, UXD recommends grouping content by user intent rather than mirroring routes one-for-one:

- **Overview:** what this area is for
- **How to use:** common workflows
- **Concepts:** terminology and mental models
- **Troubleshooting:** common problems and recovery

The index remains authoritative. A group may contain no topics, multiple topics for one route, or cross-feature topics.

### Landing-page layout

Desktop:

- Page heading: **Help**
- Short description explaining that help is official Portfolio OS guidance.
- Main content: grouped topic cards or sections.
- Optional secondary area: “Recently relevant” or “Start here” only if the index explicitly provides those relationships.
- Small status region showing content freshness when known.

Mobile/tablet:

- Use stacked navigation groups.
- Keep group headings and topic links in normal document flow.
- Do not require a persistent desktop sidebar.
- Preserve the same information order as desktop.

Avoid adding search in the initial delivery. The index and grouped hierarchy are the discovery mechanism.

## Topic-page layout

Recommended structure:

1. Breadcrumb or back-to-help link.
2. Topic title.
3. Optional short summary from the index.
4. Official Markdown content.
5. Related help links when supplied by the index.
6. Content-status notice when serving cached or bundled content.
7. Help feedback/report link using the approved GitHub issue and P/OS subreddit destinations.

The page must not imply that cached or bundled content is authoritative over the repository. Use plain language such as:

- “Help content may be out of date.”
- “We couldn’t refresh help content right now.”
- “If something looks wrong, create a GitHub issue or report it on the P/OS subreddit.”

## Tooltip behavior

Tooltips are brief contextual assistance, not a replacement for documentation.

### Rules

- Content is plain text only.
- Keep the default display concise; use the long-form link for additional explanation.
- Do not place required instructions only in a tooltip.
- Tooltip triggers need an accessible name and visible focus state.
- Hover may show a tooltip, but keyboard focus and an accessible trigger must also work.
- Touch users need an explicit tap/focus interaction; do not depend on hover.
- If a key is missing, omit the tooltip or use a neutral application-defined fallback without displaying a raw error.
- If `relatedPageKey` exists, provide a clear “Learn more” link.

Recommended trigger labels:

- “More information about [term]”
- “Help for [control]”

## Refresh and version behavior

### Authenticated in-app content access

Authenticated in-app Help should use backend APIs:

- `GET /api/app-version` → `{ "version": "1.0.0" }` through the authenticated application API boundary
- `GET /api/help/index` → validated, effective index through the authenticated application API boundary
- `GET /api/help/topics/:helpKey` → validated topic content and status metadata through the authenticated application API boundary
- `GET /api/help/status` → last download-attempt timestamp and current freshness state through the authenticated application API boundary

The exact endpoint names remain implementation decisions, but the authenticated read boundary must remain consistent.

### App-version resolution

The help client requests the official version from the backend. If the response is unavailable or invalid, it uses effective version `1.0.0` for compatibility selection.

Compatibility examples:

- Help with `minAppVersion: 1.0.0` may display on `1.0.0` and `1.0.1`.
- Help with `minAppVersion: 1.1.0` must not display on `1.0.0` or `1.0.1`.
- Bundled fallback content follows the same compatibility rule.

### Refresh controls

Refresh has two paths:

1. **Startup:** asynchronous and invisible unless it changes the visible status.
2. **Manual:** available to any authenticated user in the active organization.

Recommended manual-refresh placement:

- Settings → Preferences or another system-level settings surface.
- Control label: **Refresh help content**
- Supporting text: **Last help refresh attempted: [localized date/time]**

Refresh feedback:

- In progress: disable the control and announce “Refreshing help content.”
- Success: announce “Help content refreshed.”
- Failure: announce “Help content could not be refreshed. Existing help remains available.”
- No previous attempt: show “Help content has not been refreshed yet.”

The UI must not promise that a newer revision was found. It should report the operation result, not an inferred content change.

## State model

| State | User-visible behavior | Recovery |
| --- | --- | --- |
| Loading index | Show page skeleton or concise loading message | Wait; do not show a blank page |
| Loading topic | Preserve title context if known and show content skeleton | Wait |
| Fresh content | Render official content normally | None |
| Cached content | Render content with a subtle stale-status notice | Manual refresh |
| Bundled fallback | Render compatible fallback and explain that content could not be refreshed | Manual refresh; GitHub issue/subreddit link |
| Refresh in progress | Keep current content usable; show progress status | Wait or leave page |
| Refresh failed | Keep last valid content; show actionable status | Retry manually |
| Invalid content | Keep last valid cache or compatible bundled content; never render invalid payload | Report issue |
| Missing topic | Show “Help topic unavailable” and reporting guidance | Return to Help |
| Redirect topic | Resolve alias and navigate to canonical topic URL | None |
| Empty group | Show the group heading with “Help for this area is being prepared.” | Return to Help |
| App-version API unavailable | Use effective version `1.0.0`; do not expose technical details | Continue using compatible content |
| API/network failure | Preserve current content if available; show concise status | Retry |

## API-facing workflow contract

### Authenticated version lookup

- **User action:** Authenticate, then open Help or load a help-aware component.
- **Required input:** An authenticated application session.
- **Success:** Typed version response with a valid semantic version.
- **Invalid/failure:** Help compatibility uses `1.0.0`; the UI remains usable.
- **Client-only:** No. The backend is authoritative.

### Authenticated help index

- **User action:** Authenticate, then open `/help`.
- **Required input:** None.
- **Success:** Validated effective index for the app version.
- **Invalid/failure:** Serve the last valid cached or compatible bundled index; otherwise show the unavailable-help state.
- **Client-only:** No. The backend owns source selection and validation.

### Authenticated help topic

- **User action:** Authenticate, then open `/help/:helpKey` or select a topic.
- **Required input:** Stable help key.
- **Success:** Validated topic content with status/freshness metadata.
- **Invalid/failure:** Show cached, bundled, unavailable, or redirect state as applicable.
- **Client-only:** No. The backend owns content retrieval and validation; the route remains inside the authenticated app shell.

### Authenticated manual refresh

- **User action:** Select **Refresh help content** in system settings.
- **Required input:** Authenticated session and active organization context.
- **Success:** Refresh attempt completes; last attempt timestamp updates; valid content becomes available.
- **Failure:** Existing valid content remains available; timestamp/status communicates the failed attempt; provide GitHub issue/P/OS subreddit guidance.
- **Client-only:** No. Refresh is a backend operation.

## Content and formatting boundaries

- Long-form content: Markdown.
- Tooltip content: plain text only.
- Supported Markdown should include headings, paragraphs, emphasis, lists, links, blockquotes, code blocks, tables, and repository/allowlisted images when enabled.
- External video references should be ordinary links in the initial experience, not embeds.
- Unsafe or unsupported content must be rejected or rendered using the approved safe fallback.
- Content status, aliases, and version metadata are index/API concerns and should not be duplicated in Markdown front matter unless implementation planning explicitly chooses that format.

## Responsive behavior

### Mobile

- Single-column layout.
- Group sections stack vertically.
- Topic navigation uses a compact back link or collapsible section control.
- Long Markdown content uses readable line length and horizontal scrolling for code/table overflow.
- Refresh status remains readable without requiring a wide status panel.

### Tablet

- Two-column layout is allowed when space permits: navigation and content.
- Navigation may collapse into a disclosure when the topic is primary.

### Desktop

- Persistent or sticky topic navigation is allowed if it does not obscure content.
- Keep the official content column readable rather than stretching Markdown across the full viewport.
- Status and refresh metadata should remain secondary to the help content.

## Accessibility and inclusive UX checklist

- Use one clear page heading and a logical heading hierarchy from Markdown.
- Provide semantic navigation landmarks and an accessible name for topic navigation.
- Keep visible focus indicators on every link, button, tooltip trigger, and disclosure control.
- Ensure all controls work with keyboard only.
- Announce loading, refresh, success, and failure states through an appropriate status region.
- Do not communicate stale, fallback, or unavailable status by color alone.
- Keep tooltips supplementary; repeat essential information in visible text or long-form help.
- Ensure external links identify that they open outside the app.
- Preserve readable typography at zoom and narrow widths.
- Use plain language and explain specialized finance terms.
- Do not use humor, hype, gendered assumptions, or patronizing onboarding language.

## React + shadcn/ui + Tailwind mapping

- `HelpLandingPage`: route-level page and grouped navigation.
- `HelpTopicPage`: route-level topic view.
- `HelpGroup`: semantic section for a global navigation group.
- `HelpTopicLink`: React Router link using stable help keys.
- `HelpContentStatus`: loading, stale, fallback, unavailable, and refresh messaging.
- `HelpTooltip`: accessible tooltip trigger and optional long-form link.
- `HelpRefreshControl`: authenticated settings control with status announcement.
- Existing `MarkdownViewer`: reuse or adapt for official Markdown rendering.
- Use React Router `Link`, `NavLink`, and navigation hooks.
- Use semantic design tokens and approved shadcn primitives; avoid new ordinary component CSS.

## Deferred behavior

Organization notes are not part of this handoff. A future feature should define their storage, organization scoping, authorship, edit/delete rights, rendering format, and presentation separately.

## UX verification

- Directly open `/help` and a topic URL.
- Refresh both routes and confirm location is preserved.
- Use browser back/forward between the landing page and topics.
- Test that Help follows the existing authentication boundary and is available after sign-in.
- Test a known topic, alias, unavailable topic, empty group, missing tooltip, cached content, bundled fallback, and failed refresh.
- Test keyboard-only navigation and screen-reader status announcements.
- Test mobile, tablet, desktop, and browser zoom.
- Verify manual refresh is visible only where the authenticated system-settings workflow allows it.

## User Impact Assessment

- **Who benefits:** Authenticated Portfolio OS users, including new users learning the product and experienced users needing quick contextual explanations.
- **Who might be disadvantaged:** Users on unreliable networks may see stale or fallback content; users with cognitive or visual disabilities may struggle with a dense hierarchy or tooltip-only guidance.
- **Accessibility implications:** URL-addressable in-app access, semantic navigation, visible focus, keyboard operation, readable Markdown, and non-color status cues are required. Essential guidance must never exist only in tooltips.
- **Cross-cultural/comprehension risks:** Finance terminology, external videos, and support-reporting language may be unfamiliar or unavailable in some regions. Use plain English, descriptive link text, and text alternatives.
- **Severity of negative impact:** Medium.
- **Mitigations:** Keep content usable offline/degraded, label stale/fallback states clearly, provide direct long-form links, avoid jargon, preserve keyboard and zoom support, and offer GitHub issue/subreddit reporting guidance without making it the only recovery path.
