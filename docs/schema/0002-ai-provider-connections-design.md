# Design: AI Provider Connection Persistence Model (Plan 0002)

- **Date:** 2026-09-05
- **Task:** T-02.1 — Designing the AI connection persistence contract
- **Owner:** database-design
- **Status:** Design complete; ready for T-02.2
- **Related ADRs:** [ADR 0001 — Organization-aware data access](../ADRs/0001-organization-aware-data-access.md), [ADR 0010 — Provider-defined BYOK schemas](../ADRs/0010-use-provider-defined-byok-schemas-for-ai-connections.md), [ADR 0011 — Encrypt AI provider credentials at rest](../ADRs/0011-encrypt-ai-provider-credentials-at-rest.md)
- **Spec:** [0002-ai-provider-connections](../specs/0002-ai-provider-connections.md)

## Summary

Add one organization-owned `ai_connections` table. It uses common identity and lifecycle columns plus provider-defined JSON payloads: non-secret configuration is readable application data, while recoverable credentials are stored only as an encrypted envelope. The database enforces organization-plus-label uniqueness; provider field validity, payload limits, encryption, and health derivation remain application responsibilities.

No provider-specific columns, provider-specific tables, or user ownership are introduced.

## Data model

### `ai_connections`

| Column | PostgreSQL / Prisma type | Nullability and default | Constraints and meaning |
|---|---|---|---|
| `id` | `TEXT` / `String` | not null; `cuid()` | Primary key. Opaque connection identifier. |
| `organizationId` | `TEXT` / `String` | not null | Foreign key to `organizations.id`; direct tenant scope required by ADR 0001. |
| `providerId` | `TEXT` / `String` | not null | Bundled provider-registry identifier, such as `azure-openai` or `google-gemini`; intentionally not a database enum so adding a provider requires no migration. |
| `label` | `TEXT` / `String` | not null | User-facing unique label within one organization. Application validation supplies a bounded, non-blank value. |
| `enabled` | `BOOLEAN` / `Boolean` | not null; `true` | Explicit user-controlled availability. Testing failures never change this column automatically. |
| `secretPayload` | `JSONB` / `Json` | not null | Encrypted crypto envelope only; never plaintext provider fields. |
| `configPayload` | `JSONB` / `Json` | not null | Provider-defined non-secret configuration, including exactly one model selection. |
| `lastTestedAt` | `TIMESTAMPTZ` / `DateTime` | nullable | UTC timestamp of the most recent attempted test, whether successful or failed. |
| `lastTestStatus` | `TEXT` / `String` | nullable | `success` or `failure`; application-owned vocabulary. Null means no test has been attempted. |
| `lastTestFailureKind` | `TEXT` / `String` | nullable | One of the fixed `failureKind` values from the spec on failure; null on success or no test. |
| `lastTestErrorSummary` | `TEXT` / `String` | nullable | Short sanitized user-facing failure summary; bounded by application validation (maximum 1,000 characters). Never raw provider response text or secrets. |
| `consecutiveFailureCount` | `INTEGER` / `Int` | not null; `0` | Count of consecutive failed tests. Successful testing resets it to zero. Must not be negative. |
| `createdAt` | `TIMESTAMPTZ` / `DateTime` | not null; `now()` | UTC creation timestamp; immutable. |
| `updatedAt` | `TIMESTAMPTZ` / `DateTime` | not null; ORM auto-update | UTC timestamp for any persisted edit, including enable/disable and test metadata. |

The implementation should add a check constraint for `consecutiveFailureCount >= 0` if Prisma migration support permits it; application validation is still required. `lastTestFailureKind` and `lastTestErrorSummary` are null for a successful result. A successful result may retain `lastTestedAt` and sets `lastTestStatus=success`.

### Relationships and deletion

- `organizationId -> organizations.id` uses `onDelete: Restrict`. Organization deletion must use an explicit retention/deletion policy rather than silently removing credentials.
- There is no `userId`: connections are organization-shared configuration, not private user records.
- No child tables are required for test history or rate limiting in this slice. Only the latest test metadata is durable; immediate test response text and latency remain ephemeral.

## JSON payload contracts

The provider registry is the authority for the accepted fields and validation. Payloads carry a `schemaVersion` so a future provider-definition change can be handled deliberately.

### Non-secret `configPayload`

The persisted shape is:

```json
{
  "schemaVersion": 1,
  "model": "provider-model-name",
  "endpoint": "https://example.invalid/",
  "deployment": "deployment-name",
  "apiVersion": "YYYY-MM-DD"
}
```

The selected provider's model identifier is required: Gemini stores it as `model`, while Azure OpenAI stores its model selection as `deployment`. `endpoint`, `deployment`, and `apiVersion` are present only when required by the selected provider. For the first slice, Azure OpenAI uses `endpoint`, `deployment`, and `apiVersion`; Gemini uses `model`. Unknown fields must be rejected by provider validation rather than persisted. Endpoint URLs and model/deployment names are non-secret but still validated and size-bounded.

### Secret payload before encryption

The provider-specific plaintext object exists only transiently in the server process:

```json
{
  "schemaVersion": 1,
  "apiKey": "write-only-provider-secret"
}
```

The registry classifies secret fields; the database layer must not infer that classification from field names. Future providers may have more than one secret field.

### Persisted encrypted `secretPayload`

`secretPayload` contains the crypto package's self-describing authenticated envelope, never the plaintext object:

```json
{
  "version": 1,
  "algorithm": "aes-256-gcm",
  "keyVersion": "active-key-version",
  "iv": "base64url",
  "authTag": "base64url",
  "ciphertext": "base64url"
}
```

