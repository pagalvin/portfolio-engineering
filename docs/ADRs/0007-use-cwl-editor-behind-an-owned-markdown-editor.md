# ADR 0007: Use CWL Editor behind an owned Markdown editor component

- Status: superseded by [ADR 0012](./0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md)
- Date: 2026-08-30
- Superseded: 2026-09-05
- Audience: [architect-agents, coding-agents, testing-agents, uxd, humans]

## Superseded Notice

This ADR is no longer in force. The CWL Editor engine selection is abandoned.

- What is abandoned: the choice of CWL Editor as the application WYSIWYG engine, and the pinned `vendor/inkspan` source-build acquisition method it required.
- Why: acquiring and building the engine proved impractical. The documented npm package was never published to the public registry, leaving a pinned-commit source build as the only path. That cost was not justified for a capability that remains deferred.
- What survives: the owned-wrapper requirement. Any future WYSIWYG engine must still sit behind an application-owned component with a Markdown-in, Markdown-out contract. That requirement now lives in [ADR 0012](./0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md).
- What is unaffected: [ADR 0008](./0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md) remains accepted. Its content-integrity policy was written to be engine-independent and still applies.
- Implementation impact: none. No CWL, TipTap, ProseMirror, or Inkspan dependency was ever added, and no `vendor/inkspan` directory exists. The Journal shipped direct Markdown authoring with an owned `MarkdownViewer` and a shared placeholder for WYSIWYG, which this ADR expressly permitted.

The original decision is retained below for historical context. Do not follow its guidance. It is preserved primarily so that a future WYSIWYG effort does not rediscover the unpublished-package and source-build problems the hard way.

## Applicable When

- Adding or changing a rich-text or WYSIWYG Markdown editing experience.
- Selecting a default editor dependency for an application feature.
- Creating a reusable application editor component or replacing its underlying editor engine.
- Not applicable to a plain textarea used for direct Markdown authoring.

## Context (historical)

- Markdown is the canonical application format for authoring, persistence, export, and reuse.
- The Journal and future features need an accessible WYSIWYG editing experience without storing application content as HTML.
- CWL Editor is based on TipTap and ProseMirror and is MIT licensed.
- Direct imports of a vendor editor across feature components would make replacement costly and would expose vendor document models and commands as application contracts.
- The documented npm package name, `@contextualwisdomlab/cwl-editor`, is not currently published to the public npm registry. Inkspan provides a documented source-build integration through `https://github.com/ContextualWisdomLab/inkspan.git`.
- Journal WYSIWYG editing is currently deferred because it adds unnecessary authoring complexity to the MVP. The Journal instead supplies direct Markdown authoring and an owned Markdown viewer.

## Decision Statement (historical - no longer in force)

Use CWL Editor (TipTap/ProseMirror, MIT) as the standard WYSIWYG Markdown editor engine for the application. Wrap it in an owned application component that accepts and emits canonical Markdown so features depend on the application contract rather than CWL, TipTap, or ProseMirror APIs.

The owned wrapper is the only application boundary allowed to import CWL Editor directly. Replacing CWL later must require changes inside the wrapper and its focused tests, not feature-level migrations.

Until the package is published to the public npm registry, acquire CWL Editor as the documented Inkspan source build in `vendor/inkspan`, pinned to commit `67afc7099cc0e5711a9cc9476bf3be5bb820e229` (the `v0.3.1` release tag). Build that source before consuming its `dist/` artifacts. Do not use an unpinned branch checkout or infer an unpublished npm version from repository metadata.

This decision does not require a feature to enable WYSIWYG editing now. A feature that defers WYSIWYG must use direct Markdown authoring and may use an owned, replaceable Markdown viewer. It must use the shared planned-feature placeholder rather than simulate a rich-text editor.

## Do (historical - superseded by ADR 0012)

- Acquire CWL Editor from the pinned `vendor/inkspan` source build until a public npm release can be verified; when a verified release is available, add it only to the application package that owns the reusable wrapper, subject to the repository dependency-management conventions.
- Record the pinned source revision and any future verified npm version in this ADR when changing the acquisition method.
- Build the vendored source before consuming its `dist/` artifacts and ensure application builds resolve CWL only from that built source.
- Expose an owned component with application-oriented props such as Markdown `value`, Markdown change callback, disabled/read-only state, accessible label, and validation/error presentation.
- Keep Markdown as the wrapper's input and output contract; save, export, and backend APIs continue to consume Markdown only.
- Keep CWL, TipTap, ProseMirror, editor instances, extensions, commands, HTML, JSON document models, and vendor-specific event types inside the wrapper implementation.
- Define and test the supported Markdown subset for each feature before enabling its WYSIWYG mode, including round-trip behavior and an explicit fallback for unsupported syntax.
- Use repository-local UI primitives and semantic Tailwind tokens for wrapper controls, status, errors, focus treatment, and responsive layout, as required by ADR 0005.
- Verify keyboard editing, focus behavior, labels, read-only and disabled states, Markdown-to-editor initialization, editor-to-Markdown output, and supported-content round trips.
- Reassess this ADR before adding media, collaboration, custom persistence formats, or vendor extensions that would expand the wrapper's public contract.

## Do Not (historical - superseded by ADR 0012)

- Do not import CWL Editor, TipTap, or ProseMirror directly into feature pages, API clients, shared domain types, persistence code, or export utilities.
- Do not add `@contextualwisdomlab/cwl-editor` from npm until its package and version can be verified in the public registry.
- Do not consume an unpinned Inkspan branch or its TypeScript source directly from application code.
- Do not persist CWL, TipTap, or ProseMirror HTML/JSON document representations as the canonical application content.
- Do not expose vendor instances, commands, extension arrays, or event types through the owned wrapper's public props.
- Do not assume arbitrary Markdown round-trips through a WYSIWYG editor; preserve, reject, or explicitly fall back for unsupported content according to the feature contract.
- Do not couple a feature's routing, authorization, storage schema, or export format to CWL Editor.
