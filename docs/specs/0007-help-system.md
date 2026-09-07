# In-App Help System

## Status

- Readiness: Ready for planning
- Owner: TBD
- Date: 2026-09-07

## Summary

Add an initial in-app help system for official, repository-managed product guidance. Shared organization notes are explicitly deferred to a future feature.

Official help content is non-secret product content stored in this application repository and served from `main` using the existing repo-sourced runtime content pattern ([ADR-0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md)). A version-aware, validated index maps stable help keys to content and organizes the initial master help page around the application's global navigation while also supporting task- and concept-oriented discovery.

The initial delivery supports:

- a backend API that returns the current official app version (`1.0.0`);
- a master help page organized by global navigation groups;
- long-form Markdown help pages;
- short plain-text tooltips;
- component lookup by stable help key; and
- startup and manual refresh tracking for official help content.

Shared organization notes remain a planned follow-on increment rather than part of the initial help delivery.

## Business objective

Help users understand Portfolio OS features and terminology without leaving the application. A future feature may allow organization members to record shared reminders and interpretations alongside official guidance.

## Problem / opportunity

- The application needs one discoverable place for product guidance as the global navigation expands.
- Official help should be maintainable by changing curated repository content rather than application code.
- Different UI components need small pieces of contextual guidance without duplicating copy in component source.
- Some concepts require detailed explanations, while others only need a short definition or hint.
- A future organization-notes feature may give users a place to capture shared reminders without modifying or confusing official product content.

## Desired outcomes

- Users can open a master help page and browse help organized by the same major groups used by global navigation.
- Users can open a stable, linkable help topic directly.
- Components can request official help content by a stable key rather than by knowing repository file paths.
- Long-form help renders as safe Markdown.
- Tooltips display short plain text and can point users to related long-form help.
- The application remains usable when GitHub is unavailable by using validated cached content or bundled defaults.
- The application can identify the official app version and select help compatible with that version.
- Users can see when official help was last downloaded or attempted.

## Scope

### Included

1. **Official help content**
   - A documented GitHub repository content channel for help.
   - Long-form help content stored as Markdown.
   - Tooltip content stored as plain text.
   - Explicit, allowlisted content paths; no arbitrary user-selected repository paths.

2. **Application version API**
   - A backend endpoint that returns the current official app version.
   - The initial response value is `1.0.0`.
   - Help-related frontend code consumes the version through this API rather than reading package metadata or hardcoding the version.

3. **Help index**
   - A schema-validated index containing stable help keys, titles, content type, content path, hierarchy, ordering, and related application route or component metadata where needed.
   - Index entries for the initial master-page hierarchy.
   - Stable keys used by frontend components and links.

4. **Master help experience**
   - A URL-addressable help landing page organized by the global navigation groups in `scaffoldRoutes.ts`.
   - Topic navigation and a long-form topic view.
   - Direct navigation and browser refresh support for help views.
   - Loading, empty, unavailable, stale, and not-found states.

5. **Component help access**
   - A frontend-facing lookup mechanism for long-form help and tooltips by stable key.
   - A missing-content fallback that does not break the component using it.
   - Optional links from tooltips to their related long-form topic.

6. **Validation and safety**
   - Server-side fetching, validation, caching, and serving of official content.
   - Safe Markdown rendering using the existing Markdown rendering direction.
   - Plain-text tooltip rendering without Markdown or executable content.
   - Tests for content validation, fallback behavior, version selection, and help navigation.

7. **Delivery increments**
   - Increment 1: official help index, hierarchy, URL-addressable Markdown topic pages, and fallback states.
   - Increment 2: component tooltip lookup and links from contextual help to long-form topics.
   - Increment 3: backend app-version API (`1.0.0`), app-version compatibility, content selection, caching, and fallback behavior.
   - Increment 4: startup/manual refresh controls and last-download visibility.
   - Increment 5: approved image and external video-link support.
   - Future feature: organization notes with creator attribution and organization sharing.

## Non-goals