The encryption key is not stored in PostgreSQL. The envelope is not returned by list/read APIs, and decryption is limited to the server-side invocation path immediately before a provider call. Exact encoding and field names follow `packages/crypto`; this document defines the persistence boundary, not a second crypto implementation.

### Test metadata and API mapping

The durable columns map to the spec's test result as follows:

- `lastTestedAt` → `testedAt`
- `lastTestStatus` → `status`
- `lastTestFailureKind`, `lastTestErrorSummary` → failure `failureKind` and safe `message`
- `lastTestStatus=success` has no durable response text or latency
- `consecutiveFailureCount` drives escalation; `providerStatusCode`, response text, and latency are response-only and are not persisted

## Derived health and disabled behavior

Health is derived server-side and exposed by the API; it is not a separate mutable database column:

1. `enabled=false` → `disabled`
2. `enabled=true` and `lastTestStatus` is null → `untested`
3. `enabled=true` and `lastTestStatus=success` with count zero → `ready`
4. `enabled=true` and `lastTestStatus=failure` with count greater than zero → `failing`

**Resolved R-2:** disabling a connection does not clear or rewrite test metadata. The failure count, last outcome, failure kind, and safe summary are retained for diagnostics and re-enable behavior. While disabled, `disabled` takes precedence over any retained failure state. Re-enabling derives the retained state: a prior failure returns to `failing` (and remains escalated if its failure policy says so), a prior success returns to `ready`, and no prior test returns to `untested`. Enable/disable is never an implicit test and never resets the count.

An edit to label, provider configuration, or secret invalidates a prior successful result so stale configuration is not shown as ready, but it preserves a prior failure result and its metadata while the user repairs the connection. A pure enable/disable operation does not invalidate test metadata. Only a successful test clears `lastTestFailureKind`, `lastTestErrorSummary`, and resets `consecutiveFailureCount` to zero; a test failure increments the count. Deterministic `auth`, `not_found`, and `bad_request` failures are escalated immediately by application policy; transient failure kinds use the named configured threshold.

## Constraints and indexes

Database-enforced constraints:

- primary key on `id`
- foreign key `organizationId` to `organizations.id` with restrict deletion
- unique `(organizationId, label)`; duplicate labels in different organizations are allowed
- not-null constraints listed above
- `consecutiveFailureCount >= 0` check constraint where supported by the migration

Indexes to create:

- unique `(organizationId, label)`: label conflict checks and stable organization-scoped lookup
- `(organizationId)`: direct tenant-scoped list, read, update, delete, and aggregate access
- `(organizationId, enabled, updatedAt)`: active/needs-attention grouping and deterministic recent-change ordering without scanning another organization

No index is added to JSON keys, encrypted data, provider ID, or failure metadata: no required cross-organization or provider-field query needs those indexes in this slice, and encrypted values are not searchable.

## Store contract implications

Following `createJournalStore`, the implementation should expose a `createAiConnectionStore(prisma)` factory. Every method requires a verified `organizationId`; it must never accept client-supplied organization scope as authorization. Required operations are:

- create with validated provider ID, label, config payload, and encrypted secret payload; translate the composite uniqueness violation to a clear label conflict
- list organization connections with derived health state and no secret payload
- find by ID scoped by `organizationId`, returning no cross-tenant record
- update label/config and optional write-only secret replacement; blank secret preserves the encrypted value, edits preserve failure metadata, and edits invalidate only a prior successful result
- enable/disable scoped by organization, preserving test metadata
- delete scoped by organization
- record a test result atomically, updating last-test fields and the consecutive count
- an explicit invocation-only secret access/decrypt operation, scoped by organization and connection ID; this must not be used by list, read, or presentation paths

Store results should expose safe persistence records, never plaintext secrets or decrypted JSON. API/application code derives health from the record (or receives a store-provided derived value) and owns provider-registry validation, rate limiting, error sanitization, and test response shaping.

## Lifecycle, limits, and migration safety

- Create requires a supported provider definition, valid provider-specific payloads, a non-blank bounded label, and a non-empty secret where the provider requires one. A duplicate `(organizationId, label)` returns a conflict without revealing credentials.
- Updates preserve secrets on blank write-only fields and replace them only after encrypting the new value. Provider changes, if allowed by the API, must validate the complete replacement payload and secret before writing; otherwise the API should treat provider ID as immutable for an existing connection.
- Tests load only the scoped record, decrypt immediately before invocation, and persist sanitized metadata after completion. Test response text and latency are ephemeral.
- Delete is explicit and permanent for the connection and its encrypted credentials. There is no soft-delete requirement; disabling is the reversible user-controlled lifecycle state.
- Initial migration is additive and has no backfill: the table starts empty. Apply the migration before store/API rollout; generated Prisma client and `docs/schema/current.md` must be updated together in T-02.2.
- Rollback before production data exists can drop the new table and revert the client. Once connections exist, rollback requires a forward fix or an export/re-entry plan; do not silently drop credentials.

## Persistence test metadata

Targeted tests for the migration/store must prove:

1. `(organizationId, label)` rejects duplicates within one organization and permits the same label in another organization.
2. Every read/write/update/delete/test-metadata operation is tenant-scoped; another organization's ID cannot retrieve or mutate a connection.
3. List/read/create/update responses contain no plaintext secret and list/read do not decrypt.
4. Blank secret update preserves the encrypted envelope; non-empty update replaces it.
5. Config/secret edits clear test metadata; enable/disable retains it.
6. Failed tests increment the count, success resets it, and derived health follows the disabled precedence and re-enable rule above.
7. Organization deletion is restricted and connection deletion is explicit.
8. The persisted JSON contains only the encrypted envelope in `secretPayload`, while `configPayload` contains no secret-classified field.
