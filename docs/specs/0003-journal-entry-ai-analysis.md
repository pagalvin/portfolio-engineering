# Journal Entry AI Analysis

## Status

- Readiness: Complete
- Owner: implemented
- Date: 2026-09-05
- Source: [journal-entry-ai-analysis-feature-brief](../brainstorming/InitialAIWork/journal-entry-ai-analysis-feature-brief.md)

## Summary

Add the first end-user AI workflow in P/OS by allowing a user to analyze one Journal Day entry with one ready AI connection.

The user starts from the Journal Day view, clicks **Analyze with AI**, uses an alphabetically preselected ready AI connection, and watches the AI response stream into a Markdown-rendered panel. The response is not saved and the user cannot ask follow-up questions in this slice.

The primary purpose is to prove the AI infrastructure in a real product workflow while keeping scope deliberately small.

## Business objective

Validate the end-to-end AI feature path from private Journal content to a user-selected BYOK AI provider connection.

This feature should prove that P/OS can:

- retrieve private user-owned Journal content;
- select an organization-owned ready AI connection;
- invoke the selected provider from the backend without exposing credentials;
- stream AI output to the frontend;
- display useful analysis without creating analysis history, chat, memory, or prompt-configuration scope.

## Problem / opportunity

P/OS now supports organization-scoped AI provider connections, but those connections are only useful if product workflows can safely call them.

Journal entry analysis is a strong first AI workflow because:

- Journal entries are already text-based and Markdown-backed.
- Single-entry analysis is useful without portfolio positions, market data, memory, personas, or multi-turn chat.
- Limiting the workflow to one entry controls scope and cost.
- Streaming output proves a more realistic invocation path than connection testing.
- The feature can exercise privacy, tenancy, credential handling, cancellation, and provider failure behavior before broader AI features are built.

## Desired outcomes

- Users can start AI analysis from the Journal Day view.
- Users can analyze only one Journal entry at a time.
- Users see only ready AI connections in the selector.
- The first ready connection is preselected alphabetically.
- Users can choose another ready connection when more than one exists.
- Users can see the AI response stream into the page and render as Markdown.
- Users can cancel an in-progress analysis and preserve any partial response already received.
- Users can retry analysis using the same selected connection by default.
- Users understand that AI-generated output can be inaccurate or misleading and is not financial advice.
- Users can tell whether the analysis panel is idle, connecting, streaming, stopped, complete, or failed.
- Keyboard and screen-reader users can start, stop, retry, change connections, and understand streaming status without relying on visual motion.
- P/OS does not save analysis output in this slice.

## Scope

### Included

- Journal Day-view entry point labeled **Analyze with AI**.
- Analysis of one currently loaded Day-view Journal entry.
- Ready-AI-connection dropdown sorted alphabetically by connection label, with provider display name as the tie-breaker.
- Automatic preselection of the alphabetically first ready connection.
- Server-side validation of Journal ownership and AI connection organization scope.
- Server-owned fixed financial-analyst prompt.
- Backend provider invocation through the shared AI infrastructure.
- Streaming response delivery to the browser.
- Markdown rendering of accumulated streamed output.
- **Stop generating** behavior that aborts the underlying provider request and preserves partial streamed output.
- Retry behavior that reuses the currently selected connection by default.
- Missing-ready-connection guidance that routes users to AI connection settings.
- Safe user-facing errors for validation, provider, network, timeout, cancellation, and mid-stream failure states.
- Disclaimer copy near the analysis output.
- A feature-specific rate limit for Journal analysis requests.
- Accessible status announcements and keyboard-operable controls for the analysis workflow.
- Responsive placement rules for desktop, tablet, and mobile Journal layouts.

### Excluded

- Saving AI analysis responses.
- Analysis history.
- Follow-up questions or multi-turn chat.
- User-editable prompts.
- Selectable or configurable analyst personas.
- Analysis of selected entries, weeks, months, all entries, or any multi-entry range.
- Analysis entry points from Week, Month, or All review tables.
- Portfolio, positions, NAV, margin, rules, or market context injection.
- AI memory, embeddings, retrieval, or durable facts.
- Background, scheduled, or automatic analysis.
- Model comparison or multi-provider analysis.
- User-editable tool calls or agent workflows.
- Automatic trading recommendations.

## Non-goals