- Allowing end users or organizations to edit official GitHub content in the application.
- Loading executable code, scripts, plugins, remote components, or arbitrary remote UI from GitHub.
- Organization-specific official-help overrides.
- Organization notes in the initial delivery; these are deferred to a future increment.
- Notes shared across organizations or publicly.
- Administrative moderation or override workflows for organization notes.
- Full-text search, semantic search, AI-generated help, or automatic translation in the initial slice.
- A WYSIWYG editor for official help content.
- Replacing the existing global navigation with a separate help-only information architecture.
- Embedding sensitive data, credentials, or user data in GitHub content.

## Functional requirements

### 1. Official content source

1.1. Official help content MUST be sourced through the approved repo-sourced runtime content pattern in ADR-0009.

1.2. The backend MUST fetch official help content server-side from explicit public raw GitHub URLs targeting allowlisted paths in this application repository's `main` branch.

1.3. `main` MUST be the only official help source in the initial implementation. Alternate branches, forks, repositories, and user-configurable content sources are out of scope.

1.4. The frontend MUST consume validated help content through application APIs or an equivalent backend-owned content boundary; frontend components MUST NOT fetch arbitrary GitHub URLs directly.

1.5. Runtime help content MUST be treated as untrusted input until validated.

1.6. The system MUST support successful-content caching and bundled fallback content so GitHub availability is not a startup requirement.

1.7. The system MUST retain the last valid cached content when a refresh fails or new content is invalid.

1.8. Official help content is stored in a public GitHub repository, but the in-app Help experience and application help read APIs MUST use the existing application authentication boundary. Users must authenticate to the app as usual before opening Help. The backend may fetch the public repository without GitHub credentials.

### 2. Application version API

2.1. The backend MUST expose an API endpoint that returns the current official app version.

2.2. The initial endpoint response MUST return `1.0.0`.

2.3. The version response MUST use a typed, validated response shape consistent with existing API conventions.

2.4. The current-version endpoint MUST use the existing application authentication boundary because Help is an authenticated in-app experience.

2.5. Help-related frontend code MUST retrieve the official app version through this API.

2.6. Help-related frontend code MUST NOT read package metadata, infer the app version from build tooling, or hardcode the official version as its source of truth.

2.7. The backend endpoint MUST be the authoritative source for the official app version used in help compatibility decisions.

### 3. Content organization and formats

3.1. Long-form content MUST be Markdown.

3.2. Tooltip content MUST be plain text and MUST NOT be interpreted as Markdown.

3.3. Content SHOULD use a stable, human-readable repository organization, such as:

```text
content/help/
  index.json
  pages/
    <topic-path>.md
  tooltips/
    <tooltip-key>.txt
```

The exact repository path may be refined during planning, but components MUST depend on stable help keys rather than file paths.

3.4. Official content MUST be non-secret, non-executable, and suitable for publication in a public repository.

3.5. The application MUST have an official numeric app-version value used for release compatibility. The version MUST use three-part semantic versioning in the form `MAJOR.MINOR.PATCH`, following Node.js-style versioning conventions.

3.6. Official help content MUST support version eligibility metadata. Each content set MUST declare a minimum compatible app version (`minAppVersion`) using the official app-version convention.

3.7. When the official app version API is unavailable or returns an invalid version, the application MUST use `1.0.0` as the effective app version for help compatibility.

3.8. The application MUST serve only content whose `minAppVersion` is less than or equal to the effective app version.

3.9. A help revision with `minAppVersion: "1.0.0"` MUST be eligible for application versions `1.0.0`, `1.0.1`, and later compatible versions, but MUST NOT be eligible for versions below `1.0.0`.

3.10. A help revision with `minAppVersion: "1.1.0"` MUST be eligible for application version `1.1.0` and later compatible versions, but MUST NOT be served to an application running `1.0.0` or `1.0.1`.

3.11. When multiple compatible help revisions exist, the application MUST select the highest eligible source according to the same numeric semantic-version ordering conventions used by Node.js. Content requiring a version newer than the effective app version MUST NOT be selected.

3.12. Bundled fallback content MUST also declare `minAppVersion` and MUST be selected using the same effective-version compatibility rule. The application MUST NOT serve bundled help that requires a newer version than the effective app version.

3.13. The content model MUST support the current development version and future released application versions without a schema redesign.

3.14. Official help MAY include images and links to externally hosted videos. Images MUST use repository-controlled or explicitly allowlisted sources, and video links MUST be rendered as links rather than executable embeds unless a future security and UX decision authorizes embeds.

