# ADR 0011: Encrypt AI provider credentials at rest

- Status: draft
- Date: 2026-09-05
- Audience: [architect-agents, coding-agents, testing-agents, humans]

## Applicable When

- Storing user-supplied AI provider credentials such as API keys.
- Building backend paths that read credentials in order to call an AI provider.
- Designing API responses, logs, telemetry, or error messages that touch records containing secrets.
- Introducing any future feature that must store a secret and later retrieve its plaintext value, such as broker credentials or outbound webhook signing keys.
- Not applicable to values that never need recovery, such as password or refresh-token verification material, which should continue to use one-way hashing.

## Context

- The BYOK model in [ADR 0010](./0010-use-provider-defined-byok-schemas-for-ai-connections.md) requires P/OS to store credentials belonging to the user and present them to the provider on every call.
- These credentials must be recoverable in plaintext at call time, so hashing is not an option.
- This is the first reversible secret-at-rest requirement in the codebase. The only existing cryptography is a one-way SHA-256 hash used for refresh tokens, which cannot serve this purpose.
- Because it is the first, whatever pattern is established here will be inherited by later secret-bearing features. Getting it wrong is expensive to unwind across multiple features.
- These are real credentials with real spending power attached. A leaked provider key can be used to run inference at the user's expense.
- P/OS runs in both hosted and self-hosted modes, so the key source must work in both without requiring a managed secret service.
- The source discussion in [ai integration.md](../brainstorming/InitialAIWork/ai%20integration.md) left the location of the encryption helper unresolved, proposing the database package, a dedicated package, or an application package.

## Decision Statement

Encrypt AI provider credentials at rest using authenticated symmetric encryption with a per-record initialization vector. Implement encryption in a dedicated crypto utility package, source the key from a server-only environment variable, decrypt only within server-side execution paths that are about to call a provider, and never return, log, or otherwise emit secret values.

## Decision Drivers

- Credentials must be recoverable, which rules out hashing.
- Tampering with stored ciphertext should be detectable, not silently decrypted.
- The key must never live in the database alongside the data it protects.
- Self-hosted deployments must work without a managed key service.
- The crypto surface should be small enough to audit and reuse.
- Secret exposure through responses and logs is a more likely failure mode than cryptographic attack, so the decision must address both.

## Options Considered

### Authenticated symmetric encryption (AES-256-GCM) in a dedicated package

- Pros:
  - Provides confidentiality and integrity; tampered ciphertext fails to decrypt rather than returning corrupted plaintext.
  - Available in the Node standard library, so no new dependency.
  - A dedicated package keeps the crypto surface small, auditable, and reusable.
  - No coupling between secret handling and the ORM.
- Cons:
  - Requires disciplined per-record IV handling.
  - Key rotation requires a deliberate re-encryption story.
  - One more package in the workspace.

### Encryption helper inside the database package

- Pros:
  - Close to the persistence code that uses it.
  - No new package.
- Cons:
  - Couples a security primitive to ORM concerns.
  - Invites incidental use of ORM internals from crypto code.
  - Harder to audit the security surface in isolation.
  - Non-persistence consumers must depend on the database package to encrypt.

### Unauthenticated encryption (such as AES-CBC)

- Pros:
  - Widely available and well understood.
- Cons:
  - No integrity guarantee; tampering is not detected.
  - Requires separate MAC construction to be safe.
  - No advantage over GCM here.

### Database-native or disk-level encryption only

- Pros:
  - Transparent to application code.
  - Protects against stolen media or backup files.
- Cons:
  - Any database read returns plaintext, so application bugs and injection still expose secrets.
  - Inconsistent availability across hosted and self-hosted deployments.
  - Does not address exposure through API responses or logs.

### Managed secret service (such as a cloud key vault) as the store

- Pros:
  - Strong operational key management and audit logging.
- Cons:
  - Adds an external dependency unsuitable for local and self-hosted installs.
  - More operational setup for a self-hosted user.
  - Better suited as a key *source* in hosted mode than as the store for every record.

## Chosen Approach and Rationale

- Use AES-256-GCM because authenticated encryption detects tampering, and because it is available in the Node standard library without adding a dependency.
- Use a unique initialization vector per record. A fixed or reused IV under the same key is a well-known way to undermine the scheme, so this is a requirement rather than a detail.
- Store the IV and authentication tag alongside the ciphertext, since they are not secret and are required for decryption.
- Place the implementation in a dedicated crypto utility package so the security-relevant surface is small, independently auditable, and reusable by future features without pulling in ORM or application dependencies.
- Source the key from a server-only environment variable so it never sits in the database beside the ciphertext it protects. In hosted mode the variable can be populated from a managed key vault; in self-hosted mode it comes from local configuration.
- Treat database encryption and disk encryption as complementary defenses rather than substitutes, because neither prevents an application-level read from returning plaintext.
- Address exposure paths explicitly. Encryption at rest is defeated by a secret that gets echoed in an API response or written to a log, and that is the more probable failure.