- Do not create a generic AI chat surface.
- Do not create a generic product-wide AI invocation endpoint unless required as an internal implementation detail for this workflow.
- Do not expose provider secrets, prompt payloads, Journal content, provider raw errors, or access tokens in logs, telemetry, or API responses.
- Do not add new AI providers.
- Do not change the AI connection configuration workflow except where needed to route users to existing settings when no ready connection exists.
- Do not store analysis output, even locally across refreshes.
- Do not define custom timeout or output-length policy in this first slice; that refinement is deferred.

## Functional requirements

1. **Entry point**
   - The Journal Day view shall expose an analysis action labeled **Analyze with AI**.
   - The action shall apply to the currently loaded Day-view Journal entry only.
   - The action shall not appear as an active analysis entry point in Week, Month, or All review rows in this slice.
   - If the Day view has no saved Journal entry to analyze, the UI shall not submit an analysis request.
   - If the current entry has unsaved edits, the UI shall make clear that analysis uses the last saved entry content unless the user saves first.

2. **Ready AI connection selection**
   - The UI shall request and display only ready AI connections.
   - A ready connection means:
     - it belongs to the current organization;
     - it is enabled;
     - its provider is supported by the running backend;
     - its most recent saved test status is successful.
   - Failed, disabled, untested, and unsupported connections shall be hidden from the analysis dropdown.
   - Ready connections shall be sorted alphabetically by connection label.
   - When connection labels are equivalent for sorting, provider display name shall be used as the tie-breaker.
   - The alphabetically first ready connection shall be preselected.
   - If multiple ready connections exist, the user shall be able to select a different ready connection before starting analysis.

3. **No-ready-connection state**
   - If no ready AI connections exist, the UI shall explain that Journal analysis requires a ready AI connection.
   - The UI shall provide a route-safe action to the existing AI connection settings surface.
   - The UI shall not show disabled, failed, untested, or unsupported connections as selectable analysis options.
   - Suggested copy: "Journal analysis needs a ready AI connection. Create or test a connection in Your AI settings, then return to this entry."

4. **Server-side authorization and data access**
   - The backend shall derive `organizationId` and `userId` from verified auth context.
   - The backend shall verify that the requested Journal entry belongs to the authenticated user and organization.
   - The backend shall verify that the requested AI connection belongs to the authenticated organization.
   - The backend shall reject attempts to analyze another user's Journal entry or another organization's AI connection.
   - The backend shall not accept organization or user scope from the request body or query string.

5. **Prompt construction**
   - The backend shall construct the full provider prompt server-side.
   - The user shall not edit the prompt in this slice.
   - The prompt shall instruct the model to act as a helpful financial analyst.
   - The prompt shall ask for reflective analysis of observations, risks, decision-quality patterns, assumptions, and useful follow-up questions.
   - The prompt shall instruct the model not to provide personalized financial advice or buy/sell/hold instructions.
   - Future selectable and configurable personas shall be deferred.

6. **Provider invocation and streaming**
   - The backend shall invoke the selected AI provider using the existing AI provider connection infrastructure.
   - Provider credentials shall be decrypted only on the server path that invokes the provider.
   - Streaming shall use a provider-neutral helper or contract that preserves the existing BYOK connection registry, server-only credential handling, organization scoping, cancellation, and safe-error requirements.
   - The provider response shall stream back to the frontend.
   - The stream shall support cancellation from the frontend.
   - The cancellation action shall be labeled **Stop generating**.
   - Cancellation shall abort the underlying provider request, not merely hide the response panel.
   - The system shall preserve partial streamed output when the user cancels.
   - If the provider fails after streaming has begun, the UI shall preserve partial streamed output and show a separate safe error message.
   - The UI shall prevent starting a second analysis for the same entry while one is already streaming.
   - If the user starts a new analysis after a prior response, the UI may replace the previous response only after the user explicitly starts the new run.

7. **Response display**
   - The frontend shall display the response incrementally as it streams.
   - The accumulated response shall render as Markdown.
   - The analysis output panel and disclaimer shall be visible before the first analysis starts, even if the panel is empty.
   - The empty panel shall set expectations that analysis is generated on demand and is not saved.
   - The implementation does not need structured analysis cards, citations, or rich report sections.
   - The UI shall continue showing the completed response after a successful analysis.
   - The completed response shall not be persisted and may be lost on refresh, navigation, or replacing it with a later analysis.
   - If the user edits the Journal entry after generating an unsaved analysis response, the response shall remain unchanged.
   - The UI shall communicate that visible output is based on the saved entry content at the time the user started analysis and is not automatically refreshed after edits.

