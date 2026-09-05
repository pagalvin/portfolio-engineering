# ADR 0012: Defer WYSIWYG engine selection behind an owned Markdown editor component

- Status: accepted
- Date: 2026-09-05
- Supersedes: [ADR 0007](./0007-use-cwl-editor-behind-an-owned-markdown-editor.md)
- Audience: [architect-agents, coding-agents, testing-agents, uxd, humans]

## Applicable When

- Adding or changing a rich-text or WYSIWYG Markdown editing experience.
- Evaluating or selecting a WYSIWYG editor dependency.
- Creating a reusable application editor component or replacing its underlying editor engine.
- Deciding how a feature should present WYSIWYG editing while it remains unimplemented.
- Not applicable to a plain textarea used for direct Markdown authoring, or to the owned read-only Markdown viewer already in use.

## Context

- Markdown is the canonical application format for authoring, persistence, export, and reuse.
- [ADR 0007](./0007-use-cwl-editor-behind-an-owned-markdown-editor.md) previously selected CWL Editor as the engine. That selection is abandoned: the documented npm package was never published to the public registry, and the pinned source-build alternative proved impractical for a capability that remains deferred.
- No WYSIWYG engine was ever installed. There is no CWL, TipTap, ProseMirror, or Inkspan dependency in the workspace and no `vendor/inkspan` directory.
- The Journal shipped direct Markdown authoring, an owned `MarkdownViewer` built on `react-markdown`, and the shared planned-feature placeholder for WYSIWYG. That arrangement works today.
- The abandonment was inexpensive precisely because no feature code ever imported an engine. This is direct evidence that the wrapper boundary was the valuable part of ADR 0007, independent of which engine sat behind it.
- The application still expects to offer WYSIWYG editing eventually, so the architectural boundary should stay defined even while the engine choice does not exist.

## Decision Statement

No WYSIWYG editor engine is selected. WYSIWYG editing remains deferred and must be presented through the shared planned-feature placeholder.

When an engine is eventually adopted, it must sit behind an application-owned editor component whose public contract accepts and emits canonical Markdown. That owned wrapper is the only place permitted to import the engine, so that replacing or abandoning an engine requires changes inside the wrapper and its tests, never a feature-level migration.

Selecting a specific engine requires a new ADR.

## Decision Drivers

- The engine choice failed, but the boundary that contained the failure succeeded.
- Features must not accumulate dependencies on a vendor document model, commands, or event types.
- Markdown must remain the persistence and export contract regardless of editing mode.
- A deferred capability should be honestly presented as unavailable rather than partially built.
- A future engine evaluation should not have to rediscover why the previous one was rejected.

## Options Considered

### Keep the wrapper requirement, defer the engine choice

- Pros:
  - Preserves the boundary that made this abandonment nearly free.
  - Leaves the engine decision open without leaving the architecture undefined.
  - Keeps the current direct-Markdown experience valid and unchanged.
- Cons:
  - No WYSIWYG capability until a future ADR selects an engine.
  - The wrapper contract is specified before a concrete engine exercises it.

### Immediately select a replacement engine

- Pros:
  - Restores a path to WYSIWYG editing.
- Cons:
  - Repeats the mistake of committing to an engine before the capability is actually being built.
  - The prior selection failed on acquisition practicality, which needs real evaluation, not a quick substitution.
  - WYSIWYG is not currently a priority.

### Abandon the wrapper requirement along with the engine

- Pros:
  - Fewer architectural constraints to satisfy.
- Cons:
  - Discards the specific decision that kept this abandonment cheap.
  - A future engine would likely be imported directly into feature components, making the next replacement expensive.
  - Risks vendor HTML or JSON document models leaking into persistence and export.

## Chosen Approach and Rationale

