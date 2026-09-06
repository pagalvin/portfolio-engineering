# Debugging Log: 0003 Journal Entry AI Analysis

- Spec: [spec](../specs/0003-journal-entry-ai-analysis.md)
- Plan: [plan](../plans/closed/0003-journal-entry-ai-analysis.md)
- Status: closed

## Reusable lessons

- A connection with a previously successful test can become operationally stale if the runtime encryption key or stored credential envelope no longer matches the current environment; manual AI workflow verification should include a fresh connection test in the same runtime immediately before analysis retry/completion checks.

## Issue history

### 001: Ready connection fails runtime preparation during retry

- Date: 2026-09-05
- Status: resolved
- Environment: runtime
- Severity: major
- Reported behavior: During T-06.2 manual runtime verification, demo auth worked and a saved Day entry existed/was created. The AI connection API reported four connections, including three ready connections and one non-ready connection. The Journal analysis panel preselected the first ready connection and showed only the three ready connections. Streaming began successfully, **Stop generating** aborted the request, and partial output remained visible. Retrying with the selected connection ID returned HTTP 400 with the safe user-facing message that the selected AI connection could not be prepared for analysis. Refresh/navigation cleared the transient analysis output as expected. Full retry/completion verification is blocked by the ready-connection preparation failure.
- Evidence and reproduction: Manual local browser workflow against the protected Journal Day analysis UI. The failure occurs on `POST /api/journal/entries/:entryId/analyze` after selecting retry with the same ready connection. The safe 400 message maps to the analysis API credential-preparation/decryption failure path, not to the not-ready readiness check or provider streaming error path.
- Affected areas: `apps/api/src/plugins/journalAnalysis.ts`, `packages/database/src/aiConnectionStore.ts`, stored AI connection credential/config records for the local runtime, and T-06.2 manual verification notes.
- Contract and ADR review: Spec 0003 requires retry to reuse the selected ready connection by default and requires provider credentials to be decrypted only on the server invocation path without exposing credentials, prompt payloads, provider raw errors, access tokens, or Journal content. ADR 0001 scoping is preserved because the endpoint derives organization/user scope from verified auth context and loads scoped Journal/connection records. ADR 0010 keeps provider-specific fields in registry-defined JSON payloads. ADR 0011 requires encrypted credentials at rest and safe failure messages; the observed 400 message is appropriately safe, but a ready connection that cannot be prepared blocks the verified runtime workflow.
- Root cause: The selected connection is classified as ready from persisted metadata (`enabled` plus `lastTestStatus: success`), but the analysis route fails while preparing the credential for invocation. In the current code, the exact safe message "The selected AI connection could not be prepared for analysis." is returned only when `aiConnectionStore.decryptSecretForInvocation(...)` throws, which indicates a local stored credential envelope/runtime encryption-key mismatch or malformed stored secret payload for that connection. Because no secrets or raw credential payloads may be logged here, the precise credential value was not inspected.
- Resolution: The local workflow was retested after the blocker was addressed outside source code. Human manual verification on 2026-09-05 confirmed Azure OpenAI and Gemini are fully tested and working and non-ready connections are not selectable. No code correction was applied specifically for the local credential-preparation failure.
- Verification: Reviewed the feature spec, plan T-06.2 verify condition, UX contract, ADR 0010/0011, and the affected code paths. The reported HTTP 400 safe message was traced to the credential decryption/preparation catch block in `apps/api/src/plugins/journalAnalysis.ts`. Runtime completion is now verified by the human manual test confirmation for Azure OpenAI and Gemini.
- Follow-up: Route to `backend-coding` if the team wants the analysis API to mark a connection as failing when invocation-time credential preparation fails, so stale "ready" metadata is cleared after this condition. Route to the local operator/human to re-enter or recreate the affected local AI connection credentials before rerunning T-06.2.
