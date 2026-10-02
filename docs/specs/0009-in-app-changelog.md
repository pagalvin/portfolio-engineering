# In-App Change Log

## Status

- Readiness: Ready for implementation planning
- Owner: TBD
- Date: 2026-09-28

## Summary

Make the product change log available inside the authenticated app. Add a
**Change Log** entry under System, render the repository's change log as
Markdown, and show an indicator when the current user has newer notes to read.
Move the existing changelog content out of `README.md` into the root
`CHANGELOG.md`, leaving a README link.

The app must use the existing GitHub content-fetching and Markdown-rendering
infrastructure. This feature must not introduce a second GitHub retrieval path.

## Business objective

Let users learn what has changed in Portfolio OS without leaving the app, and
make unread release notes discoverable.

## Problem / opportunity

The current changelog is embedded in `README.md`, which users must leave the
app to find. There is no way to tell whether notes have been added since a
user last read them.

## Desired outcomes

- Users can find and read the complete published change log in the app.
- The README points to the canonical changelog file rather than duplicating
  its contents.
- Users can tell when changelog notes they have not yet viewed are available.
- Changelog content remains available through the existing validated and
  cached GitHub content path when GitHub is unavailable.

## Scope

### Included

- Move the changelog currently in `README.md` to a root-level `CHANGELOG.md`,
  preserving its existing entries and chronology; replace the README section
  with a link to that file.
- Add an authenticated **Change Log** page linked from the **System**
  navigation group.
- Display the full changelog as safely rendered Markdown using the existing
  Markdown renderer.
- Make the page directly addressable and compatible with refresh and standard
  browser back/forward navigation.
- Retrieve, validate, cache, and serve the repository changelog through the
  existing backend-owned GitHub content infrastructure.
- Persist a last-view marker for each authenticated user and show a
  user-specific navigation indicator when newer notes are available.
- Define clear loading, unavailable, and stale-content behavior consistent
  with the existing runtime content experience.

### Deferred

- Any notification or alert system beyond the Change Log navigation indicator.
- Changelog search, filtering, subscriptions, email delivery, or user-authored
  notes.
- Changes to Help content or Help behavior beyond the review obligation in
  ADR-0015.

## Non-goals

- A second GitHub client, direct frontend GitHub fetch, or unrelated content
  retrieval mechanism.
- Reworking the existing Help system, its refresh controls, or unrelated
  Markdown experiences.
- Replacing the existing GitHub source, adding GitHub authentication, or
  loading executable or remotely hosted UI content.
- An organization-wide/shared last-view state; the read marker is personal to
  the authenticated user.
- Redesigning the global navigation or introducing a separate notification
  center.

## Functional requirements

### Changelog content and rendering

1. `CHANGELOG.md` at the repository root is the canonical source for published
   product notes.
2. `README.md` must link to `CHANGELOG.md` and must not retain a duplicate
   changelog body.
3. The in-app page must show the available changelog notes in their published
   order and render Markdown with the existing safe, application-owned
   Markdown renderer.
4. The app must retrieve changelog content through the existing backend-owned
   GitHub fetching, validation, cache, and fallback infrastructure. Extend
   that infrastructure as necessary to allow this content source; do not add
   an independent fetcher or expose raw GitHub content directly to the
   frontend.
5. GitHub availability must not block app startup. If a refresh fails, retain
   and serve the last valid changelog content, or show an explicit unavailable
   state if no valid content is available. Do not silently present a failed
   fetch as current content.
6. Unsafe or invalid Markdown must not be rendered or replace the last valid
   content.

### Navigation and access

7. An authenticated user must find an entry labelled **Change Log** in the
   **System** navigation group alongside the existing system destinations.
8. Selecting that entry must open the in-app changelog page. The page must
   work by direct URL, browser refresh, and browser back/forward, using the
   repository's React Router navigation conventions.
9. The page and its content APIs must remain behind the normal authenticated
   application boundary.

### Last view and new-content indicator

10. The app must persist a personal last-view marker for each authenticated
    user. The marker must survive navigation and app restarts and must not be
    shared with other users in the same organization or local installation.
11. The System navigation entry must indicate when the current user has
    changelog notes newer than the content represented by their last-view
    marker.
12. The indicator must clear only after the user successfully opens the page
    and the relevant current changelog content has loaded and rendered. A
    failed or unavailable page load must not advance the marker or clear a
    previously known indicator.
13. If stale cached or bundled content is shown, acknowledge only the dated
    sections actually rendered. If a later successful refresh supplies dated
    sections not yet acknowledged by this user, the indicator must be shown
    again.