8. **Retry behavior**
   - The UI shall allow retry after cancellation or failure when the Journal entry and selected ready connection remain valid.
   - Retry shall reuse the currently selected AI connection by default.
   - The user may choose a different ready connection before retry when more than one ready connection exists.
   - Retry shall be disabled while a stream is already in progress.

9. **Disclaimer**
   - The analysis surface shall display this disclaimer near the result:
     > AI-generated analysis can be incomplete, inaccurate, or misleading. Use it as a reflection aid, not as financial advice or a recommendation to buy, sell, or hold any security.

10. **Rate limiting and safety bounds**
    - Journal analysis shall have its own rate limit rather than reusing the AI connection test rate limit.
    - Initial rate-limit guidance for this proof slice:
      - minimum interval: 3 seconds between analysis starts for the same organization, user, Journal entry, and AI connection;
      - per-organization limit: 10 Journal analysis starts per minute;
      - limits apply before contacting the provider;
      - cancelled, failed, and successful requests all count after a provider call is attempted.
    - Exact timeout and output-length policy is deferred for a future refinement and shall not block this first proof slice.
    - Until custom analysis timeout and output-length policy is defined, implementation may reuse existing provider invocation defaults rather than introducing new product-specific bounds.
    - If a request is rate limited, the backend shall reject it before contacting the provider and the UI shall show a clear message.
    - Provider, timeout, and network errors shall be surfaced with safe user-facing messages that do not expose secrets, raw provider payloads, access tokens, or full Journal prompt content.

11. **Interaction state model**
    - The analysis surface shall support these user-visible states:

      | State | Trigger | Required display | Primary actions |
      | --- | --- | --- | --- |
      | Idle, no response | Day entry exists and no analysis has started | Empty Markdown panel, disclaimer, selected ready connection | Start analysis, change connection |
      | No ready connection | No connection meets ready criteria | Requirement message and link to Your AI settings | Go to settings |
      | Unsaved entry changes | User has unsaved edits while a saved entry exists | Notice that analysis uses last saved content | Save entry, start analysis on saved content, continue editing |
      | Connecting | User starts analysis and request is being established | Non-blocking progress text such as "Starting analysis..." | Stop generating |
      | Streaming | Provider chunks are arriving | Incrementally rendered Markdown, progress/status text | Stop generating |
      | Stopped | User selects **Stop generating** | Partial output remains visible with stopped status | Retry, change connection |
      | Complete | Stream closes successfully | Completed Markdown output and disclaimer | Retry, change connection |
      | Pre-stream error | Validation, auth, readiness, rate-limit, or request setup fails before chunks arrive | Safe error message without output replacement | Retry when applicable, change connection, go to settings when applicable |
      | Mid-stream error | Provider or network fails after chunks arrive | Partial output plus separate safe error message | Retry, change connection |

    - State changes shall not alter the Journal URL because selected connection, stream progress, partial output, and error state are transient component state.

12. **Accessibility and inclusive UX**
    - All controls shall be keyboard-operable with visible focus states.
    - The connection dropdown shall have an accessible name that identifies it as the AI connection used for Journal analysis.
    - The **Analyze with AI**, **Start analysis**, **Stop generating**, and retry controls shall use native button semantics or equivalent accessible primitives.
    - The streaming output region shall have a descriptive heading and programmatic label.
    - The app shall use a separate polite status announcement for state changes such as starting, streaming, stopped, complete, and failed. The full streaming Markdown output should not be announced on every chunk because that can overwhelm screen-reader users.
    - Error messages shall use `role="alert"` or equivalent assertive announcement only for actionable failures.
    - Status meaning shall not rely on color alone.
    - The disclaimer shall use plain language and appear close to the analysis panel before and after generation.
    - Copy shall avoid hype, anthropomorphism, shame, or pressure to act on the model output.

13. **Responsive behavior**
    - On desktop, the analysis surface may appear as a right-side or below-entry panel, as long as the editor/reader and analysis panel remain scannable without horizontal scrolling.
    - On tablet, the analysis surface should stack below the entry controls or use a collapsible section that does not hide status or errors.
    - On mobile, controls and the analysis panel shall stack in one column. **Stop generating** shall remain reachable while streaming without requiring horizontal scrolling.
    - At 200% zoom, controls, disclaimer, dropdown, errors, and streamed output shall remain readable and operable.

