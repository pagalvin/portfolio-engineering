# Journal Entry AI Analysis Feature Brief

- Status: draft
- Date: 2026-09-05
- Source: user brainstorming session after completion of AI provider connections

## Summary

Add the first end-user AI workflow in P/OS by letting a user analyze one Journal entry with one working AI connection.

From the current Journal Day view, the user clicks an analysis action, uses a preselected ready AI connection, and watches the AI response stream into the page. The response is not saved, and the user cannot ask follow-up questions in this slice.

This feature is intentionally small. Its main purpose is to prove that the AI provider connection infrastructure can support real product workflows beyond connection testing.

## Business objective

Validate the end-to-end AI feature path from private user content to a user-selected BYOK provider connection, while delivering a simple, useful Journal analysis experience.

This creates the first bridge between:

- organization-scoped AI provider connections;
- private, user-owned Journal content;
- provider invocation through the backend;
- streamed AI responses in the frontend.

## Problem / opportunity

P/OS now supports configured AI connections, but users do not yet have a product workflow that uses those connections for their own portfolio data.

Journal analysis is a strong first use case because:

- Journal entries are already user-authored, text-based, and Markdown-backed;
- analysis can be useful without requiring portfolio data, market data, memory, or multi-turn chat;
- a single-entry analysis limits scope and cost;
- streaming output gives users immediate feedback and proves a more realistic AI invocation path than the existing connection test action.

## Desired user outcomes

- As a user, I can start AI analysis from the current Journal Day entry.
- As a user, I get a ready AI connection preselected so the workflow is low-friction.
- As a user, I can choose a different ready AI connection before analysis if more than one is available.
- As a user, I can see the Markdown analysis stream into the page as it is generated.
- As a user, I can cancel an in-progress analysis and stop the provider request.
- As a user, I can understand when no working AI connections are available and where to configure one.
- As a user, I can retry analysis if the request fails or if I want to run the same entry through a different connection.
- As a user, I am not surprised by saved AI output, because this slice does not persist analysis responses.

## Initial scope

### Single-entry Journal analysis

Support analysis of exactly one Journal entry at a time.

The entry point shall appear only on the Day view for the currently loaded entry.

The feature should not analyze multiple entries, ranges, selections, or the entire Journal in this slice.

### AI connection selection

Show ready AI connections in an alphabetical dropdown sorted by connection label, using provider display name as the tie-breaker, and preselect the first option. If more than one ready connection exists, the user may choose a different ready connection before starting analysis.

For this feature, "working" should mean:

- the connection belongs to the user's current organization;
- the connection is enabled;
- the provider is supported by the running backend;
- the most recent saved test status is successful.

If no working AI connections are available, the UI should clearly explain that analysis requires a ready AI connection and route the user to the existing AI connection settings surface.

Failed, disabled, untested, and unsupported connections should be hidden from the analysis selector rather than shown as unavailable options.

### Server-side invocation

The backend should:

- verify the requested Journal entry belongs to the authenticated user and organization;
- verify the requested AI connection belongs to the authenticated organization;
- decrypt provider credentials only on the server;
- build the analysis prompt on the server;
- invoke the selected provider through the shared AI package;
- stream the provider response back to the browser.

The Journal content and provider credentials must not be logged or returned outside the streaming response.

### Streaming response

The frontend should display model output as it arrives and render the accumulated response as Markdown.

The first implementation may use a simple Markdown output panel. It does not need citations, sections, or analysis cards unless the business requirements agent decides those are essential.

The transport should work with the existing bearer-token authenticated API client. A `fetch`-based stream is preferred over browser `EventSource` because the current authenticated client depends on Authorization headers.

The first version should include a **Stop generating** action that aborts the underlying provider request rather than only hiding the UI state. Cancelling should preserve any partial Markdown response already streamed into the panel.

On successful completion, the UI should simply continue showing the streamed response. No persisted record, durable completion state, or history entry is needed. Retry should reuse the currently selected AI connection by default.

If the provider fails after streaming begins, the UI should keep partial output visible and show a separate safe error message.

If the user edits the Journal entry after generating an unsaved analysis response, the response should remain unchanged.

### System prompt

Use a fixed server-owned system prompt for this slice.