14. Last-view state is per authenticated user identity, not organization-wide.
    In hosted mode it follows the authenticated user across devices. In local
    mode it follows that local profile within the local installation and is
    not expected to transfer to another installation.
15. Changelog acknowledgment is nonessential presentation state, not
    user-authored content or portable profile configuration. It MUST NOT be
    included in profile backup/export. When a profile/account is deleted, its
    acknowledgment state MUST be removed with that user's associated data.
    This explicit backup exclusion and deletion requirement must be reviewed
    under ADR-0014 during implementation.
16. A release-note identity is the exact top-level dated section heading in
    `CHANGELOG.md`. Each such heading must be unique and remain stable after
    publication. A newly appearing dated heading is new to a user who has
    not acknowledged it. Editing the body of an already acknowledged dated
    section does not make it new again. If the changelog format changes so a
    date no longer uniquely identifies a release-note section, the product
    must define a replacement visible identity before that format is adopted.
    This defines product semantics only; it does not prescribe how identity
    or acknowledgment is represented or stored.
17. If the app cannot load the current user's unread state, it must not imply
    that the user has read all available notes. Preserve the last confirmed
    **New** or no-**New** state, if one exists, and show an accessible,
    non-interactive status beside the Change Log navigation entry:
    “New changelog status couldn't be checked.” With no previously confirmed
    state, omit **New** while showing this status; unknown does not mean read
    or unread. Retain prior state only for the same authenticated user session
    and clear it on profile/account switch. Do not add a separate notification
    surface or retry control.

## Constraints / applicable ADRs

- **ADR-0002: URL-addressable routing** and **ADR-0004: React Router** apply to
  this major page and require direct navigation, refresh, and history-safe
  behavior.
- **ADR-0005: Tailwind CSS and shadcn/ui** applies to any new or changed
  frontend UI.
- **ADR-0009: GitHub repo-sourced runtime content** applies to repository
  content fetching, server-side validation, caching, fallback, and the
  boundary between backend and frontend. The changelog must use this existing
  infrastructure; this spec does not authorize a separate retrieval
  mechanism.
- **ADR-0013: Deployment modes and passwordless local profiles** applies to
  identifying users in local and hosted modes. Last-view state must not be
  confused across profiles.
- **ADR-0014: Profile delete/backup review** applies because the last-view
  marker is persisted as profile- or user-lifecycle data. The marker is explicitly
  excluded from profile backup as nonessential presentation state and must
  be removed on profile/account deletion. The implementation must still
  complete ADR-0014's required backup/deletion review and test coverage.
- **ADR-0015: Keep Help content synchronized with feature changes** applies
  because this adds a user-facing route. Review whether official Help coverage
  is needed and explicitly record any deferral; unrelated Help-system
  changes are not part of this feature.

These ADRs shape the requirements; no conflict with them is identified.

## Architecture Direction

### User-owned acknowledgment state

- Persist acknowledgment on the authenticated server-side user identity. In
  hosted mode, this makes the state follow the user across devices; in local
  mode, it follows that local profile within that installation's database.
- Represent acknowledgments as a normalized per-user set of stable dated
  section identities: one row per authenticated user and acknowledged
  `CHANGELOG.md` section heading. Scope operations by both the authenticated
  `organizationId` and `userId`, following ADR-0001.
- This is a small feature-owned record set, not a general preferences
  framework. Do not store the state in browser storage, the organization,
  `InvestorProfile`, or the profile export payload.
- Use idempotent insert semantics for each acknowledged identity. Concurrent
  views therefore union acknowledged sections instead of overwriting a
  single high-water marker and losing a concurrent acknowledgment. Reading
  unread state is the set of currently published section identities minus
  that user's acknowledged identities.
- The Change Log read boundary must return the validated Markdown and the
  exact stable dated-section identities represented by that content. The
  authenticated acknowledgment boundary may record only identities present
  in the rendered content snapshot. It must not accept a user identity from
  the request body as the authority for ownership.
- Include acknowledgment rows in the same transactional profile/account
  deletion path as other user-owned child records. Explicitly scope deletion
  by `organizationId` and `userId`. Keep them out of backup/export because
  they are nonessential reading/presentation state, not user-authored or
  portable profile data.

### GitHub content and API boundaries

- Extend the existing server-side GitHub runtime-content pipeline with a
  changelog channel. Reuse its raw GitHub transport, validation boundary,
  channel-keyed validated cache, refresh/failure handling, and bundled
  fallback conventions. Add only the exact root `CHANGELOG.md` source to the
  approved path allowlist; do not create a second GitHub client, fetcher, or
  cache architecture.
- Keep changelog parsing and Markdown validation channel-specific. Extract
  the unique top-level dated headings from the same validated Markdown
  snapshot served to the page so the content and unread calculation cannot
  drift onto separate source versions.
