# AI Integration Brainstorming

> Captures a discussion on "bring your own AI" (BYOA) integration for P/OS. Intended as input for an ADR/spec and for kicking off implementation of the first vertical slice.

## Vision

Users bring their own AI provider credentials ("bring your own AI"). P/OS calls out to the user's chosen provider(s) at runtime for in-app analysis (journal insights, portfolio analysis, etc.). We do not run or pay for inference ourselves — we orchestrate.

Candidate vendors: OpenAI, Anthropic, Google, Microsoft (Azure OpenAI), Meta (Llama, via a hosting layer), xAI (Grok), and potentially others (self-hosted/local models via an OpenAI-compatible endpoint).

## Core architectural direction

### Vercel AI SDK as the unifying abstraction

- Package: `ai` + per-vendor `@ai-sdk/*` packages (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/azure`, `@ai-sdk/xai`, etc.)
- **License confirmed: Apache License 2.0** (copyright Vercel, Inc.) — free, explicitly permits commercial use/modification/redistribution, includes a patent grant. No usage fees to Vercel; the only ongoing cost is per-token billing to whichever LLM vendor the user configures. Not tied to Vercel hosting.
- **Streaming confirmed as a first-class feature** — `streamText` streams token-by-token; helpers like `createUIMessageStream` / `toUIMessageStream` exist for wiring into a UI. We are not required to use their React hooks (`useChat`); we can consume the stream directly and drive our own component state.
- **Grok confirmed supported via first-party `@ai-sdk/xai` adapter** — not shackled to the OpenAI request/response shape.
- **Meta/Llama**: no direct public hosted API from Meta. Access via a host (Bedrock, Together, Groq, Fireworks) or self-hosted (Ollama). Plan to support these through an `"openai-compatible"` catch-all adapter as a general escape hatch for any vendor/host that speaks that dialect, rather than requiring a bespoke adapter per host.

### "Dispatcher with a provider registry" (not a "dispatcher of dispatchers")

Simplify the originally-floated "dispatcher of dispatchers" idea into: **one dispatcher, one provider registry**. The registry maps a `providerId` (`"openai"`, `"anthropic"`, `"xai"`, `"azure-openai"`, `"ollama-local"`, `"openai-compatible-custom"`, ...) to an adapter factory. Adding a new vendor means registering one more entry, not building a new dispatch layer. The `"openai-compatible"` entry is the fallback for anything without a first-party adapter.

### Package/app layout (mirrors existing monorepo conventions)

- New `packages/ai` — provider registry, dispatch/orchestration logic, adapter wrappers around the Vercel AI SDK. Mirrors how `packages/auth` and `packages/database` currently hold logic that `apps/api` consumes.
- `apps/api` — exposes routes (config CRUD, test/dispatch endpoints) that consume `packages/ai`.
- `apps/frontend` — settings/config UI, and eventually in-feature invocation UI (journal analysis, etc.).

## Multi-backend features (future, post-first-slice)

Three tiers of sophistication, in rough build order:

1. **Side-by-side**: same prompt fanned out to N configured providers via `Promise.allSettled`, rendered in parallel columns. Simplest; build first among the multi-backend features.
2. **Battle / critique ("adversarial AI")**: provider A responds, provider B critiques A, optionally A rebuts — N rounds. Model this as the first instance of a general, reusable **"orchestration recipe"** concept (a named, parameterized sequence of dispatch calls), not a hardcoded special case, since more multi-step workflows will likely follow (e.g., "summarize then critique," "N-way debate then a synthesis pass"). Open question to decide later: automatic end-to-end rounds vs. user clicks "next round" per step (leaning toward the latter initially — cheaper and gives the user control).
3. Invocation-time UX: separate "configure backends" (CRUD/list) from "select backend(s) for this run" (default single AI per feature, with an optional "compare mode" override for power users) — avoid making every feature surface a complex multi-select by default.

## Memory & context (future, post-first-slice)

Two distinct concepts that likely share a common table shape (`kind: 'ai_suggested' | 'user_authored'`, `status: 'proposed' | 'accepted' | 'rejected'`):

1. **AI-suggested facts (derived)**: AI proposes a fact inferred from user data (e.g., journal entries); surfaced in a review UI; user must approve/edit/reject before it enters the context used in future prompts. Never silently auto-accepted.
2. **User-declared context (authored)**: investment objectives, risk tolerance, time horizon, etc. Lean toward a small structured form for common fields plus an open free-text "anything else" box, rather than fully freeform, so prompt templates can rely on consistent fields while still allowing nuance.

Both feed the same "context block" prepended to prompts at dispatch time.

Longer-term open question (not needed for first slice): if durable memory later uses embeddings/vector search, decide whether to decouple the embedding model from the user's chosen chat/completion provider (e.g., always use one fixed internal embedding model) so memory retrieval doesn't break when a user swaps chat vendors. Postgres + `pgvector` would fit the existing Prisma/Postgres stack and works in both SaaS and self-hosted deployment modes.

## Analysts / personas (future, post-first-slice)

"Analyst" and "persona" are effectively the same underlying object: a named system-prompt/instruction bundle, distinguished by a `source` field.

- **Distribution model**: official analysts live as data (e.g., one JSON file per analyst, or an `analysts.json`) in a GitHub repo/folder, decoupled from app release cadence. Local (including self-hosted) installs can fetch/cache this feed independently of shipping a new app version — new analyst concepts can ship the day after they're written.
- **Three-tier merge in the UI**: "Official P/OS analysts" (curated feed) + "Community analysts" (same mechanism, less-curated folder/repo, if/when opened up) + "My analysts" (fully local/user-authored, never leaves the machine unless the user submits it upstream).
- **Fetch/cache strategy**: self-hosted instances poll the feed periodically or via an on-demand "check for new analysts" button, caching locally so it still works offline. SaaS mode could have the P/OS backend fetch once and fan out to tenants (avoids every self-hosted instance hammering GitHub directly, and gives us an optional moderation/staging gate).
- **Community contribution loop**: since it's just JSON in a repo, "contribute an analyst" can literally be a PR — low build effort initially; an in-app "export as PR-ready snippet" convenience button could come later.
- Moderation bar for "official" analysts is lightweight (prompts aren't a security surface the way credentials are) — just needs a human maintainer reviewing PRs.

## First vertical slice: "Hello, World" connectivity proof

Goal: prove the full plumbing (config storage → registry → adapter → provider call → UI) with the smallest possible real feature, launched from the existing System settings screen.

### Confirmed existing scaffolding to build on

- **Nav/route already scaffolded**: [scaffoldRoutes.ts](../../../apps/frontend/src/scaffoldRoutes.ts) already defines a `System` nav group → `settings` route (`/workspace/settings`, `status: 'placeholder-only'`) with placeholder blocks `['Preferences', 'Connections', 'Actions', 'Notes']`. The **"Connections"** block is the natural home for AI provider configuration — no new nav entry needed.
- **No existing reversible encryption utility.** The only crypto in the codebase today is `hashToken()` in [devAuthBootstrap.ts](../../../apps/api/src/lib/devAuthBootstrap.ts) — a one-way SHA-256 hash used for refresh tokens, unusable for API keys since we must retrieve/decrypt them later. This AI slice is the **first feature requiring reversible secret-at-rest storage** in the app.
- **Env var convention**: see [.env.example](../../../.env.example) — flat `KEY=` lines, `VITE_`-prefixed vars exposed to the frontend. A new `AI_CREDENTIALS_ENCRYPTION_KEY` (server-only, no `VITE_` prefix) should follow this pattern.

### Proposed build order

1. **Encryption helper** — AES-256-GCM via Node's built-in `node:crypto` (no new dependency; consistent with existing `node:crypto` usage). Store IV/nonce alongside ciphertext per row (not a fixed IV). Encryption key comes from an env var (`AI_CREDENTIALS_ENCRYPTION_KEY`), never stored in the database — Azure Key Vault-backed in SaaS (matching the `key-vault` Terraform module already in [architecture.md](../architecture.md)), a `.env` value for self-hosted. Candidate home: `packages/database` (alongside the Prisma client) or a new small `packages/crypto` if we want it decoupled.
2. **Schema/migration** — one table for AI backend configs: provider id, encrypted API key + IV, model name, friendly label, enabled/disabled flag. Add via Prisma migration in [packages/database](../../../packages/database), following existing migration conventions.
3. **`packages/ai`** — provider registry interface + exactly **one** real adapter wired up first (OpenAI or Anthropic — whichever we have a test key for). Use the Vercel AI SDK's `generateText` for this first pass (skip streaming here; prove request/response first, layer streaming in afterward).
4. **API routes** in `apps/api` — CRUD for backend configs (create/list/delete first; update can wait), plus `POST /api/ai/backends/:id/test` which loads the config, decrypts the key, calls the adapter with a hardcoded trivial prompt (e.g., "Say hello and confirm you're online"), and returns the raw text + latency + success/failure.
5. **Frontend** — flesh out the "Connections" block of `/workspace/settings`: list configured backends, an add-backend form (provider dropdown, key field, model field), and a "Test Connection" button per backend showing loading/success (AI's reply)/error states.

### Explicitly deferred past this slice

- Streaming to the UI (prove non-streaming request/response first)
- Multiple simultaneous backends / side-by-side / battle-critique
- Memory, facts table, user-declared context
- Analyst/persona catalog and feed
- Update flow for configs (create/list/delete only, initially)

## Open questions for next thread

- Confirm which single provider to wire up first for the "hello world" adapter (needs a live test key).
- Decide `packages/ai` vs. `packages/crypto` placement for the encryption helper, or whether it belongs directly in `packages/database`.
- Decide exact shape of the AI backend config table (single-tenant vs. org-scoped, given the app's existing organization-aware data access pattern per [ADR 0001](../../ADRs/0001-organization-aware-data-access.md)).
- Decide whether this warrants an ADR (architectural pattern: BYOA + provider registry) in addition to a spec (the settings screen + hello-world feature), following the `docs/ADRs` / `docs/specs` split already used elsewhere in this repo.