14. **Content and microcopy**
    - Primary Day-view action: **Analyze with AI**.
    - Stream cancellation action: **Stop generating**.
    - Suggested empty-panel copy: "Run AI analysis on the saved version of this Journal entry. Results appear here and are not saved."
    - Suggested in-progress status copy: "Generating analysis..."
    - Suggested stopped status copy: "Generation stopped. Partial analysis is shown below."
    - Suggested mid-stream failure copy: "The provider stopped responding before the analysis finished. Partial analysis is shown below."
    - Suggested stale-content helper copy after entry edits: "This analysis is based on the saved entry content from when it was generated."

## Constraints / applicable ADRs

- [ADR 0001](../ADRs/0001-organization-aware-data-access.md) applies because this feature adds protected backend reads across organization-owned Journal data and organization-owned AI connections. The backend must derive organization scope from verified auth context and scope all protected data access by `organizationId`.
- [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md) applies because this feature changes React frontend UI. New UI should use the established Tailwind/shadcn direction and preserve accessible interaction behavior.
- [ADR 0011](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md) applies because the backend reads stored AI provider credentials to call a provider. Credentials must be decrypted only server-side and must never be returned, logged, or emitted.
- [ADR 0010](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md) is relevant background for selecting and using existing BYOK connections. It does not directly govern prompt content or invocation behavior, but this feature must not bypass the provider registry or introduce provider-specific credential handling outside the established connection model.
- [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) and [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md) apply only if implementation adds or changes routes, navigation links, or URL-owned state. The analysis panel, selected connection, partial response, and streaming status are expected to be transient UI state and do not need URL ownership.
- [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md) does not apply to the implemented analysis action. It applies only if this feature continues to expose future unavailable capabilities, such as personas or context injection, as visible planned-feature placeholders.

No ADR conflict is known.

## UX handoff context

- **Target users:** Authenticated P/OS users who maintain Journal entries and have configured at least one working BYOK AI connection.
- **User goal:** Get immediate reflective analysis of the currently loaded Journal Day entry without leaving the Journal workflow.
- **Core workflow intent:**
  1. User opens a Journal Day view with a saved entry.
  2. User selects **Analyze with AI**.
  3. UI shows ready AI connections in a dropdown sorted alphabetically by connection label, with provider display name as the tie-breaker and the first option preselected.
  4. User starts analysis.
  5. Response streams into a Markdown-rendered panel.
  6. User may select **Stop generating** to cancel and preserve partial output.
  7. User may retry, using the same selected connection by default.
- **Information architecture:** Analysis belongs inside the Journal Day workflow as a contextual panel or section, not as a separate major route. It should not introduce new global AI navigation.
- **Component guidance:** Prefer existing owned UI primitives for buttons, alerts, cards, select/dropdown controls, and Markdown rendering. Reuse the existing safe Markdown rendering behavior where feasible so unsupported images and unsafe URLs are not newly exposed.
- **Focus behavior:** Opening or starting analysis should move focus predictably to the analysis section heading or first actionable control. Completion should not forcibly move focus away from the user's current control. Errors should be discoverable by screen readers.
- **Permissions and visibility:** Users may analyze only their own Journal entries. AI connections are organization-scoped, but provider credentials are never visible.
- **Content constraints:** The fixed prompt should frame output as reflective financial analysis, not advice. The disclaimer must be visible near the result.
- **Known edge cases:**
  - no saved Day entry;
  - no ready AI connections;
  - connection becomes unavailable between selection and analysis;
  - provider timeout;
  - provider starts streaming and then fails;
  - user cancels mid-stream;
  - malformed or partial Markdown while streaming;
  - user edits the Journal entry after generating an unsaved response.
- **Business constraints:** Keep this as infrastructure proof plus simple user value. Avoid persistence, chat, personas, range analysis, and portfolio context.
- **Success criteria:** A user can run a single-entry AI analysis through a real ready AI connection and see streamed Markdown output without secret exposure or cross-user/cross-organization data leakage.

## API-facing UX contract