Suggested intent:

> You are a helpful financial analyst. Analyze the following trading journal entry. Identify observations, possible risks, decision-quality patterns, and questions the trader may want to reflect on. Do not provide personalized financial advice or instructions to buy or sell securities.

Future configurable personas should be explicitly deferred.

## Non-goals

Do not include these in the first slice unless a later spec explicitly expands scope:

- saving AI analysis responses;
- analysis history;
- follow-up questions or multi-turn chat;
- configurable prompts;
- selectable or configurable personas;
- analysis of multiple Journal entries, selected entries, weeks, months, or the full Journal;
- analysis entry points from Week, Month, or All review rows;
- portfolio, positions, NAV, margin, rules, or market context injection;
- AI memory, embeddings, retrieval, or long-term facts;
- background or scheduled analysis;
- model comparison or multi-provider analysis;
- user-editable tool calls or agent workflows;
- automatic trading recommendations.

## Suggested architecture

### API endpoint

Suggested endpoint:

```text
POST /api/journal/entries/:entryId/analyze
```

Suggested request body:

```json
{
  "connectionId": "..."
}
```

Suggested response:

- a streaming HTTP response using `fetch`;
- either plain text chunks or server-sent-event formatted chunks over the fetch response body;
- a clear terminal event or normal stream close on success;
- a safe error response when validation fails before streaming begins.

### AI package extension

Extend the shared AI package with a provider-neutral streaming contract rather than implementing provider calls directly in the Journal route.

The existing AI provider package already supports non-streaming connection tests. This feature should add a parallel streaming invocation path that future AI features can reuse.

Suggested shape:

- provider adapters expose a streaming text method;
- the shared invocation helper owns timeout, abort, safe failure classification, and chunk normalization;
- provider-specific modules translate OpenAI, Azure OpenAI, and Google Gemini streaming formats into a common stream of text chunks.

### Frontend experience

The Journal UI can start simple:

- an "Analyze with AI" button on the Day view near the current entry actions;
- a dropdown selector showing only ready AI connections in alphabetical order;
- automatic preselection of the alphabetically first ready AI connection;
- a Start analysis button;
- a streaming Markdown output panel;
- an empty panel and disclaimer before the first analysis starts;
- loading, cancel, retry, and error states.

If cancellation is included, it should abort the underlying provider request rather than only hiding the UI state.

## Constraints and safety notes

- Preserve Journal privacy boundaries: users may only analyze their own Journal entries.
- Preserve organization scoping for AI connections.
- Never expose stored provider secrets to the frontend.
- Avoid logging Journal content, prompt payloads, provider responses, access tokens, or credentials.
- Make clear that generated analysis is informational and reflective, not personalized financial advice.
- Include disclaimer copy near the result: "AI-generated analysis can be incomplete, inaccurate, or misleading. Use it as a reflection aid, not as financial advice or a recommendation to buy, sell, or hold any security."
- Add a Journal-analysis-specific rate limit. Custom timeout and output-length policy can be revisited in a future refinement.
- Use a server-owned prompt so future prompt/persona work can be introduced deliberately.

## Decisions already captured

- Day-view action label recommendation: "Analyze with AI".
- Ready AI connections should be shown in a dropdown sorted alphabetically.
- The sort should use connection label, with provider display name as the tie-breaker.
- The alphabetically first ready connection should be preselected.
- Cancellation should abort the provider request and preserve partial streamed Markdown.
- The cancellation action should be labeled "Stop generating".
- Retry should reuse the currently selected connection by default.
- Use the suggested disclaimer copy unless the business-requirements agent makes a minor tone edit.
- Journal analysis should have its own rate limit.
- Custom timeout and output-length policy is deferred for future refinement.

## Definition of done candidate

- A user can select one existing Journal entry.
- A user can select one ready AI connection.
- The backend validates Journal ownership and AI connection organization scope.
- The backend sends the Journal entry to the selected provider using a fixed financial-analyst system prompt.
- The frontend displays the response incrementally as it streams.
- The response is not saved.
- No follow-up questions are supported.
- Secrets, prompt payloads, and Journal content are not logged.
- Errors and missing-ready-connection states are clear and actionable.
