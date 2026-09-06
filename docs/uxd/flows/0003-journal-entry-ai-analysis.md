# Journal Entry AI Analysis UX Flow & Contract - Plan 0003

- **Date:** 2026-09-05
- **Task:** T-01.1 (Designing the Journal analysis Day-view workflow)
- **Owner:** uxd
- **Spec:** [0003-journal-entry-ai-analysis](../../specs/0003-journal-entry-ai-analysis.md)
- **Plan:** [0003-journal-entry-ai-analysis](../../plans/0003-journal-entry-ai-analysis.md)
- **Referenced ADRs:** [0002 (routing)](../../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md), [0003 (placeholder)](../../ADRs/0003-use-a-shared-placeholder-for-planned-features.md), [0004 (React Router)](../../ADRs/0004-use-react-router-for-frontend-navigation.md), [0005 (Tailwind/shadcn)](../../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md), [0010 (BYOK provider schemas)](../../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md), [0011 (encrypted AI credentials)](../../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md)

---

## UX Summary

Journal Entry AI Analysis adds a contextual, transient analysis panel to the existing Journal Day view. A user with a saved Journal entry and at least one ready AI connection can select **Analyze with AI**, confirm or change the preselected ready connection, start generation, watch Markdown output stream into the panel, stop generation, and retry.

This design intentionally keeps the experience simple. It proves AI plumbing without creating analysis history, follow-up chat, personas, prompt editing, or multi-entry workflows.

## User Jobs

1. Understand whether the current saved Journal entry can be analyzed.
2. Start analysis with minimal configuration friction.
3. Know which AI connection will be used.
4. See generation status and partial output as it streams.
5. Stop generation without losing partial output.
6. Retry or switch ready connections when useful.
7. Understand that AI output can be inaccurate and is not financial advice.

## Route Map and State Ownership

No new route is introduced.

| Route | Purpose | URL-owned state | Analysis state |
| --- | --- | --- | --- |
| `/workspace/journal?mode=day&date=YYYY-MM-DD` | Existing Day view for one saved or empty Journal date | `mode=day`, `date` | Component state only |
| `/workspace/settings/your-ai/connections` | Existing route for AI connection setup and testing | Settings route path | Not applicable |

### URL state vs. component state

| Data | Owner | Rationale |
| --- | --- | --- |
| Journal mode and date | URL | Existing Journal location; must refresh and deep-link per ADR 0002 and ADR 0004 |
| Analysis panel expanded/open state | Component | Contextual UI state, not a separate place in the app |
| Selected AI connection | Component | Transient choice for one analysis run; not meaningful after refresh |
| Streaming status | Component | Runtime operation state |
| Partial or completed analysis text | Component | Unsaved response; intentionally lost on refresh/navigation |
| Analysis error message | Component | Runtime operation state |
| Ready connection loading state | Component | Runtime data-fetch state |

Back/forward and refresh must preserve the Journal Day location, but they do not preserve analysis output or selected connection.

## Placement and Layout

### Recommended Day-view placement

Place the analysis surface as a dedicated card immediately below the primary Journal entry card and above the existing planned-feature placeholders.

Rationale:

- It keeps analysis visibly tied to the saved Day entry.
- It avoids crowding the editor toolbar with streaming controls.
- It works for Focus, Live preview, and Reading view modes.
- It does not create a new major navigation surface.
- It keeps planned features such as WYSIWYG, New Experiments, Rules Adherence, and Add Context visually separate.

### Entry action

Inside the Journal entry action row, add a button:

- Label: **Analyze with AI**
- Enabled only when a saved entry exists and the app has an authenticated API client.
- Disabled when there is no saved entry.
- Activates/focuses the analysis card rather than starting generation immediately.

If the analysis card is already visible, selecting **Analyze with AI** should move focus to the analysis section heading or connection selector.

### Analysis card sections

1. Header
   - Eyebrow or small label: `AI analysis`
   - Heading: `Analyze this entry`
   - Short description: `Generate a one-time Markdown analysis from the saved version of this Journal entry.`
2. Disclaimer
   - Always visible when the card is visible.
3. Connection controls
   - Ready connection dropdown.
   - Start/retry action.
   - **Stop generating** action only while connecting or streaming.
4. Status line
   - Polite visible status text.
