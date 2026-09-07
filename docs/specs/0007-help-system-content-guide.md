# How to manage help content

- Spec: [0007-help-system](./0007-help-system.md)
- ADR: [0009-use-github-repo-sourced-runtime-content](../ADRs/0009-use-github-repo-sourced-runtime-content.md)
- Audience: anyone publishing or editing official in-app Help content

This guide explains how official Help content is organized, how to add or edit
it, and how to verify a change actually reaches the running application.

## Where content lives

Official Help content is stored at the **repository root**, not under `docs/`:

```text
content/help/
  index.json
  pages/
    <topic-path>.md
  tooltips/
    <tooltip-key>.txt
```

⚠️ **Common mistake:** placing files under `docs/content/help/...` instead of
the repo-root `content/help/...`. The backend only fetches from the
repo-root path. A file added at the wrong path will not 404 loudly in the UI —
it simply never gets served, and depending on what's missing, a refresh may
fail entirely (see [Verifying a change](#verifying-a-change)).

## How content is loaded

Per [ADR-0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md), the backend:

1. Fetches `content/help/index.json` from the raw GitHub URL for this
   repository's `main` branch.
2. Parses and validates the index against the shared Zod schema.
3. For every `active` entry eligible for the current app version, fetches the
   referenced Markdown or plain-text file from `main`.
4. Validates the full payload (safe Markdown, plain-text tooltip rules, no
   duplicate/missing paths).
5. On success, caches the validated payload in the database (global/system
   scope, no organization data) and records `fetchedAt`.
6. On failure (network error, 404, invalid content), the last valid cached
   payload is preserved and only the failed-attempt timestamp/status is
   updated. If there has never been a valid cache, the bundled fallback
   content is served instead.

Nothing is fetched directly by the frontend — it always reads through the
authenticated backend APIs (`/api/help/index`, `/api/help/topics/:helpKey`,
`/api/help/status`).

## Adding a new help page

1. Add an entry to `content/help/index.json`:
   ```json
   {
     "key": "help.portfolio.overview",
     "title": "Portfolio overview",
     "type": "page",
     "path": "content/help/pages/portfolio/overview.md",
     "group": "Portfolio",
     "parentKey": "help.portfolio",
     "order": 10,
     "minAppVersion": "1.0.0",
     "aliases": [],
     "status": "active"
   }
   ```
   - `key` must be globally unique and stable — components and links depend on
     it, not on the file path.
   - `path` must match the allowlisted pattern
     `content/help/(pages|tooltips)/....(md|txt)` at the repo root.
   - `group` should be one of the current global navigation groups
     (`Portfolio`, `Execution`, `Risk`, `Learning`, `System`) so the topic
     appears in the right place on the master Help page.
   - `parentKey` is optional and nests the topic under another page entry.
2. Create the Markdown file at the exact `path` you referenced, at repo root
   (e.g. `content/help/pages/portfolio/overview.md`).
3. Commit and push both files together to `main`.

## Adding a new tooltip

1. Add an index entry with `"type": "tooltip"` and a `.txt` path under
   `content/help/tooltips/`.
2. Create the plain-text file. Tooltips are **not** Markdown — no formatting
   syntax will be rendered, and unsafe/control characters are rejected by
   validation.
3. Optionally set `relatedPageKey` to link the tooltip to a long-form topic.

## Editing existing content

Edit the Markdown or text file in place and push to `main`. You do not need to
change the index unless you are renaming the key, changing hierarchy/order, or
changing `minAppVersion`.

## Renaming or removing a key

- **Renaming:** add the old key to the new entry's `aliases` array, or add a
  separate index entry with `"status": "redirect"` and
  `"replacementKey": "<new-key>"`. Do not just delete the old key — that
  would silently serve nothing for old links.
- **Removing:** set `"status": "unavailable"` on the entry rather than
  deleting it from the index.

## Verifying a change

1. Confirm both the index entry and the referenced file exist at the
   repo-root `content/help/...` path on `main` (not `docs/content/help/...`).
2. In the app, go to **Settings → Preferences** and use **Refresh help
   content**.
3. Check the response/status:
   - `refreshStatus: "success"` and a populated `fetchedAt` mean the fetch,
     validation, and cache write all succeeded.
   - `refreshStatus: "failed"` with `fetchedAt: null` most often means
     `content/help/index.json` itself couldn't be fetched or parsed (for
     example, because it's missing from `main` or was pushed to the wrong
     path). Failure preserves the last valid cache by design — nothing is
     lost, but your new content will not be visible until the underlying
     fetch succeeds.
4. If you still don't see your change after a successful refresh, confirm the
   entry's `minAppVersion` is not higher than the app's current effective
   version (`1.0.0` by default).

## Content rules enforced by validation

- Long-form pages must be Markdown; tooltips must be plain text.
- Markdown must not contain `<script>`, `<iframe>`, `javascript:`/`data:`/
  `vbscript:` links, or non-allowlisted image/link targets.
- Images must be served from this repository's raw GitHub content URLs.
- The index and content payload each have a maximum size; oversized content is
  rejected.
- Every `active` entry's `path` must be unique; duplicate or missing paths
  fail validation for the whole payload, not just the offending entry.

## Related documents

- [Spec 0007: In-App Help System](./0007-help-system.md)
- [ADR 0009: Use GitHub repo-sourced runtime content](../ADRs/0009-use-github-repo-sourced-runtime-content.md)
- [Plan 0007: In-App Help System](../plans/0007-help-system.md)
