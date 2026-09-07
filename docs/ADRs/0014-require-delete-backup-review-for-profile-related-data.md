# ADR 0014: Require delete/backup review whenever profile-related data model changes

- Status: draft
- Date: 2026-09-06
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Adding a new table, relation, or persisted record that belongs to a profile or user lifecycle.
- Changing or extending a profile deletion workflow or backup export contract.
- Modifying the schema for journal, investor profile, settings, or other profile-scoped content.
- Reviewing a merge or PR that changes the user/profile data model.
- Not applicable when the change is unrelated to profile lifecycle, backup/export, or data destruction semantics.

## Context

- The profile deletion workflow now includes a backup-before-delete export and a cascade delete for the current profile, associated journal entries, and related profile data.
- The current implementation is correct for the known model and includes a self-describing, versioned JSON backup contract in [0006-profile-deletion-and-backup.md](../specs/0006-profile-deletion-and-backup.md), backed by the store logic in [authStore.ts](../../packages/database/src/authStore.ts) and the UI in [DeleteProfileDialog.tsx](../../apps/frontend/src/components/DeleteProfileDialog.tsx).
- Future product work will add more profile-scoped content and more nested data objects under the same user profile.
- Without a formal review gate, new child tables or profile metadata can be created without being included in the export backup or the delete cascade.
- This creates a silent data-loss risk: a profile may look safe to delete because the main flow is present, while a newly added profile-scoped model is silently left behind or omitted from the backup.
- The repository already uses explicit ADR review patterns and closeout governance to catch architectural gaps after implementation. This decision formalizes the same principle for profile lifecycle changes.

## Decision Statement

Any change to the profile-related data model requires a delete/backup review before merge. The review must confirm that every profile-scoped record is included in the backup export payload and in the delete path, or else the change is out of compliance with this ADR.

## Decision Drivers

- **Data safety:** Profile deletion is permanent and must not leave orphaned records or missing backup coverage.
- **Process reliability:** Future feature work should not depend on memory or implicit assumptions about what belongs to a profile.
- **Governance:** Architectural and code review must include lifecycle impact checks for destructive operations.
- **Import/restore readiness:** A backup must remain interpretable and reconstructable with enough metadata to support future restore flows.
- **Tenant correctness:** Profile data remains scoped to the owning organization and user, so the review must ensure scoping is preserved even as new data is added.

## Options Considered

### Option A: Require explicit delete/backup review on every profile-scoped data change (Selected)

- Add this ADR as a repository policy for profile lifecycle changes.
- Require PR reviewers or implementing agents to confirm that the profile backup contract and cascade delete logic are reviewed whenever a new profile-associated model is introduced.
- Keep the review lightweight but mandatory: check the new model, check the backup payload, check the delete path, and document the outcome.
- This keeps the burden low while preventing silent drift.

### Option B: Leave delete/export coverage implicit and rely on implementation memory

- No explicit policy; each feature team notices or misses the issue individually.
- Lower short-term process overhead, but high risk of missing future profile child data.
- Produces inconsistent backup coverage and poor long-term maintainability.

### Option C: Add a fully centralized, auto-generated delete/export registry

- Build a framework or generic system that enumerates all profile-owned models automatically.
- Strong long-term design, but higher implementation complexity, migration risk, and upfront cost for a project that is still evolving.
- Not necessary for the current repository maturity and product velocity.

## Chosen Approach and Rationale

We will adopt Option A.

This ADR does not require a heavy framework or a global schema registry. It requires a clear rule: any new profile-scoped entity triggers a review of the profile delete/export contract before merge. That review must answer three questions:

1. Is this new data owned by a profile?
2. Is it included in the generated backup payload and metadata manifest?
3. Is it removed by the profile delete path, or explicitly excluded with a documented reason and a safe migration strategy?

This is the lowest-cost, highest-protection rule for the current codebase. It fits the repository's governance model and matches the already established closeout pattern of recording implementation lessons and future guardrails in ADR recommendations and tech debt tracking.

## Consequences and Tradeoffs

### Positive

- Prevents silent data loss when new profile-related data models are added.
- Keeps the export format and delete semantics aligned with product evolution.
- Reduces future restore/import ambiguity by preserving the requirement to describe backup sections and metadata.
- Makes profile lifecycle work more reviewable and easier to reason about for both humans and coding agents.

### Negative

- Adds a small review overhead for every profile-scoped change.
- Requires discipline and review consistency; a skipped review can still create risk.
- Some models may legitimately be excluded from backup or delete operations, but those exclusions must be explicit and well documented.

## Guidance for Relevant Audiences

### Architect agents

- Treat profile lifecycle integrity as a first-class architectural concern.
- When introducing a new profile-scoped type, verify that the backup payload schema, delete logic, and metadata manifest are updated or intentionally documented as out-of-scope.
- Prefer explicit review notes in PRs or ADR follow-up files when the change intentionally excludes a child model.

### Coding agents

- Before adding a new profile-owned table or relationship, check whether the profile delete/export flow needs to include it.
- Update or extend backup aggregation code and delete cascade behavior together.
- If the model is intentionally not backed up or not deleted, record that in a human-readable rationale and tests.
- Do not rely on the current profile delete path as a “known good” default for future tables.

### Testing agents

- Add or update regression tests for any profile-scoped change to prove:
  - the entity is included in the exported backup payload when expected,
  - the profile delete flow removes it when expected,
  - cross-organization scoping remains enforced,
  - rollback/atomicity remains intact for destructive operations.
- Treat delete/export completeness as a core acceptance criterion for profile lifecycle work.

### Humans

- Treat profile deletion as a destructive operation with no room for implicit assumptions.
- Ask whether a newly added profile-scoped feature needs either backup coverage or a documented delete exemption before sign-off.
- Use the ADR as a reminder that a delete path must be reviewed alongside schema growth.

## Do

- Require a delete/backup review for every new profile-owned table, relation, or persisted entity.
- Confirm that the backup payload includes all relevant sections and metadata descriptions.
- Confirm that the profile delete transaction removes all related rows or intentionally documents an exclusion.
- Add tests for cascade delete and export coverage when a profile-scoped model changes.
- Keep profile lifecycle decisions explicit in code review, ADR follow-up notes, or engineering documentation.

## Do Not

- Add a new profile-scoped model without checking whether backup/export coverage must change.
- Assume the current delete flow covers all future profile-related records.
- Merge profile lifecycle changes with destructive behavior that was not reviewed for export completeness.
- Treat backup metadata as optional if the data is user-owned and may later need restoration.

## Open Questions or Follow-Up Items

- Should the repository enforce this review gate with a checklist template or a contributor doc, or only via ADR governance and PR review?
- Should future restore/import work require an explicit schema-version compatibility matrix for profile backups?
- Should all profile-owned models be listed in a central inventory to simplify future delete/export validation?
- Does a future automated registry or lint rule make sense once the schema grows beyond the current proof-of-concept level?