5. Output panel
   - Markdown-rendered region.
   - Empty copy before generation.
   - Partial output retained after stop or mid-stream failure.
6. Error area
   - Separate from output.
   - Visible only for actionable failures.

## Primary Flow

1. User opens `/workspace/journal?mode=day&date=YYYY-MM-DD`.
2. The Day view loads a saved entry.
3. User selects **Analyze with AI**.
4. Analysis card is shown or focused.
5. App loads ready AI connections if not already loaded.
6. Dropdown lists only ready connections, sorted by connection label with provider display name as the tie-breaker.
7. First ready connection is preselected.
8. User selects **Start analysis**.
9. UI enters `Connecting`, then `Streaming`.
10. Markdown output appears incrementally in the output panel.
11. Stream completes and UI enters `Complete`.
12. Response remains visible until the user refreshes, navigates away, starts another analysis, or the component unmounts.

## Alternate Flows

### No saved entry

- **Analyze with AI** is disabled or absent as an active action.
- Analysis card is not shown automatically.
- If shown through stale UI state, it must say: `Save this Journal entry before analyzing it.`
- No API request is sent.

### No ready AI connections

Show a card state with:

- Message: `Journal analysis needs a ready AI connection. Create or test a connection in Your AI settings, then return to this entry.`
- Action: `Open Your AI settings`
- Target: `/workspace/settings/your-ai/connections`

Do not show failed, disabled, untested, or unsupported connections in the selector.

### Unsaved edits exist

If the entry has unsaved edits after the last saved version:

- Keep **Analyze with AI** available because this is a plumbing proof slice.
- Show helper text in the analysis card: `Analysis uses the last saved version of this entry. Save first if you want the latest edits included.`
- If a prior response exists, leave it unchanged.
- If the user edits after a completed response, show: `This analysis is based on the saved entry content from when it was generated.`

### Stop generation

When the user selects **Stop generating**:

- Abort the underlying provider request.
- Preserve partial output.
- Set status to `Generation stopped. Partial analysis is shown below.`
- Keep retry available after the abort settles.

### Retry

Retry appears after stopped, failed, or complete states.

- Label: **Retry analysis**
- Reuses the currently selected connection by default.
- User may choose another ready connection before retry.
- Disabled while connecting or streaming.
- Starting retry may replace the previous response only after the user activates retry/start.

### Mid-stream provider failure

If chunks have already appeared and then the stream fails:

- Preserve partial output.
- Show a separate alert below or above the output: `The provider stopped responding before the analysis finished. Partial analysis is shown below.`
- Keep retry available.

## State Table

| State | Trigger | Display | Actions | Focus / announcement |
| --- | --- | --- | --- | --- |
| Hidden | Day entry card loaded; user has not selected **Analyze with AI** | No analysis card, or a compact entry action only | Analyze with AI | Button has visible focus |
| Idle, no response | Card opened and a saved entry exists | Empty output panel, disclaimer, ready connection dropdown, selected first option | Start analysis, change connection | Focus moves to card heading or selector; announce `AI analysis panel ready` |
| Loading connections | Card opened before connections load | Skeleton or text `Loading ready AI connections...` | None or disabled start | Polite status announcement |
| No ready connection | No connection meets ready criteria | Requirement message and settings action | Open Your AI settings | Focus moves to message heading; settings action is keyboard reachable |
| Unsaved entry changes | User has unsaved edits while saved entry exists | Helper text that analysis uses saved content | Save entry, start analysis on saved content, continue editing | Helper is linked by `aria-describedby` where practical |
| Connecting | User starts analysis | Status `Starting analysis...`, disabled connection select, output preserved or cleared for new run | Stop generating | Polite status announcement |
| Streaming | Provider chunks arrive | Incremental Markdown output, status `Generating analysis...` | Stop generating | Announce state once; do not announce each chunk |
| Stopped | User selects **Stop generating** | Partial output, stopped status | Retry analysis, change connection | Polite status announcement |
| Complete | Stream closes successfully | Completed Markdown output and disclaimer | Retry analysis, change connection | Polite status announcement; do not steal focus |
| Pre-stream error | Validation/auth/readiness/rate-limit/setup fails before chunks | Alert message; no output replacement | Retry if applicable, change connection, open settings if applicable | Alert is assertive if actionable |
| Mid-stream error | Provider/network fails after chunks | Partial output plus separate safe alert | Retry analysis, change connection | Alert is assertive; focus remains stable |

