# Business Requirements Document: Organization-Level Security Master

## Status

- Readiness: Ready for implementation planning
- Owner: TBD
- Date: 2026-09-26
- Document type: Draft BRD

## Summary

Provide end users a way to create and maintain an organization-specific, curated database of securities. Users can browse, search, add, edit, deactivate, reactivate, and safely delete records. The Security Master is intended to be the canonical source of security records that future P/OS features can reference.

This document defines the business need and MVP outcomes. It does not select a database schema, API, or user-interface design.

## Business objective

Enable users to maintain one trusted, organization-owned list of securities for use across P/OS features, instead of each feature maintaining its own independent list of ticker symbols.

## Problem / opportunity

Users need a curated set of securities relevant to their own workflows. Without a shared Security Master, future features may create inconsistent or duplicate security data, and users lack a straightforward way to maintain their own list.

## Desired outcomes

- Users can maintain their organization's securities through create, read, update, deactivate, reactivate, and safe delete actions.
- Users can quickly find and review records in the organization's list.
- Future P/OS features can refer to a security by a stable record identity rather than relying only on a ticker string.
- Organizations cannot view or change another organization's Security Master records.

## Scope

### Included in the initial release

- Browse and search/filter an organization's securities.
- Add and edit security records manually.
- Deactivate a security without deleting its record.
- Permanently delete a security when it is not referenced by another business record.
- Store the following business information:
  - Symbol
  - Type: `STOCK`, `ETF`, `INDEX`, or `OTHER`
  - Name
  - Description
  - Exchange (optional)
  - Exchange selected from a fixed dropdown: blank, NYSE, NASDAQ, AMEX, LSE, TSX, or Other
  - Sector
  - Industry
  - Active/inactive status
- Associate each record with its owning organization.
- Provide a stable record identity for future features to reference.
- Record normal creation and update timestamps.
- Allow every member of an organization to view and manage its securities.

### Deferred

- Importing records from a P/OS or GitHub catalog.
- Spreadsheet upload or import.
- Copy/paste or AI-assisted import.
- AI-generated sector or industry classification suggestions; AI integration is deferred to a future phase.
- An Exchange Master database table or authoritative, complete exchange catalog.
- Referencing Security Master records from experiments or other future features.
- Licensed or authoritative GICS data and official GICS classification.

## Non-goals

- External or automatic security-data sourcing.
- Prices, broker integrations, options contracts, earnings, fundamentals, or positions/holdings.
- Market-data synchronization or CUSIP, ISIN, or FIGI integration.
- Modeling options contracts as Security Master records. Future option contracts should refer to their underlying security.

## Functional requirements