### 4. Help index

4.1. The help index MUST define a stable unique key for every long-form page and tooltip.

4.2. Each long-form help entry MUST identify, at minimum:

- stable help key;
- title;
- content type;
- content path or source identifier;
- parent entry or hierarchy location; and
- display order.

4.3. The index MAY associate an entry with an application route, global navigation item, component, or related help key.

4.4. The backend MUST validate the index and reject invalid entries before caching or serving it.

4.5. Components MUST request help using the stable key and MUST NOT construct a path from unsanitized user input.

4.6. The index MUST support stable-key aliases for renamed help topics.

4.7. When an official help key is renamed, the index MUST retain the former key as an alias or redirect to the replacement key for a documented compatibility period.

4.8. A removed help topic MUST be represented explicitly as unavailable or redirected; removing a file MUST NOT silently cause an unrelated topic to be served for the old key.

4.9. The initial help index MUST support the following logical shape:

```json
{
  "schemaVersion": 1,
  "contentVersion": "1.0.0",
  "entries": [
    {
      "key": "help.dashboard.overview",
      "title": "Dashboard",
      "type": "page",
      "path": "content/help/pages/dashboard/overview.md",
      "group": "Portfolio",
      "parentKey": "help.portfolio",
      "order": 10,
      "minAppVersion": "1.0.0",
      "aliases": [],
      "status": "active"
    },
    {
      "key": "help.dashboard.performance",
      "title": "Performance",
      "type": "tooltip",
      "path": "content/help/tooltips/dashboard.performance.txt",
      "relatedPageKey": "help.dashboard.overview",
      "minAppVersion": "1.0.0",
      "aliases": [],
      "status": "active"
    }
  ]
}
```

4.10. `schemaVersion` MUST identify the structure of the index. `contentVersion` MUST identify the official help content set and MUST NOT be used as a substitute for the application compatibility version.

4.11. Each entry MUST include `key`, `type`, `path`, `minAppVersion`, and `status`. Page entries MUST include `title`, hierarchy metadata, and display ordering. Tooltip entries MUST include plain-text content metadata and MAY reference a related page.

4.12. `status` MUST support at least `active`, `redirect`, and `unavailable`. Redirect entries MUST identify their replacement key. Unavailable entries MUST NOT reference unrelated replacement content.

4.13. The index and every referenced content path MUST be validated before the content set is cached or served.

### 5. Master help page and navigation

5.1. The initial master help page MUST be reachable through the stable React Router route `/help` under the authenticated workspace.

5.2. The master page MUST use the current global navigation groups as its primary information architecture:

- Portfolio;
- Execution;
- Risk;
- Learning; and
- System.

5.3. Within those groups, UXD SHOULD organize topics around user jobs and concepts where that improves findability, rather than forcing every topic into a one-to-one route hierarchy.

5.4. Help topic pages MUST be directly navigable, refreshable, and usable with browser back and forward controls.

5.5. A topic route MUST use a stable URL representation that does not require components to expose repository file paths.

5.6. The interface MUST provide deliberate states for loading, missing content, unavailable content, stale content, and empty sections.

### 6. Long-form help

6.1. Long-form help MUST render Markdown through a safe, application-owned renderer.

6.2. The renderer MUST preserve accessible headings, links, lists, and other supported Markdown structures.

6.3. Unsupported, unsafe, or invalid content MUST be handled as an error or omitted according to an explicit validation policy; it MUST NOT execute in the browser.

6.4. A long-form page SHOULD identify when the displayed content is stale or being served from fallback content, without exposing implementation details that confuse users.

### 7. Tooltips

7.1. Tooltips MUST be short plain-text explanations intended for contextual UI guidance.

7.2. Tooltips MUST be accessible through keyboard interaction and assistive technology when attached to interactive or form controls.

7.3. A tooltip MAY link to a related long-form topic when more explanation is useful.

7.4. Missing tooltip content MUST degrade to a safe absence or application-defined fallback and MUST NOT break the host component.

### 8. Refresh and fallback behavior

8.1. The application MUST asynchronously attempt to find eligible official help content from the repository when the application starts.

8.2. Any authenticated user in the active organization MUST be able to manually refresh official help. The user-facing manual refresh control SHOULD be placed with system settings or another system-level surface selected by UXD.