## Content and Microcopy

### Required labels

- Entry action: **Analyze with AI**
- Start action: **Start analysis**
- Stop action: **Stop generating**
- Retry action: **Retry analysis**
- Settings action: **Open Your AI settings**
- Connection label: `AI connection`
- Output heading: `Analysis result`

### Required disclaimer

> AI-generated analysis can be incomplete, inaccurate, or misleading. Use it as a reflection aid, not as financial advice or a recommendation to buy, sell, or hold any security.

### Suggested copy

| Context | Copy |
| --- | --- |
| Empty output panel | `Run AI analysis on the saved version of this Journal entry. Results appear here and are not saved.` |
| Ready helper | `Choose the AI connection to use for this one-time analysis.` |
| Loading connections | `Loading ready AI connections...` |
| No saved entry | `Save this Journal entry before analyzing it.` |
| No ready connection | `Journal analysis needs a ready AI connection. Create or test a connection in Your AI settings, then return to this entry.` |
| Unsaved edits | `Analysis uses the last saved version of this entry. Save first if you want the latest edits included.` |
| Connecting | `Starting analysis...` |
| Streaming | `Generating analysis...` |
| Stopped | `Generation stopped. Partial analysis is shown below.` |
| Complete | `Analysis complete. Results are not saved.` |
| Rate limited | `Analysis is temporarily rate limited. Wait a moment and try again.` |
| Pre-stream failure | `Analysis could not start. Review the message and try again.` |
| Mid-stream failure | `The provider stopped responding before the analysis finished. Partial analysis is shown below.` |
| Stale after edits | `This analysis is based on the saved entry content from when it was generated.` |

Tone should remain neutral, practical, and non-alarming. Avoid language that implies the model is authoritative, such as "expert verdict" or "recommendation."

## Accessibility Requirements

- All controls use native button/select semantics or owned accessible primitives.
- The connection dropdown has a visible label and programmatic name: `AI connection`.
- The dropdown helper text explains that only ready connections are shown.
- Button groups have an accessible group label, for example `AI analysis actions`.
- Visible focus is required for **Analyze with AI**, dropdown, **Start analysis**, **Stop generating**, retry, and settings link.
- Use a polite `aria-live` status region for coarse state changes:
  - panel ready;
  - loading ready connections;
  - starting analysis;
  - generating;
  - stopped;
  - complete.
- Do not place the full streaming Markdown output inside an assertive live region and do not announce every chunk.
- Use `role="alert"` or equivalent only for actionable failures.
- Error and status meaning must include text, not color alone.
- The output region must be a labeled region, for example `role="region"` with `aria-labelledby="journal-analysis-result-title"`.
- Focus behavior:
  - Opening the card from **Analyze with AI** moves focus to the analysis heading or the connection selector.
  - Starting analysis should not move focus unless needed to expose the status region.
  - Completion should not steal focus.
  - Errors should be programmatically associated with the analysis controls or be immediately after the relevant control in DOM order.
- The **Stop generating** button remains reachable while streaming on desktop, tablet, mobile, and 200% zoom.

## Responsive Behavior

Use mobile-first layout with Tailwind responsive utilities and existing semantic tokens.

| Breakpoint / form factor | Behavior |
| --- | --- |
| Mobile | Single-column stack: entry card, action row, analysis card, placeholders. Controls wrap. Dropdown is full width. **Stop generating** appears near status and before the output panel. |
| Tablet | Analysis card remains below the entry card. Connection dropdown and action buttons may share a row if width permits. Preserve readable line lengths. |
| Desktop | Preferred first implementation remains below the entry card for simplicity. A future side-by-side/right-rail treatment is allowed only if it does not crowd the editor or cause horizontal scrolling. |
| 200% zoom | Treat as mobile-like stacking. No horizontal scrolling for controls, disclaimer, status, errors, or output. |

Do not use hover-only interactions. Do not rely on a sticky bottom action bar for this first slice; keeping the panel inline is more predictable and easier to verify.

## Markdown Output Boundaries