1. The application must let an authorized user view securities belonging to their organization.
2. Users must be able to search the list by symbol or name, filter by active status, type, and exchange, and review useful identifying and classification information. Opening a security must show its read-only details in two-column label/value rows, with bold labels in the first column. Description line breaks must be preserved; created and updated timestamps appear together at the bottom in smaller secondary text.
3. Users must be able to add and edit securities manually.
4. Exchange must remain optional and use a closed dropdown with the choices blank, NYSE, NASDAQ, AMEX, LSE, TSX, and Other. Users cannot enter arbitrary exchange values. The choices are an initial convenience set, not an authoritative or complete venue catalog. “Other” is a selectable value and does not open a custom text-entry field.
5. Only the symbol is required when creating a security. Other fields, including exchange, name, description, sector, and industry, may be left blank.
6. Sector and industry are optional free-text fields that users can enter or edit. They are P/OS classifications, not official, licensed, or authoritative GICS data. A classification-source field is not required.
7. Users must be able to mark a security inactive. Inactivation must preserve the record and must not be treated as permanent deletion.
8. Inactive securities must remain reviewable and editable. Users must be able to reactivate them. Whether they are selectable in future feature workflows is outside this release.
9. Users must be able to permanently delete a security if no other business record references it. A deletion must not cascade to delete dependent business records.
10. If another business record references a security, permanent deletion must be blocked, and the user must receive a clear explanation. Inactivation remains available.
11. Security records must belong to exactly one organization for the purposes of access and maintenance. Every organization member has equal permission to view and manage that organization's securities.
12. A future P/OS feature must be able to identify a security record by a stable record identity.
13. Duplicate handling must prevent accidental duplicate listed instruments within an organization. A security represents a listed instrument; its identity for duplicate prevention is organization + normalized symbol + exchange. A blank exchange is a distinct exchange value: within an organization, only one record may have a given normalized symbol with a blank exchange, and it may coexist with records having the same normalized symbol and a specified exchange. Each dropdown choice, including Other, participates in this same normalized symbol + exchange uniqueness rule.
14. Security records must include normal creation and update timestamps.
15. The read-only security detail header must show Symbol - Name - Active/Inactive together on one line where space allows. Details must arrange each field as a compact two-column label/value row, with clear bold labels in a narrow first column and values in the second. A subtle hover highlight must help track rows without implying that they are interactive. Description line breaks must be preserved. Created/updated timestamps appear together at the bottom in smaller secondary text.
16. Saving or canceling an edit must return the user to that security's read-only detail view, preserving the validated originating list context for a subsequent return to the list. Canceling creation returns to the list.
17. A new-security form must not be prefilled with default or previously edited values; optional fields, including Type, start blank.
18. Search, Status, Type, and Exchange filters must align in one row at wide desktop widths and adapt responsively at smaller widths. Exchange filtering must use a dropdown with the initial supported exchange choices, preserve the existing URL/API string-filter contract, and retain an unlisted current URL value as a labelled option. The Status filter defaults to Active; users can choose All or Inactive. Below the grid, a status line shows how many securities match the current filters and the organization's total number of securities (the list API returns `totalCount` alongside the filtered results).

## Constraints / applicable ADRs

- Organization ownership and access are required business constraints. Protected reads and writes must follow [ADR 0001: Require direct organization scoping for protected backend data access](../ADRs/0001-organization-aware-data-access.md).
- Deletion of referenced securities must follow [ADR 0016: Restrict deletion of referenced securities](../ADRs/0016-restrict-deletion-of-referenced-securities.md): block deletion while references exist and never cascade-delete dependent business records.
- Profile deletion and backup guidance in ADR 0014 concerns profile-related data lifecycle and does not directly apply to this organization-owned feature.

## UX handoff context

- Detailed user journeys, routes, state handling, accessibility, responsive behavior, and the API-facing workflow contract are in the [Security Master UX flow](../uxd/flows/0008-security-master.md).
- **Target users:** End users who want to curate the securities relevant to their own P/OS organization.
- **User goals:** Maintain the list; find and review securities; keep records current; stop using a security without losing its record.
- **Core workflow intent:** Browse/search the organization's list, then add, inspect, edit, deactivate/reactivate, or delete a record.
- **Permissions and visibility:** Every organization member can manage that organization's records. No member can see or modify records belonging to another organization.
- **Content and terminology:** Use “Security Master” for the curated list. Exchange is optional and selected from the initial fixed dropdown choices (blank, NYSE, NASDAQ, AMEX, LSE, TSX, or Other); users cannot enter custom values. Do not imply that the choices are a complete or authoritative venue catalog. Preserve an existing unlisted exchange value when editing a legacy record unless the user explicitly selects a listed choice. Sector and industry are optional free-text P/OS classifications, not official GICS data. AI classification suggestions are deferred to a future phase. “Inactive” means retained but no longer active; it is distinct from deletion.
- **Navigation:** Place the initial feature as a flat **Security Master** link under **System**. A future navigation update may group it under **System → Master Data → Securities**; use “Securities,” not “Symbols,” because records include more than ticker strings.
- **Known edge cases:** Same symbols can occur on different exchanges; exchange is optional; some security types may not have a conventional exchange; the fixed initial choices may not represent every venue; existing unlisted exchange values must not be silently overwritten during edits; a security may later be referenced by an experiment or other dependent record.
- **Business constraints:** Initial records are manually entered. The dropdown choices are not an Exchange Master and must not be treated as an external or authoritative catalog. No custom exchange entry, AI integration, external catalog, import workflow, or market-data source is required in this phase.
- **Success criteria:** Users can complete the in-scope maintenance actions and find records in their organization's list without exposing another organization's data.

