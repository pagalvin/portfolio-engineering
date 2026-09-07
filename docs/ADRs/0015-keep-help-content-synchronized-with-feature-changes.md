# ADR 0015: Keep help content synchronized with feature changes

- Status: draft
- Date: 2026-09-07
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Adding a new feature, route, or UI surface that has (or should have) an associated Help topic or tooltip.
- Changing the behavior, terminology, workflow, or UI of a feature that already has an associated Help topic or tooltip.
- Removing, renaming, or relocating a feature, route, or UI surface referenced by a Help topic key.
- Reviewing a merge or PR that changes product behavior in an area covered by `content/help/`.
- Not applicable to purely internal refactors, styling-only changes, or bug fixes that do not change user-facing behavior, terminology, or workflow.

## Context

- The in-app Help system ([spec 0007](../specs/0007-help-system.md), [ADR 0009](./0009-use-github-repo-sourced-runtime-content.md)) sources official content from `content/help/` on `main`, validates it server-side, caches it, and serves it through authenticated APIs with a bundled fallback.
- Help content is keyed by stable `help.*` keys rather than by file path, and topics are organized around the same global navigation groups used by the application shell (see [scaffoldRoutes.ts](../../apps/frontend/src/scaffoldRoutes.ts)).
- Nothing currently requires a feature change to be reflected in its associated Help content. A feature's behavior, terminology, or workflow can change while its Help topic or tooltip continues to describe the old behavior indefinitely.
- Stale Help content is a silent-drift risk: unlike a broken build or a failing test, incorrect Help text does not surface as an error anywhere in the system. Users may be actively misled by documentation that no longer matches the product.
- A related governance pattern already exists for profile lifecycle changes ([ADR 0014](./0014-require-delete-backup-review-for-profile-related-data.md)), which requires a review gate whenever a class of change (profile-scoped data) has a known drift risk (delete/backup coverage). This ADR applies the same governance shape to a different risk: feature/Help content drift.
- A companion runbook, [How to manage help content](../specs/0007-help-system-content-guide.md), documents the mechanics of editing `content/help/` but does not establish an obligation to do so when a feature changes.

## Decision Statement

Any change that adds, modifies, or removes user-facing feature behavior, terminology, or workflow MUST include a review of its associated official Help content (long-form pages and tooltips). If the feature has no associated Help content yet and the change is user-facing, the change SHOULD add or update the Help index and content to reflect the new reality, or explicitly document why Help coverage is deferred.

## Decision Drivers

- **User trust:** Help content that contradicts the running application is worse than no Help content, because it actively misleads users.
- **Low detectability:** Unlike code or schema drift, Help drift produces no build failure, test failure, or runtime error. It must be caught by process, not tooling, in the initial implementation.
- **Existing authoring path is proven and cheap:** [0007-help-system-content-guide.md](../specs/0007-help-system-content-guide.md) already documents a lightweight edit-and-push workflow; this ADR adds an obligation to use it, not new tooling.
- **Consistency with existing governance patterns:** The repository already uses ADR-driven review gates ([ADR 0014](./0014-require-delete-backup-review-for-profile-related-data.md)) for other classes of silent drift risk.
- **Feature velocity:** The review must stay lightweight enough not to meaningfully slow down feature delivery.

## Options Considered

### Option A: Require a Help-content review as part of every user-facing feature change (Selected)

- Add this ADR as a repository policy: any PR or task that changes user-facing feature behavior, terminology, or workflow must check whether an associated Help topic or tooltip exists and needs updating.
- If Help content exists and is now inaccurate, update it in the same change where practical, or record a documented, owned follow-up.
- If Help content does not exist yet for a user-facing feature, adding it is encouraged but not always mandatory in the same change; the decision to defer must be explicit rather than silent.
- Low process overhead; reuses the existing content-authoring workflow and path conventions.

### Option B: Leave Help content synchronization implicit and rely on author memory

- No explicit policy; each feature change may or may not consider its Help content.
- Lowest short-term overhead, but highest risk of accumulating silently stale or misleading Help content over time, with no mechanism to detect it.
- Inconsistent with how the repository already treats comparable drift risks (see ADR 0014).

### Option C: Automatically block merges when a feature-associated route or component changes without a corresponding Help content diff

- Would require tooling to map code changes to Help keys (e.g., a manifest linking routes/components to `help.*` keys) and CI enforcement.
- Strongest guarantee of synchronization, but requires new tooling, a formal route-to-help-key manifest, and CI wiring that does not exist today.
- Not justified at the current repository maturity; revisit if manual review proves insufficient or if the Help index grows large enough that manual tracking becomes unreliable.

## Chosen Approach and Rationale

We will adopt Option A.