| User action | Required input | Expected success result | User-visible failure feedback |
| --- | --- | --- | --- |
| Open analysis surface | Saved Day-view Journal entry | Empty analysis panel, disclaimer, ready connection dropdown or no-ready-connection guidance | If connection loading fails, show a safe retryable load error |
| Start analysis | Saved `entryId`, selected ready `connectionId` | Stream starts and Markdown output appears incrementally | Validation, readiness, auth, rate-limit, timeout, network, and provider errors show safe messages |
| Stop generating | Active stream | Provider request is aborted and partial output remains visible | If abort fails, show a safe error and keep any received output |
| Retry analysis | Same saved `entryId`, currently selected ready `connectionId` | A new stream starts using the selected connection | Same failure behavior as start analysis |
| Go to settings | No ready connections | Route to existing Your AI connection settings | If navigation fails, preserve current Journal view and show a safe message |

The API contract is intentionally workflow-specific. It may use an internal reusable AI invocation service, but the user-facing capability is Journal-entry analysis only.

## Assumptions

- "Current Journal Day entry" means the saved Journal entry currently loaded in Day view, not necessarily today's calendar date.
- Alphabetical sorting means case-insensitive sort by connection label, with provider display name as the tie-breaker.
- The analysis UI may hold streamed output only in component state.
- Losing unsaved analysis output on refresh or navigation is acceptable in this slice.
- Rendering streamed Markdown incrementally may produce temporarily incomplete formatting until more chunks arrive.
- Visually jumpy or temporarily malformed Markdown during streaming is acceptable for this proof slice as long as completed Markdown renders safely.
- Existing AI connection test status is sufficient to determine whether a connection is ready for selection.
- Custom timeout and output-length requirements will be revisited in a future refinement.
- The analysis panel and result are transient. They are not URL-owned and are not restored after refresh.
- The existing safe Markdown viewer behavior is sufficient for AI output unless implementation discovers a specific security or accessibility gap.

## Open questions

None. Custom timeout and output-length policy is intentionally deferred for future refinement.

## Definition of done

- The business objective is clear.
- Scope is limited to one Journal Day entry and one selected ready AI connection.
- Non-goals explicitly defer persistence, chat, personas, context injection, and multi-entry analysis.
- Requirements cover selection, authorization, prompt construction, streaming, cancellation, retry, disclaimer, errors, and rate limiting.
- Requirements cover UX state, accessible announcements, keyboard operability, responsive behavior, and microcopy.
- Applicable ADRs have been checked and cited.
- UXD has enough product context to design the Day-view workflow.
- No blocking open questions remain.
- Readiness is accurately marked as ready for planning.

## Acceptance criteria

1. Given a saved Journal Day entry and at least one ready AI connection, when the user opens the Day view, then **Analyze with AI** is available for that entry.
2. Given multiple ready AI connections, when the analysis UI is opened, then the dropdown lists only ready connections sorted alphabetically by connection label with provider display name as the tie-breaker, and preselects the first one.
3. Given no ready AI connections, when the user attempts to analyze, then the UI explains the requirement and provides a route-safe action to AI connection settings.
4. Given a selected ready connection, when the user starts analysis, then the backend validates Journal ownership and AI connection organization scope before invoking the provider.
5. Given a valid request, when the provider streams output, then the frontend displays the response incrementally and renders accumulated content as Markdown.
6. Given an in-progress analysis, when the user selects **Stop generating**, then the provider request is aborted and partial streamed output remains visible.
7. Given a cancelled or failed analysis, when the user retries, then the same selected connection is used by default.
8. Given a successful analysis, when the stream completes, then the response remains visible but is not persisted.
9. Given the user edits the Journal entry after an analysis response is visible, then the response remains unchanged.
10. Given a provider failure after streaming has begun, then partial output remains visible and a separate safe error message is shown.
11. Given any request or provider failure, then user-facing errors are safe and do not expose credentials, access tokens, raw provider payloads, or full prompt content.
12. Given the analysis panel is visible before or after analysis, then the AI disclaimer is displayed near the panel.
13. Given a keyboard-only user, when they open and use the analysis workflow, then every control is reachable, focus is visible, and no required action depends on pointer input.
14. Given a screen-reader user, when analysis state changes, then status changes are announced without reading every streamed chunk automatically.
15. Given desktop, tablet, mobile, or 200% zoom, then the analysis controls, disclaimer, streamed output, and error messages remain readable and operable without horizontal scrolling.