## Assumptions

- The initial release supports create, read, update, inactivation/reactivation, and permanent deletion when no dependent business records reference the security.
- Every record has a stable identity independent of its symbol, since symbols and other descriptive attributes may change.
- Only symbol is required. Exchange and other descriptive and classification fields are optional.
- Exchange is selected from a fixed initial dropdown of blank, NYSE, NASDAQ, AMEX, LSE, TSX, and Other. There is no custom entry field; “Other” is a value, not a path to enter one. Preserve pre-existing unlisted exchange values during editing unless the user explicitly chooses a dropdown value.
- Every organization member can manage its organization's securities.
- AI classification suggestions are not part of this phase.
- Permanent deletion is allowed only when no dependent business records reference the security. Deletion never cascades to dependent business records.
- Duplicate identity is organization + normalized symbol + exchange for listed instruments; blank exchange is treated as a distinct value and permits one blank-exchange record per normalized symbol per organization.

## Open questions

No product-level questions block planning for this phase. The exact normalization rules for symbol and exchange (including casing and whitespace handling) remain an implementation decision for database/API design and must be applied consistently.

## Definition of done

- The organization can maintain a curated list using create, read, update, deactivate/reactivate, and safe permanent-delete actions.
- Users can search by symbol or name and filter by active status, type, and exchange.
- Exchange remains optional and is selected from the fixed initial choices blank, NYSE, NASDAQ, AMEX, LSE, TSX, and Other. The dropdown does not accept custom entry and is not an Exchange Master or authoritative venue catalog; existing unlisted values are not silently overwritten during editing.
- Business identity and duplicate-prevention rules are agreed and reflected in acceptance criteria.
- Organization visibility and equal member management permissions are defined.
- Sector and industry are free-text P/OS classifications and are not represented as official GICS data.
- The behavior for inactive securities and referenced-security deletion is clear.
- UXD has the product context and unresolved decisions needed to design the workflow.

## Acceptance criteria

1. An organization member can view and search their organization's Security Master by symbol or name and filter by active status, type, and exchange.
2. Any organization member can create and edit a security; only symbol is required.
3. Exchange is optional and uses a closed dropdown with blank, NYSE, NASDAQ, AMEX, LSE, TSX, and Other choices; users cannot type custom values.
4. Dropdown choices are an initial convenience set, not a complete or authoritative venue catalog, and no Exchange Master database table is added in this phase. Existing unlisted stored values are preserved during edit unless the user explicitly selects a listed choice.
5. Sector and industry can be entered and edited as optional free text, without being represented as official or licensed GICS values.
6. A user can mark a security inactive, edit it, reactivate it, and review it while inactive.
7. A user can permanently delete a security that has no dependent business records. Deletion is blocked when references exist, with a clear explanation; dependent records are never cascade-deleted.
8. A user cannot view or modify another organization's security records.
9. Duplicate handling follows the organization + normalized symbol + exchange identity rule; one blank-exchange record may coexist with specified-exchange records for the same normalized symbol, but not another blank-exchange record. Each dropdown value, including Other, participates in this rule after normalization.
10. A security can be referenced by a stable record identity for future P/OS features.
11. No AI integration, external catalog, spreadsheet import, AI-assisted import, broker integration, or market-data dependency is required in this phase.

## Readiness

**Ready for implementation planning.** The business goals, CRUD lifecycle, organization permissions, required field, optional Exchange dropdown choices (including Other), free-text classification fields, duplicate behavior for blank exchange, and initial System navigation placement are defined. Custom exchange entry, an Exchange Master, and an authoritative venue catalog are out of scope. Exact symbol/exchange normalization is an implementation decision that must be resolved consistently during database/API design. AI classification suggestions and AI service integration are explicitly deferred.