- Use authenticated application API/service boundaries for content and
  per-user unread/acknowledgment operations. The frontend uses the existing
  authenticated API client. The navigation needs unread state for the current
  user; opening the page returns the content snapshot and its section
  identities. Do not prescribe endpoint paths in this business spec.
- Reuse the existing channel-keyed runtime cache record/store where its
  payload and metadata contract fits. A database-design review must confirm
  the exact cache payload mapping; do not add a parallel cache table solely
  for changelog content.

### Existing patterns and schema impact

- There is no implemented generic user-preferences store. Settings
  Preferences is a placeholder. Existing browser `localStorage` uses are
  intentionally local UI state and cannot meet hosted cross-device identity
  scope.
- `InvestorProfile` is a durable per-user domain record, but it is not a
  general preference store and is included in profile backup. Do not overload
  it with changelog reading state.
- A database schema change is required for normalized acknowledgment records,
  including a user relation, organization scope, uniqueness per user and
  dated-section identity, and profile-deletion integration. No new changelog
  content-cache table is expected unless database-design finds the existing
  channel-keyed cache cannot represent the validated changelog payload.
- Database-design must define the exact Prisma model/relations, constraints,
  indexes, and migration approach before persistence implementation. This is
  a planning task/dependency, not a remaining product decision.

### ADR disposition

- ADR-0001 governs direct organization scoping for the user-owned records and
  their mutations.
- ADR-0009 governs the approved repository content source, validation,
  caching, and fallback pattern.
- ADR-0013 governs local profile identity and hosted authentication.
- ADR-0014 governs the required backup/deletion review. Its existing rule
  already permits a documented exclusion with a safe deletion strategy; this
  spec provides that rationale and requires deletion coverage.
- ADR-0015 requires an explicit Help coverage review/deferral for the new
  user-facing route.
- No existing ADR alone defines this exact feature architecture, but the
  combined ADRs cover its tenancy, source, identity, and lifecycle constraints.
  No ADR amendment or new ADR is required: this is a feature-scoped record and
  API design, not a new cross-feature preference or notification architecture.

## UX handoff context

- **Target users:** authenticated Portfolio OS users in local and hosted
  deployments.
- **User goals:** find the Change Log from System, read recent and historical
  product notes in the app, and know when they have not yet viewed newer notes.
- **Core workflow intent:** user selects Change Log, reads successfully loaded
  notes, and the personal last-view marker acknowledges the content shown.
- **Permissions and visibility:** the changelog is official, repository-
  managed content available to authenticated users. The new-content indicator
  is personal to the current user, not shared by an organization.
- **Acknowledgment ownership:** state follows the individual authenticated
  user. Hosted users retain it across devices; a local profile retains it only
  within its local installation. It is excluded from profile export and
  removed when the profile/account is deleted.
- **Resolved UX behavior:** a newly published dated changelog section is
  “new”; a first-time user sees the indicator; opening successfully rendered
  content acknowledges the dated sections shown without requiring scrolling.
  See the [Change Log UX flow](../uxd/flows/0009-in-app-changelog.md).
- **Content constraints:** preserve release order and Markdown meaning; use
  the same safe rendering rules as existing in-app Markdown.
- **Known edge cases:** first visit with no marker; switching local profiles;
  stale cached content followed by a newer refresh; unavailable or invalid
  source content; corrections or additions to an existing dated section.
- **Business constraints:** do not create another GitHub retrieval path or
  unrelated notification experience.
- **Success criteria:** users can read the canonical changelog without leaving
  the app, README has no duplicate changelog body, and the indicator reflects
  each user's unread changelog state.

The [Change Log UX flow](../uxd/flows/0009-in-app-changelog.md) resolves
navigation presentation, new-content semantics, first-visit behavior,
acknowledgment timing, stale/fallback behavior, and page states. This spec
now resolves product ownership, deployment scope, backup exclusion, deletion
handling, and the product-level release identity. It does not choose storage
technology or API design.

## Assumptions

1. The existing authenticated Help content pipeline and Markdown viewer are
   the approved infrastructure to extend or reuse.
2. The changelog is public, non-secret product content sourced from this
   repository's `main` branch.
3. A local profile and a hosted authenticated user each have a stable
   authenticated identity suitable for keeping personal last-view state
   separate.
4. The Change Log page displays the canonical changelog as a whole; selecting
   an individual entry is not required.
5. Excluding this marker from profile backup follows the existing profile
   export contract in Spec 0006, which covers profile identity, Investor
   Profile configuration, and Journal content rather than presentation/read
   state.

## Open questions