This ADR does not require new tooling, a manifest, or CI enforcement. It requires a review habit: whenever a change alters user-facing feature behavior, terminology, or workflow, the change's author (human or agent) must answer:

1. Does this feature have an associated Help topic or tooltip today (check `content/help/index.json` for a `help.*` key referencing this area, and the `group`/`parentKey` hierarchy aligned to `scaffoldRoutes.ts` navigation groups)?
2. If yes, does the change make that Help content inaccurate, incomplete, or outdated? If so, update it using the workflow in [0007-help-system-content-guide.md](../specs/0007-help-system-content-guide.md) and push the update to `main` in the same change where practical.
3. If the feature has no Help content yet and the change is user-facing, should Help content be added now, or is it explicitly and reasonably deferred? Record the decision rather than leaving it unstated.

This mirrors the low-cost, high-protection shape of [ADR 0014](./0014-require-delete-backup-review-for-profile-related-data.md) applied to a different drift risk, and keeps the burden proportional to the size of the Help content surface, which is still small.

## Consequences and Tradeoffs

### Positive

- Prevents silent accumulation of inaccurate or misleading Help content as features evolve.
- Keeps Help content changes co-located with the feature changes that motivate them, improving reviewability.
- Reuses the existing, already-documented content-authoring workflow with no new tooling cost.
- Establishes an explicit, checkable expectation instead of relying on incidental memory.

### Negative

- Adds a small review step to feature changes in areas with (or that should have) Help coverage.
- Requires discipline; a skipped review can still let drift occur, since this is a process control rather than an automated one.
- Does not, by itself, detect existing stale Help content created before this ADR; a backlog of pre-existing drift may still need a separate cleanup pass.
- No automated mapping from code changes to Help keys exists yet (see Option C); reviewers must manually check the index for relevant entries.

## Guidance for Relevant Audiences

### Architect agents

- Treat Help-content accuracy as part of the definition of done for user-facing feature work, not a separate, optional documentation task.
- When designing a new feature area, consider whether it needs a `help.*` index entry as part of the initial design, not as an afterthought.
- When reviewing specs or plans, flag user-facing changes that lack any mention of associated Help content impact.

### Coding agents

- Before or immediately after implementing a user-facing feature change, search `content/help/index.json` for entries whose `group`, `parentKey`, or `key` correspond to the changed area.
- If a matching entry exists and the change affects what it describes, update the referenced Markdown or tooltip file using [0007-help-system-content-guide.md](../specs/0007-help-system-content-guide.md) and push the update to `main` alongside the feature change where practical.
- If no matching entry exists and the change is user-facing, add one when reasonably scoped, or note in the task/plan that Help coverage is intentionally deferred and why.
- Do not assume an absent Help update is safe by default; treat silence as a gap to be explicitly resolved, not implicitly accepted.

### Testing agents

- When verifying a user-facing feature change, include a check for whether associated Help content (if any) still accurately describes the new behavior.
- Treat clearly stale Help content discovered during testing as a defect to report, even if it is not the primary subject of the test.
- Do not require new automated tests asserting Help/feature parity in the initial implementation of this ADR; this is a review-time and content-authoring concern, not a runtime-testable one, unless a future decision introduces a route-to-help-key manifest (see Option C).

### Humans

- Treat outdated Help content as a product-quality defect, not a low-priority documentation nit.
- When reviewing a PR that changes user-facing behavior, ask whether the associated Help topic or tooltip was reviewed and, if needed, updated.
- Use [0007-help-system-content-guide.md](../specs/0007-help-system-content-guide.md) for the mechanics of making the edit and verifying it reached `main`.

## Do

- Check `content/help/index.json` for an associated Help topic or tooltip whenever a user-facing feature changes.
- Update the associated Markdown page or tooltip text when the feature change makes it inaccurate, incomplete, or outdated.
- Push Help content updates to `main` using the correct repo-root `content/help/` path, per [0007-help-system-content-guide.md](../specs/0007-help-system-content-guide.md).
- Explicitly record a decision to defer adding new Help coverage for a user-facing feature that does not yet have any, rather than leaving the gap unstated.
- Keep Help-content review part of code review discussion for user-facing changes in areas with existing Help coverage.

## Do Not

- Do not ship a user-facing behavior, terminology, or workflow change while leaving an existing, now-inaccurate Help topic or tooltip unchanged without an explicit, documented reason.
- Do not silently delete or repurpose a `help.*` key's meaning; use `aliases` or `status: "redirect"`/`"unavailable"` per the index rules in [spec 0007](../specs/0007-help-system.md).
- Do not treat Help content updates as out-of-scope busywork disconnected from the feature change that necessitates them.
- Do not add new automated enforcement tooling (e.g., a route-to-help-key manifest or CI gate) under this ADR without a separate decision, per Option C.
