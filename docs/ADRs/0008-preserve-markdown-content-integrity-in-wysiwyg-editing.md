# ADR 0008: Preserve Markdown content integrity in WYSIWYG editing

- Status: accepted
- Date: 2026-08-30
- Audience: [architect-agents, coding-agents, testing-agents, uxd, humans]

## Applicable When

- Adding or changing an application WYSIWYG editor that reads or writes canonical Markdown.
- Defining Markdown conversion, normalization, supported formatting, or fallback behavior.
- Migrating between WYSIWYG editor engines.
- Not applicable to direct Markdown editing, which preserves user-provided content without rich-text conversion.

## Context

- Markdown is the canonical format for application authoring, persistence, export, and reuse.
- A WYSIWYG editor must convert Markdown into an internal rich document model and then convert edits back to Markdown.
- Rich editors cannot safely represent every Markdown dialect or extension.
- Silent rewriting or loss of unsupported syntax would corrupt user-authored content.
- [ADR 0007](./0007-use-cwl-editor-behind-an-owned-markdown-editor.md) originally selected CWL Editor as the engine and required an owned Markdown editor wrapper. That engine selection was abandoned and is superseded by [ADR 0012](./0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md), which keeps the owned-wrapper requirement and leaves the engine unselected. This content-integrity policy was written to remain valid across an engine change, and it does: it applies to whatever engine is eventually adopted.

## Decision Statement

WYSIWYG editing guarantees semantic Markdown round trips for a defined supported subset, not byte-for-byte preservation of arbitrary Markdown. If an entry contains unsupported syntax, the application must warn the user and require direct Markdown editing; it must not load that content into WYSIWYG mode and later save a lossy conversion.

The owned editor wrapper may use its engine's Markdown conversion internally, but the application's supported subset, fallback behavior, and tests are authoritative.

## Do

- Treat paragraphs, hard breaks, headings 1 through 3, bold, italic, strikethrough, ordered lists, unordered lists, links, blockquotes, inline code, fenced code blocks, horizontal rules, and tables as the initial WYSIWYG-supported Markdown subset.
- Define a semantic round trip as preserving the meaning and structure of supported content; permit harmless normalization such as whitespace, indentation, or equivalent Markdown marker choices.
- Detect unsupported syntax before switching an entry from direct Markdown to WYSIWYG editing.
- Show an actionable warning: `This entry contains formatting that can only be safely edited in Markdown mode.`
- Keep the user in direct Markdown mode when unsupported syntax is detected and retain the original Markdown unchanged.
- Keep conversion implementation details inside the owned wrapper required by [ADR 0012](./0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md).
- Add focused tests for Markdown-to-editor initialization and editor-to-Markdown output for every supported construct, including mixed and nested supported content.
- Verify keyboard editing, accessible warnings, focus behavior, disabled/read-only behavior, and no-content-loss fallback behavior.
- Reevaluate this ADR before adding media, task lists, front matter, raw HTML, footnotes, custom extensions, or another syntax category to WYSIWYG support.

## Do Not

- Do not promise byte-for-byte Markdown preservation after a WYSIWYG round trip.
- Do not silently strip, rewrite, flatten, or save unsupported Markdown through a WYSIWYG editor.
- Do not treat raw HTML, front matter, images or media, task lists, footnotes, custom Markdown extensions, or complex nested table/list combinations as WYSIWYG-supported until this ADR is explicitly revised.
- Do not persist an editor engine's HTML or JSON document model as a fallback for unsupported Markdown.
- Do not let a feature bypass the owned wrapper's unsupported-content detection or substitute its own conversion rules.