8.3. Startup refresh MUST NOT block application startup or prevent use of valid cached or bundled help content.

8.4. Refresh failures MUST be observable through safe application logging and an appropriate user-facing stale or unavailable state.

8.5. Invalid new content MUST NOT replace the last valid cached content.

8.6. The system MUST persist the date and time of the last official-help download attempt in a database record.

8.7. The initial implementation does not need to persist a separate record for each attempt or additional download metadata.

8.8. The application MUST expose the date and time of the last help download attempt to the appropriate system-level UI.

8.9. The system MUST retain valid cached or bundled content when a refresh fails.

8.10. When official content is missing, invalid, stale beyond the supported fallback policy, or unavailable, the UI MUST explain that there was a problem loading help and suggest creating a GitHub issue or reporting the problem on the P/OS subreddit.

8.11. The official-help cache and last-download metadata MUST be global/system-scoped and MUST NOT be stored as organization-owned data.

8.12. The initial implementation does not require coordination or deduplication of concurrent refresh requests. Each refresh request MAY perform its own download attempt.

## Constraints / applicable ADRs

- **ADR-0002 (URL-Addressable Routing):** The help landing page and meaningful topic context must be deep-linkable and preserved through refresh and browser history.
- **ADR-0004 (React Router):** Help navigation and topic routes must use React Router declarative APIs rather than custom History API logic.
- **ADR-0005 (Tailwind CSS and shadcn/ui):** New help UI must use the approved frontend styling and component direction.
- **ADR-0009 (GitHub Repo-Sourced Runtime Content):** Official help must use server-side fetching, schema validation, caching, bundled defaults, controlled refresh, and global/system scope. The source is this application's public GitHub repository, with version eligibility determining which content is served.

Official help remains global/system-scoped. Organization notes are deferred to a future increment and are not part of the initial delivery covered by this spec.

## UX handoff context

- **Target users:** Retail investors and active traders using Portfolio OS, including users who are learning unfamiliar financial concepts.
- **Primary user jobs:**
  - Find an explanation for the current app area.
  - Read a detailed explanation without leaving the workflow.
  - Get a quick definition from a tooltip.
- **Core workflow:**
  1. User opens Help from the global application shell.
  2. User browses the navigation-aligned hierarchy or opens a direct topic link.
  3. User reads official Markdown content.
  4. User optionally refreshes official help from the system-level refresh control.
  5. User returns to the originating feature or follows a related help link.
- **Navigation context:** The initial hierarchy mirrors the global navigation groups, with Help added as a System navigation item at the same level as Settings. The design should support topics that do not map one-to-one to routes.
- **Responsive behavior:** The master page and topic view must work on narrow and wide viewports; hierarchy navigation must not require a desktop-only side panel.
- **Accessibility:** Keyboard navigation, focus visibility, semantic headings, readable Markdown structure, accessible tooltip triggers, and clear status/error announcements are required.
- **Content tone:** Clear, neutral, supportive, plain English; avoid hype, patronizing language, and unexplained industry jargon.
- **Content distinction:** Official guidance and fallback content require clear status labeling; organization-note presentation is deferred to a future increment.
- **Empty and failure states:** Design states for an empty help section, missing topic, stale cached content, failed refresh, and unavailable content.

## Assumptions

1. The existing Portfolio Engineering GitHub repository is the initial official help source, in the same repository as the application code.
2. Official help is global/system-scoped and is not customized per organization in this feature.
3. If the official app version is unavailable, the effective help version is `1.0.0`.
4. The existing Markdown viewer or a compatible owned renderer can be reused or extended for long-form help.
5. The current global navigation groups in `apps/frontend/src/scaffoldRoutes.ts` are the initial master-page categories.
6. Help keys remain stable even if repository folders or filenames change.
7. Search is not required for the first slice; indexed hierarchy browsing is the initial discovery mechanism.

## Open questions

There are no remaining product open questions for the initial authenticated Help scope. The landing route is `/help`, topic routes use `/help/:helpKey`, and Help appears beside Settings in the System navigation.

## Definition of done

