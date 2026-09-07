# Debugging Log: 0007 In-App Help System

- Spec: [0007-help-system](../specs/0007-help-system.md)
- Plan: [0007-help-system](../plans/0007-help-system.md)
- Content guide: [0007-help-system-content-guide](../specs/0007-help-system-content-guide.md)
- Status: active

## Reusable lessons

- **Content path is repo-root, not `docs/`-prefixed:** The backend's allowlist and index fetch (`apps/api/src/lib/helpContent.ts`) only recognize `content/help/...` at the repository root. Content pushed to `docs/content/help/...` is silently invisible to the application — it is not an error anywhere, it is just never fetched. Always verify new/edited help files land at the exact repo-root path documented in [0007-help-system-content-guide.md](../specs/0007-help-system-content-guide.md).
- **`index.json` is fetched first and must exist on `main` as a whole unit:** Editing or adding a single page/tooltip file on `main` is not sufficient. If `content/help/index.json` itself (or any file it references) is missing from `main`, the entire refresh fails before your specific content is ever reached — even if your specific file is present and correct.
- **A "failed" refresh does not mean content was lost:** Per the T-02.1/T-02.2 preservation design, a failed or invalid refresh attempt updates only `lastDownloadAttemptAt`/`refreshStatus` and never overwrites the last valid cached payload. `freshness: "unavailable"` combined with `refreshStatus: "failed"` and `fetchedAt: null` specifically indicates there has never yet been a successful fetch for this environment (not that previously-good content was wiped).
- **Verify raw GitHub content directly when diagnosing:** Fetching `https://raw.githubusercontent.com/pagalvin/portfolio-engineering/main/content/help/index.json` (or an equivalent read of `main`'s tree) is the fastest way to confirm what the backend actually sees, independent of what a local working tree or an editor's view of `main` implies.
- **Local untracked directories are fragile during multi-step file operations:** When reconstructing or relocating files across worktrees/temp directories in the same session, verify the working directory before any destructive command (e.g., `Remove-Item -Recurse -Force`); a cwd assumption carried over from a prior command in a different tool call deleted an untracked `content/` folder mid-fix in this session. It was fully recoverable only because its contents had been viewed and could be reconstructed from session context — this will not always be true.

## Issue history

### 001: Help refresh fails with `refreshStatus: "failed"`, `freshness: "unavailable"`, `fetchedAt: null` after editing content via GitHub UI

- **Date:** 2026-09-07
- **Status:** resolved
- **Environment:** runtime (production content on `main`, consumed by dev/local backend)
- **Severity:** major (blocks all Help content updates from ever reaching users)
- **Reported behavior:** User edited `content/help/pages/portfolio/overview.md` directly via the GitHub web UI and clicked **Refresh help content** in Preferences. The API returned `{"freshness":"unavailable","refreshStatus":"failed","fetchedAt":null,"lastDownloadAttemptAt":"<timestamp>"}` instead of picking up the new content.
- **Evidence and reproduction:**
  - First report: user's edited file was actually committed to `docs/content/help/pages/portfolio/overview.md` (confirmed via `git ls-tree -r origin/main --name-only`), not the repo-root `content/help/pages/portfolio/overview.md` the backend's `sourceUrl()` allowlist and `INDEX_PATH` require.
  - After the user corrected the path and re-edited the correct repo-root file, the refresh still failed. Investigation via `git ls-tree -r origin/main -- content/help` showed `main` contained only `content/help/pages/portfolio/overview.md` — `content/help/index.json`, `content/help/pages/portfolio.md`, and `content/help/tooltips/portfolio.performance.txt` (all referenced by the index) had never been pushed to `main` at all. A direct fetch of `https://raw.githubusercontent.com/pagalvin/portfolio-engineering/main/content/help/index.json` returned HTTP 404, confirming `loadRemoteHelpContent` in `apps/api/src/lib/helpContent.ts` fails at its very first fetch, before ever reaching the (correctly located) overview page.
- **Affected areas:** `apps/api/src/lib/helpContent.ts` (`loadRemoteHelpContent`, `sourceUrl`, `INDEX_PATH`), `apps/api/src/plugins/help.ts` (`/api/help/status`, `/api/help/refresh` metadata derivation), `content/help/**` on `main`.
- **Contract and ADR review:**
  - [ADR 0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md): confirms `main`, repo-root allowlisted paths, and preserve-last-valid-cache-on-failure are all working as designed; this was a content/publishing gap, not a violation of the ADR.
  - [Spec 0007 §1.2, §8.5, §8.9](../specs/0007-help-system.md): backend fetch and preservation-on-failure behavved exactly as specified; no spec drift found.
- **Root cause:** Two independent, sequential content-publishing mistakes, not a code defect:
  1. Content was initially pushed to `docs/content/help/...` instead of the repo-root `content/help/...` path the backend expects.
  2. After correcting the path for the one edited file, the supporting `index.json`, parent page, and tooltip file that the index references had still never been pushed to `main` at all, so the index fetch itself 404'd.
- **Resolution:** Pushed the complete `content/help/` tree (`index.json`, `pages/portfolio.md`, `tooltips/portfolio.performance.txt`) to `main` directly (commit `e9165a6`), leaving the user's existing `pages/portfolio/overview.md` edit untouched. Verified `https://raw.githubusercontent.com/pagalvin/portfolio-engineering/main/content/help/index.json` returns the expected JSON after the push.
- **Verification:** Confirmed the raw GitHub fetch of `content/help/index.json` succeeds post-push. User was instructed to re-click **Refresh help content**; expected result is `refreshStatus: "success"` with a populated `fetchedAt`.
- **Follow-up:**
  - [x] Documented the correct publishing path and full-tree requirement in [0007-help-system-content-guide.md](../specs/0007-help-system-content-guide.md).
  - [x] Added [ADR 0015](../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md) to require Help content review whenever a feature it describes changes, reducing the chance of future silent drift (a related but distinct risk from this specific publishing-path incident).
  - [ ] Plan 0007's Revisions table should note this incident and the direct-to-`main` content push, since it happened outside the normal task/PR flow (recommended for T-05.2 closeout).
