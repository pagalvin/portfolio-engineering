# ADR 0016: Restrict deletion of referenced securities

- Status: accepted
- Date: 2026-09-26
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Implementing permanent deletion of an organization-owned Security Master record.
- Adding or changing a relationship from another business record to a Security Master record.
- Reviewing deletion behavior for securities or records that reference securities.
- Not applicable to deactivating or reactivating a security, which preserves the record.

## Context

- The Security Master is the canonical organization-owned source of security records that future P/OS features, such as Experiments, may reference.
- The Security Master BRD allows permanent deletion when no other business record references the security. If references exist, deletion must be blocked and the user given a clear explanation; inactivation remains available. See [0008-organization-security-master.md](../specs/0008-organization-security-master.md).
- Cascading deletion from a security to dependent business records could silently destroy user-created data and is not an acceptable deletion behavior.
- The initial Security Master may have no dependent records, but deletion behavior must remain safe as references are introduced.
- Security records are organization-owned and must follow [ADR 0001: Require direct organization scoping for protected backend data access](0001-organization-aware-data-access.md).

## Decision Statement

Allow permanent deletion of a security only when no business records reference it. If one or more references exist, reject the deletion and explain that the security is in use; users may deactivate it instead. Never cascade deletion from a security to dependent business records.

## Do

- Preserve a stable security identity for references; do not use symbol, name, or exchange as a foreign-key substitute.
- Ensure every reference and deletion operation preserves organization ownership and isolation.
- Enforce the no-delete-while-referenced rule at the persistence boundary, using restrictive referential integrity or an equivalent mechanism that is safe against concurrent writes.
- Return a clear, actionable result when deletion is blocked because references exist, and leave the security and dependent records unchanged.
- Keep deactivation available as the non-destructive alternative; deactivation must not remove or invalidate existing references.
- When adding a new business-record relationship to a security, include coverage verifying that the relationship prevents security deletion.
- Test that an unreferenced security can be permanently deleted, a referenced security cannot be deleted, dependent records remain intact, and records in another organization do not affect the deletion decision.

## Do Not

- Do not cascade-delete, bulk-delete, or otherwise remove dependent business records when deleting a security.
- Do not implement the rule only as a frontend check or a non-atomic “check then delete” that can race with creation of a reference.
- Do not treat an inactive security as deleted or permit deletion merely because its references are inactive, archived, or otherwise not currently visible, unless a future ADR defines that lifecycle explicitly.
- Do not allow a reference in one organization to affect access to or deletion of a security in another organization.
- Do not silently report success when deletion was blocked or failed.
