# 2026-07-26 UI Scaffold and Routing Closeout

## Closeout summary

This batch established URL-addressable scaffold navigation across major product areas, added ADR 0002 for routing continuity rules, introduced a machine-readable UI scaffold contract, seeded training and glossary placeholders, and aligned the UXD agent with session-level product decisions.

## README changelog updates

Updated [README.md](../../README.md) with three new 2026-07-26 changelog entries covering:

- ADR 0002 and routing continuity expectations
- the new route-based placeholder workspace scaffold
- the UI scaffold contract and semantic token foundation

## Schema documentation updates

- No schema changes were introduced in this batch.
- No updates were needed in [current.md](../schema/current.md).
- No schema snapshot was created because there was no database schema delta.

## Transient document review

| File | Recommendation | Reason |
| --- | --- | --- |
| [ui-scaffold-contract.json](../uxd/flows/ui-scaffold-contract.json) | keep active | This contract is now a canonical handoff artifact for coding-agent scaffold and IA work. |

## Documentation debt

- Add a short contributor-facing guideline that defines how glossary terms are reviewed and when training-link curation should be refreshed.
- Add explicit frontend routing notes in contributor docs after router-library migration so scaffold behavior and ADR 0002 expectations remain synchronized.

## Technical debt captured

- Added `TD-005` to track migration from manual History API handling to a first-class router integration while preserving ADR 0002 behavior guarantees.

## Checklist updates made

- Added `TD-005` in [checklist.md](../tech-debt/checklist.md).

## ADR recommendation updates made

- Added one `no action` recommendation confirming routing ADR coverage is currently sufficient.
- Added one `new ADR` recommendation for glossary terminology and curated training-source governance in [ADR Recommendations.md](../ADRs/ADR%20Recommendations.md).