- The approved official help source, path allowlist, content schema, freshness policy, and fallback behavior are documented.
- A backend app-version endpoint returns the current official version as `{ "version": "1.0.0" }`.
- Help-related frontend code obtains the effective app version from the backend endpoint and uses `1.0.0` only when the endpoint is unavailable or invalid.
- A validated help index supports the documented schema, stable keys, hierarchy, aliases, redirects, version eligibility, long-form Markdown, and plain-text tooltips.
- The master help page presents the initial hierarchy aligned with global navigation.
- Help topics are URL-addressable and work with direct navigation, refresh, and browser history.
- Components can request long-form help and tooltips by stable key.
- Long-form Markdown is rendered safely and tooltips remain plain text.
- Version-eligible content is selected correctly for the running official application version.
- Startup refresh is asynchronous and does not block application startup.
- The last help-download attempt timestamp is persisted and surfaced in the appropriate system-level UI.
- Official-help cache data is global/system-scoped rather than organization-owned.
- Images and external video links follow the approved content-source and rendering policy.
- GitHub failure, invalid content, missing content, stale cache, and bundled fallback behavior are covered by existing automated tests.
- Accessibility and responsive behavior are verified for the master page, topic view, tooltips, and refresh workflow.

## Acceptance criteria

### Given valid official help content and a valid index

- **When** the application refreshes the official help channel,
- **Then** it validates and caches the index and referenced content,
- **And** the master help page displays the configured hierarchy and topic titles.

### Given the app-version API is available

- **When** help-related frontend code requests the current app version,
- **Then** the backend returns the validated response `{ "version": "1.0.0" }`.
- **And** the endpoint follows the existing application authentication boundary.

### Given the app-version API is unavailable or invalid

- **When** help-related frontend code selects compatible content,
- **Then** it uses `1.0.0` as the effective app version,
- **And** it does not read package metadata or use a frontend hardcoded version as the source of truth.

### Given multiple eligible help versions

- **When** the application runs version `X`,
- **Then** it serves the highest eligible help content from the configured `main`-branch source whose minimum version is `X` or lower,
- **And** it does not serve content requiring a version newer than `X`.

### Given the official app version is unavailable

- **When** the application selects help content,
- **Then** it uses `1.0.0` as the effective app version for compatibility checks.

### Given bundled fallback content is used

- **When** no eligible cached or repository-sourced content is available,
- **Then** the application selects bundled content using the same `minAppVersion` compatibility rule,
- **And** it does not serve bundled content requiring a newer version than the effective app version.

### Given the application starts

- **When** the application initializes,
- **Then** it attempts to find eligible official help content from the repository `main` branch,
- **And** it performs that refresh asynchronously,
- **And** it records the download attempt timestamp,
- **And** it continues using valid cached or bundled content if the refresh fails.

### Given an authenticated user manually refreshes help

- **When** the user requests a refresh,
- **Then** eligible valid content becomes available if the refresh succeeds,
- **And** the download attempt timestamp is updated.

### Given GitHub is unavailable after valid content was cached

- **When** a user opens Help,
- **Then** the application serves the last valid cached content,
- **And** the interface communicates that the content may be stale without blocking help usage.

### Given GitHub is unavailable and no valid cached content exists

- **When** a user opens Help,
- **Then** the application serves bundled fallback content where available,
- **And** unavailable topics show a clear, non-breaking state.

### Given invalid or unsafe official content

- **When** the application attempts to refresh it,
- **Then** the invalid content is rejected,
- **And** the last valid cached content remains available,
- **And** the invalid payload is not rendered or executed.

### Given a user opens a help topic

- **When** they navigate directly to its URL, refresh the page, or use browser back and forward,
- **Then** the same help topic remains addressable and usable.

### Given a component requests a known tooltip key

- **When** the tooltip is shown,
- **Then** the user sees the corresponding plain-text explanation,
- **And** the tooltip is keyboard and assistive-technology accessible.

### Given a component requests a missing tooltip key

- **When** the component renders,
- **Then** the component remains usable,
- **And** no raw repository error or unsafe content is exposed to the user.

### Given a help key is renamed

- **When** a user or component requests the former stable key,
- **Then** the index resolves the alias or redirect to the replacement key for the documented compatibility period.

### Given a help key is removed from official content

- **When** a user or component requests the removed key,
- **Then** the system shows an explicit unavailable state or documented redirect,
- **And** it does not silently serve an unrelated topic.