## Consequences and Tradeoffs

- Losing the encryption key makes stored credentials unrecoverable. Users would need to re-enter them. Key material becomes operationally significant and must be backed up accordingly.
- Key rotation requires reading and re-encrypting existing records, so the stored format should carry enough information to support a future rotation without guesswork.
- Encrypted values cannot be searched, indexed, or compared in the database.
- Update flows become slightly more complex because secrets must be write-only, with a blank submission preserving the stored value.
- A dedicated package adds a small amount of workspace overhead, accepted in exchange for auditability.
- Every future secret-bearing feature inherits this pattern, which is the intent.

## Guidance for Architect Agents

- Treat this ADR as the general rule for any value that must be stored and later recovered in plaintext, not as an AI-specific exception.
- Continue to use one-way hashing for values that only need verification. Reversible encryption is strictly for values that must be presented to an external system.
- Keep the crypto package free of ORM, HTTP, and application dependencies so it stays auditable.
- Treat the environment variable as a key source abstraction. Hosted deployments may populate it from a managed vault without changing application code.
- When a new feature needs secret storage, extend this pattern rather than introducing a second scheme.

## Guidance for Coding Agents

- Implement encryption in a dedicated crypto utility package. Do not place it in the database package or inline it in feature code.
- Use AES-256-GCM with a freshly generated initialization vector for every record.
- Persist the IV and authentication tag with the ciphertext.
- Read the key from a server-only environment variable. Never prefix it in a way that exposes it to the frontend build, and never persist it in the database.
- Fail fast at startup if the key is missing or malformed, rather than degrading to unencrypted storage.
- Decrypt only inside server-side execution paths immediately before calling a provider. Do not decrypt in list, read, or render paths.
- Treat secret fields as write-only in APIs. Omit them from responses entirely rather than masking them.
- On update, preserve the stored secret when the field is blank and replace it when a value is supplied.
- Exclude secret values from logs, error messages, telemetry, and exception payloads.
- Never pass a raw provider error body through to the client without filtering, since it may echo submitted credentials.
- Apply [ADR 0001](./0001-organization-aware-data-access.md); credential records are organization-owned data.

## Guidance for Testing Agents

- Verify that stored credential values are not readable as plaintext in the database.
- Verify that no API response includes a secret value, including create and update responses.
- Verify that a blank secret field on update preserves the stored value, and a supplied value replaces it.
- Verify that tampered ciphertext fails to decrypt rather than yielding corrupted plaintext.
- Verify that two records holding the same secret value produce different ciphertext, confirming per-record IV use.
- Verify that the application fails clearly at startup when the key is missing or malformed.
- Verify that secrets do not appear in application logs, error output, or telemetry during success, validation failure, or provider failure.
- Verify that provider error responses surfaced to the client do not echo credential material.

## Do

- Encrypt recoverable secrets at rest using AES-256-GCM.
- Generate a unique initialization vector per record.
- Store the IV and authentication tag with the ciphertext.
- Keep encryption in a dedicated, dependency-light crypto package.
- Source the key from a server-only environment variable.
- Fail fast when key material is absent or invalid.
- Decrypt only in server-side paths that are about to use the secret.
- Treat secret fields as write-only across all APIs.

## Do Not

- Do not hash values that must later be recovered in plaintext.
- Do not use a fixed or reused initialization vector.
- Do not store the encryption key in the database.
- Do not expose the key to the frontend or any client-side build.
- Do not return secret values from any API, masked or otherwise.
- Do not write secrets to logs, telemetry, error messages, or crash payloads.
- Do not decrypt secrets in list, read, or presentation paths.
- Do not rely on database or disk encryption as the only protection.
- Do not pass raw provider error bodies to clients without filtering.
- Do not silently fall back to unencrypted storage under any condition.

## Open Questions and Follow-up Items

- Define the key rotation and re-encryption procedure, including whether stored records should carry a key version identifier from the outset.
- Decide the hosted-mode mechanism for populating the environment variable from a managed key vault.
- Decide whether encryption operations warrant audit logging, and confirm such logging cannot itself leak secret material.
- Define operator guidance for backing up key material, given that key loss makes credentials unrecoverable.