There are no remaining product or architecture decisions blocking planning.
The implementation-planner must include a database-design task to finalize
the Prisma schema, constraints, and migration details before persistence
implementation.

## Definition of done

- The root `CHANGELOG.md` is the canonical changelog and `README.md` links to
  it without retaining duplicate changelog content.
- The authenticated System navigation and URL-addressable page provide the
  complete changelog using existing safe Markdown rendering.
- Changelog retrieval uses the existing GitHub content infrastructure, with
  validated content and cache/fallback behavior; no second retrieval
  mechanism is introduced.
- Each user's last-view state is separate and durable, follows hosted users
  across devices or local profiles within their local installation, and only
  advances after successfully rendering the acknowledged content.
- Acknowledgment state is excluded from profile backup and removed on
  profile/account deletion, with the ADR-0014 review and tests completed.
- The product identity for each release note is its unique, stable dated
  section heading; edits to an acknowledged section do not retrigger **New**.
- The navigation indicator follows the resolved UX rule: a new dated section
  is unread; a first-time user sees **New**; successful rendering
  acknowledges only dated sections actually shown, without scroll tracking.
- Loading, stale, unavailable, and invalid-content behavior is clear and does
  not falsely clear the indicator.
- Relevant ADR obligations, including profile backup/deletion review and the
  ADR-0015 Help-content review, are addressed.
- The plan sequences database-design before implementation of the
  acknowledgment schema and deletion path, and verifies user/organization
  isolation, idempotent concurrent acknowledgments, backup exclusion, and
  profile deletion cleanup.

## Acceptance criteria

### Content source and page

- **Given** the published changelog is moved to `CHANGELOG.md`, **when** a
  reader opens `README.md`, **then** the README links to that file and does
  not contain a duplicate copy of its notes.
- **Given** an authenticated user selects **System → Change Log**, **when**
  valid changelog content is available, **then** the page displays the notes
  as safely rendered Markdown in the published order.
- **Given** a user opens the page URL directly, refreshes it, or uses browser
  back/forward, **then** the Change Log page remains reachable through the
  application's React Router behavior.
- **Given** GitHub is unavailable after valid changelog content has been
  cached, **when** the user opens Change Log, **then** the last valid content
  remains available and its stale/unavailable state is communicated.
- **Given** no valid cached or bundled changelog content exists, **when** the
  user opens Change Log, **then** the app shows an explicit unavailable state
  rather than blank or misleading content.
- **Given** fetched Markdown is invalid or unsafe, **when** the existing
  content pipeline validates it, **then** it is not rendered and does not
  replace the last valid content.

### Personal last-view state and indicator

- **Given** two authenticated users share an organization or local
  installation, **when** one user views the changelog, **then** the other
  user's last-view marker and indicator are unaffected.
- **Given** a hosted user signs in to the same account on another device,
  **when** Change Log unread state is loaded, **then** it reflects the same
  user-owned acknowledgment state as on the first device.
- **Given** two local profiles use one installation, **when** one profile
  views the changelog and the active profile is switched, **then** each
  profile's own acknowledgment state is retained separately.
- **Given** a profile backup/export is generated, **when** its contents are
  inspected, **then** changelog acknowledgment state is not included.
- **Given** a profile/account is deleted, **when** deletion completes,
  **then** its changelog acknowledgment state is removed and cannot affect
  another user or a later profile.
- **Given** two devices or browser sessions acknowledge different rendered
  dated sections for the same hosted user concurrently, **when** both writes
  complete, **then** both acknowledgments are retained and neither overwrites
  the other.
- **Given** the source contains newer notes than a user's last-view marker,
  **when** at least one newly published dated section is beyond that marker
  and the user's System navigation is shown, **then** the **Change Log** entry
  displays a visible, accessible **New** label.
- **Given** a user has no last-view marker and dated changelog sections are
  available, **when** the System navigation is shown, **then** the **Change
  Log** entry displays **New** until a successful page view acknowledges the
  rendered sections.
- **Given** the user has successfully loaded and rendered the relevant
  changelog content, **when** their last-view marker is confirmed, **then**
  the indicator clears for the dated sections rendered, without requiring the
  user to scroll through the document.
- **Given** a page load fails or no changelog can be rendered, **when** the
  user attempts to open Change Log, **then** the last-view marker does not
  advance and a previously known indicator is not cleared.
- **Given** the user views stale cached content and a later refresh makes
  newer dated sections available, **when** the navigation state is next
  evaluated, **then** the indicator is shown again for the sections newer
  than the content actually acknowledged.
- **Given** content changes only within an already-published dated section,
  **when** the navigation state is next evaluated, **then** those edits do
  not by themselves trigger the **New** indicator.