- Separate the two decisions that ADR 0007 bundled together. The engine selection is abandoned; the wrapper boundary is retained.
- Leave the engine explicitly unselected rather than naming a provisional replacement, because the previous failure was about acquisition practicality and deserves genuine evaluation when the capability is actually scheduled.
- Continue using direct Markdown authoring and the owned viewer, which meet current needs.
- Require the shared placeholder for WYSIWYG so the deferred state is communicated honestly, consistent with [ADR 0003](./0003-use-a-shared-placeholder-for-planned-features.md).
- Keep [ADR 0008](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) in force. It was deliberately written to survive an engine change and defines the content-integrity rules any future engine must satisfy.

## Consequences and Tradeoffs

- WYSIWYG editing is unavailable until a future ADR selects an engine and a spec schedules the work.
- The wrapper contract is defined in the abstract, so the first real engine adoption may need to refine it.
- Any future engine evaluation must now assess acquisition practicality explicitly, including public registry availability, not only licensing and features.
- Current Journal behavior is unaffected; no code change is required by this ADR.

## Guidance for Architect Agents

- Treat engine selection and the wrapper boundary as separate decisions. A future engine ADR replaces the former and must not weaken the latter.
- When evaluating a future engine, assess public package availability and installability alongside licensing, accessibility, and Markdown fidelity. Acquisition practicality is what defeated the previous choice.
- Require any future engine to satisfy [ADR 0008](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) before adoption.
- Do not let a deferred capability drift into a partially implemented one.

## Guidance for Coding Agents

- Do not add a WYSIWYG editor dependency without a new ADR selecting it.
- Continue to provide direct Markdown authoring and the owned, replaceable Markdown viewer.
- Present WYSIWYG editing through the shared planned-feature placeholder required by [ADR 0003](./0003-use-a-shared-placeholder-for-planned-features.md).
- Do not simulate a rich-text editing experience or call services that imply one exists.
- If an engine is later adopted, confine every import of it to the owned wrapper.
- Keep the wrapper's public props application-oriented: Markdown `value`, a Markdown change callback, disabled and read-only state, an accessible label, and validation or error presentation.
- Keep Markdown as the wrapper's input and output contract; save, export, and backend APIs continue to consume Markdown only.
- Use repository-local UI primitives and semantic Tailwind tokens for any wrapper controls, per [ADR 0005](./0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md).

## Guidance for Testing Agents

- Verify that the WYSIWYG entry point renders the shared placeholder and makes no API calls.
- Verify that direct Markdown authoring and the owned viewer remain fully functional and keyboard accessible.
- Verify that no WYSIWYG engine package appears in workspace dependencies.
- When an engine is eventually adopted, verify that no feature module imports it directly, and verify Markdown-to-editor and editor-to-Markdown behavior for every supported construct in [ADR 0008](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md).

## Do

- Keep WYSIWYG editing deferred and presented through the shared placeholder.
- Keep direct Markdown authoring and the owned Markdown viewer as the supported experience.
- Require a new ADR before adopting any WYSIWYG engine.
- Confine any future engine to an application-owned wrapper.
- Keep Markdown as the canonical authoring, persistence, and export format.
- Evaluate acquisition practicality when assessing a future engine.

## Do Not

- Do not add a WYSIWYG editor dependency without an ADR selecting it.
- Do not import a future editor engine into feature pages, API clients, shared domain types, persistence code, or export utilities.
- Do not expose vendor instances, commands, extension arrays, or event types through the wrapper's public props.
- Do not persist an engine's HTML or JSON document model as canonical content.
- Do not simulate WYSIWYG editing in place of the placeholder.
- Do not revive the CWL Editor or Inkspan source-build approach without a new ADR that addresses why the previous acquisition path failed.

## Open Questions and Follow-up Items

- Decide when WYSIWYG editing becomes a scheduled priority rather than a deferred capability.
- Define engine evaluation criteria, including public registry availability, license, accessibility, bundle cost, and Markdown round-trip fidelity against [ADR 0008](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md).
- Decide whether the owned wrapper should be introduced ahead of an engine, backed by the existing viewer, or only when an engine is adopted.