- Render accumulated response as Markdown using the existing safe Markdown viewer behavior where feasible.
- Temporarily malformed or jumpy Markdown during streaming is acceptable.
- Completed Markdown must render safely.
- Raw HTML support is not required.
- Images in AI output should follow the existing safe fallback behavior and not load external images.
- Links should open safely in a new tab with `rel="noopener noreferrer"` if rendered.
- The output is not editable in this slice.
- The output is not copied, downloaded, or saved by this workflow.

## API-Facing UX Contract

| User action | Required input | Expected success result | Validation / conflict / failure feedback |
| --- | --- | --- | --- |
| Open analysis panel | Saved Day-view entry, authenticated API client | Empty panel, disclaimer, ready connection loading or dropdown | No saved entry: no request; show save-first copy if panel is visible |
| Load ready connections | Authenticated API client | Ready connections sorted by label, provider tie-breaker, first preselected | Load failure: safe alert and retry/reopen option |
| Start analysis | Saved `entryId`, selected ready `connectionId` | Stream begins and status changes to connecting/streaming | Invalid body, missing entry, not-ready connection, auth, or rate-limit errors show safe pre-stream alert |
| Receive chunk | Stream event `chunk` with text | Append text to accumulated Markdown | If chunk parsing fails, show safe mid-stream error and preserve prior output |
| Receive done | Stream event `done` or normal close | State becomes complete, output remains visible | If done event is malformed, treat as safe mid-stream error |
| Stop generating | Active request and `AbortController` | Request aborts, partial output remains | If abort fails, keep output and show safe error |
| Retry analysis | Same saved `entryId`, selected ready `connectionId` | New stream begins; selected connection is reused by default | Same as start analysis |
| Open settings | No ready connection | React Router navigation to `/workspace/settings/your-ai/connections` | Preserve Journal route if navigation cannot complete |

The UI should never send prompt text, Journal content, `organizationId`, `userId`, provider secrets, or provider configuration in the analysis request body.

## Component Mapping

| UX element | Suggested implementation mapping |
| --- | --- |
| Analysis container | `Card` or existing rounded bordered section using semantic tokens |
| Entry action | Existing `Button` variant near Save / Copy / Download actions |
| Ready connection selector | Existing `Select` with visible `label` and helper text |
| Status | Text region with `role="status"` and `aria-live="polite"` |
| Errors | Existing `Alert` or bordered error region with `role="alert"` |
| Markdown output | Existing `MarkdownViewer`, with an empty-state copy extension if needed |
| Settings navigation | React Router `useNavigate` or `Link` to `/workspace/settings/your-ai/connections` |

## Planned-Feature Placeholder Handling

This feature implements only one-time Journal entry analysis.

- Do not activate personas.
- Do not activate Add Context / portfolio context injection.
- Do not activate Rules Adherence or New Experiments.
- If those planned capabilities remain visible, continue using `NotYetImplemented` per ADR 0003 and keep them visually separate from the implemented analysis panel.

## Inclusive UX and User Trust

- Use "AI analysis" rather than "expert analysis" or "recommendation."
- Avoid implying the output is personalized financial advice.
- Keep the disclaimer visible without using alarmist styling.
- Preserve user agency: analysis is user-initiated, stoppable, retryable, and not saved.
- Avoid shame-oriented language around missed trades, mistakes, losses, or discipline.
- Error messages should explain what the user can do next when possible.

## UX Acceptance Checklist

- [ ] Analysis is available only from the Journal Day view for a saved entry.
- [ ] The analysis card is inline below the entry card and above planned-feature placeholders.
- [ ] No new route or URL-owned analysis state is introduced.
- [ ] Ready connections are the only selector options.
- [ ] Ready connections sort by connection label with provider display name as tie-breaker.
- [ ] First ready connection is preselected.
- [ ] Empty panel and disclaimer are visible before generation.
- [ ] Unsaved edits helper clearly says saved content is analyzed.
- [ ] **Stop generating** aborts and preserves partial output.
- [ ] Mid-stream failure keeps partial output and shows a separate safe error.
- [ ] Retry reuses the selected connection by default.
- [ ] Markdown output uses safe rendering boundaries.
- [ ] Keyboard-only users can reach and operate every control.
- [ ] Screen-reader users get coarse status announcements without chunk-by-chunk output announcements.
- [ ] Mobile, tablet, desktop, and 200% zoom layouts remain readable without horizontal scrolling.
- [ ] Planned features remain placeholders and do not call APIs or simulate output.
