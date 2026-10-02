# Changelog Acknowledgment Persistence Design

## Status and scope

- Plan: [0009-in-app-changelog](../plans/closed/0009-in-app-changelog.md), task T-01.1
- Status: design complete; implemented and verified in T-02.1; current schema is documented in [current.md](./current.md)
- Scope: durable per-user acknowledgment of published dated sections in the changelog
- Out of scope: runtime/API implementation, changelog fetch/parse implementation, general preferences, notification state, profile export changes, and a changelog-specific content cache

This design implements the approved persistence direction in [Spec 0009](../specs/0009-in-app-changelog.md) and follows [ADR 0001](../ADRs/0001-organization-aware-data-access.md), [ADR 0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md), [ADR 0013](../ADRs/0013-deployment-modes-and-passwordless-local-profiles.md), and [ADR 0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md). Acknowledgment is presentation state owned by the authenticated user, not organization-shared state or portable profile content.

## Decision summary

Add one normalized `ChangelogAcknowledgment` row for each acknowledged stable dated-section identity and authenticated user. Persist the exact stable heading identity, the direct `organizationId`, and the direct `userId`; enforce one row per `(organizationId, userId, sectionIdentity)`. Reads and writes use both verified scope values. Each acknowledgment is an idempotent insert, so concurrent clients union their acknowledged section sets rather than replacing one another's state.

Use the existing globally shared `HelpRuntimeCache` row keyed by the fixed `changelog` channel for validated Markdown and the section identities derived from that same snapshot. No changelog cache table or cache-schema migration is needed.

## Model contract

T-02.1 should add a Prisma model mapped to `changelog_acknowledgments` with this shape:

| Field | Type/nullability | Contract |
| --- | --- | --- |
| `id` | `String`, required, primary key | CUID-style row identity following existing models; not a release-note identity |
| `organizationId` | `String`, required | Direct organization scope on this user-owned record, per ADR 0001 |
| `userId` | `String`, required | Direct owner; identifies the authenticated user/profile |
| `sectionIdentity` | `String`, required | Exact stable top-level dated heading identity extracted from the validated `CHANGELOG.md` snapshot; preserve authored case and wording rather than deriving a mutable body hash |

There is no scalar last-view timestamp, current release pointer, per-device state, or copied changelog body. The set of rows is the durable state. No `createdAt` timestamp is required to answer the approved unread-state contract.

### Relationships and delete behavior

- Add a direct `Organization` relation on `organizationId`, with `onDelete: Restrict` and `onUpdate: Cascade`, following `JournalEntry` and `InvestorProfile`.
- Add a `User` relation whose foreign key is the pair `(organizationId, userId)` referencing `(organizationId, id)` on `User`, with `onDelete: Cascade` and `onUpdate: Cascade`. This preserves direct tenant scope and also makes it impossible to attach a row to a user from a different organization.
- Add the corresponding collection relations to `Organization` and `User`.
- Because the composite user foreign key needs a unique referenced key, add `@@unique([organizationId, id])` to `User`. `id` remains its primary key; the additional unique key exists to support the tenant-consistent relation.
- The database-design implementation must express both direct relations in Prisma and generate the migration. If the repository's Prisma version cannot represent the overlapping `organizationId` relation scalar fields, stop and resolve the relational representation before migration; do not silently weaken the tenant invariant.

This tightens an existing integrity gap: `JournalEntry` and `InvestorProfile` currently follow separate organization and user foreign keys, which do not by themselves prevent a mismatched organization/user pair. Their exact current patterns are visible in [schema.prisma](../../packages/database/prisma/schema.prisma) and the [Journal migration](../../packages/database/prisma/migrations/20260830_add_journal_entries/migration.sql) and [Investor Profile migration](../../packages/database/prisma/migrations/20260906195425_add_investor_profiles/migration.sql). The new relation will preserve those models' direct organization relation and additionally enforce that the owner belongs to that organization.

## Identity, constraints, and indexes

- Primary key: `id`.
- Unique constraint: `(organizationId, userId, sectionIdentity)`. This is the database invariant for one acknowledgment per user and stable dated section.
- Reject an empty `sectionIdentity` at the application validation boundary and with a database `CHECK` constraint. Do not lowercase, trim, hash, or otherwise transform the parsed stable heading identity for persistence.
- Foreign keys: `organizationId -> organizations.id` (`RESTRICT`) and `(organizationId, userId) -> users(organizationId, id)` (`CASCADE`).
- Add the `User` unique key `(organizationId, id)` for the composite owner relation.
- The acknowledgment unique index begins with `(organizationId, userId)`, so it serves the expected scoped read of all a user's acknowledged headings and the explicit profile-deletion predicate `(organizationId, userId)`. It also enforces uniqueness and supports point membership checks by the full key.
- Do not add standalone acknowledgment indexes on `organizationId`, `userId`, or `sectionIdentity`: the expected access paths are covered by the compound unique index, and no organization-wide scan or section-only lookup is in scope. The User composite unique index is the required referenced key, not a speculative query index.

The application content parser must bound the repository document before caching, following the runtime-content payload size limit in the existing Help design. An acknowledgment write must only accept identities in the validated changelog snapshot; arbitrary client strings must not become rows.

## Read/write and concurrency contract

Every store operation receives `organizationId` and `userId` from the calling protected API/service, which derives them from verified `request.user`. Never take either value as an authorization scope from request body, query, or headers.

- Read acknowledged identities with a predicate containing both `organizationId` and `userId`; select only `sectionIdentity`.
- Compute unread identities as the published identity set from the selected validated content snapshot minus the scoped stored set.
- Insert each accepted identity with both scope fields. Use the compound unique constraint as the concurrency arbiter and idempotent insert semantics equivalent to PostgreSQL `ON CONFLICT DO NOTHING` (Prisma `createMany` with duplicate skipping is an appropriate implementation if supported by the repository's configured provider).
- Repeated acknowledgments, including simultaneous inserts from different devices, are success-shaped idempotent operations: a duplicate row is retained once and no valid acknowledgment from another request is overwritten.
- No single high-water mark or whole-set replacement is allowed. A client that renders stale content acknowledges only the identities in that content snapshot; identities appearing later remain unread.
- Scope any bulk insert and all reads by the verified values in their row data / predicates. The composite foreign key independently rejects a mismatched user/organization pair.

This matches the existing `JournalEntry` pattern of a compound organization/user uniqueness key, while using a separate feature-owned record because acknowledgment is not Journal content or a general preference. See the existing `JournalEntry` model and `@@unique([organizationId, userId, localDate])` in [schema.prisma](../../packages/database/prisma/schema.prisma).

## Backup and profile deletion lifecycle

- Keep acknowledgments out of `getProfileBackup`, the `ProfileBackupPayload` type/schema, and `_meta.sections`. The current export in [authStore.ts](../../packages/database/src/authStore.ts) explicitly constructs only profile, investor-profile, and Journal data; do not add acknowledgment reads or output fields. The rationale is that reading acknowledgment is nonessential presentation state, not user-authored or portable profile content, as expressly decided in Spec 0009.
- Extend `deleteProfile` in [authStore.ts](../../packages/database/src/authStore.ts) to explicitly call `deleteMany` for acknowledgments inside its existing Prisma transaction, scoped by both `organizationId` and `userId`, before deleting the user. Follow the same explicit `Promise.all` child cleanup pattern currently used for journal entries, investor profiles, refresh tokens, and OAuth providers.
- The user foreign key's `onDelete: Cascade` is defense in depth; explicit deletion in the existing transaction is still required and tested under ADR 0014. A failure anywhere in the transaction must roll back acknowledgment cleanup and profile deletion together.
- Profile/account deletion removes all of that user's acknowledgment state. Organization deletion remains restricted while organization-owned user records exist, consistent with current organization relations.

## Runtime cache compatibility

`HelpRuntimeCache` is already a global row uniquely keyed by `channelId`, with nullable JSONB `indexPayload` and `contentPayload`, required-object checks when a payload exists, and an atomic all-populated-or-all-null payload boundary. Its store's `getLastValid` checks that both JSON objects and the version metadata are present; Help-specific shape validation occurs above the store. The schema and exact boundary are in [schema.prisma](../../packages/database/prisma/schema.prisma), [helpContentStore.ts](../../packages/database/src/helpContentStore.ts), and migration [20260907092621_add_help_runtime_cache](../../packages/database/prisma/migrations/20260907092621_add_help_runtime_cache/migration.sql).

**Conclusion: the existing cache can represent the changelog channel without a new table or cache migration.** Use `channelId = "changelog"` and store:

- `indexPayload`: a validated channel descriptor/version object;
- `contentPayload`: one JSON object containing both the exact validated Markdown string and the dated-section identity array extracted from that same string;
- `schemaVersion`, `contentVersion`, and `effectiveAppVersion`: populate the existing required metadata contract with changelog-channel metadata. T-03.2 defines the channel's source-revision value for `contentVersion`; neither it nor `schemaVersion` is the release-note acknowledgment identity or an input to unread-state calculation. `fetchedAt` and freshness fields continue to describe the cache snapshot.

The current database store only requires object-valued JSON payloads plus complete metadata and does not require Help's `{pages, tooltips}` shape. The changelog loader must validate its channel-specific payload when reading, and failed/invalid refreshes must continue to preserve the last validated payload. The parser/refresh task T-03.2 owns the exact channel payload schemas and validation; this does not alter the persistence conclusion or authorize a parallel fetcher/cache.

## Migration safety and generated Prisma client

The implementation is an additive migration: add the `User` composite unique key, the new acknowledgment table, its scoped unique index, the non-empty identity check, and the foreign keys. Existing users have no acknowledgment rows, so there is no data backfill or reinterpretation. The initial empty set means all available dated sections are unread on first successful evaluation, matching the approved first-visit behavior.

Use the existing migration order and naming convention in `packages/database/prisma/migrations/`; do not edit an applied migration. Generate/apply through the repository scripts (`migrate:dev` for development, `migrate:deploy` for deployment), then run the database package's `generate`/`build` and targeted tests. The package's `generate` script runs Prisma generation and `scripts/sync-generated.mjs`; do not hand-edit generated Prisma client files. Update `docs/schema/current.md` only after the migration is actually applied and verified, as required by the database-agent workflow.

The new table has no preexisting rows to lock or backfill. Adding the referenced unique index to the existing `users` table is also additive, but the migration executor must assess the target database's user-row volume and deployment lock tolerance before applying it. The repository's current migrations use ordinary generated `CREATE INDEX`/`CREATE UNIQUE INDEX` operations; use that convention at current scale, or have database-design explicitly adapt the migration for concurrent index creation if the deployment's measured scale requires it. Do not claim migration completion from schema validation alone.

## Exact prior art

| Decision area | Existing pattern to reuse |
| --- | --- |
| Direct tenant column and organization FK | `JournalEntry` / `InvestorProfile`: direct `organizationId`, organization relation with `onDelete: Restrict`, and `@@index([organizationId])` currently present |
| Per-user ownership and cascade | `InvestorProfile.user`: `userId` relation to `User` with `onDelete: Cascade` |
| Compound owner uniqueness | `JournalEntry`: `@@unique([organizationId, userId, localDate])`; acknowledgment adds stable `sectionIdentity` as the final key component |
| Profile backup exclusion boundary | `AuthStore.getProfileBackup`: explicit assembly of only profile, investor profile, and Journal fields |
| Transactional lifecycle deletion | `AuthStore.deleteProfile`: transaction-scoped, explicit child `deleteMany` operations filtered by organization and user before deleting the User |
| Channel-keyed JSON cache and last-valid preservation | `HelpRuntimeCache` plus `createHelpContentStore`: unique `channelId`, object JSON payload columns, payload completeness check, and write/attempt operations that preserve last valid data |

## Exit-gate result

The persistence design specifies the model cardinality and relations, tenant/user integrity, uniqueness and access indexes, idempotent concurrency contract, backup exclusion, transactional deletion, additive migration and generated-client workflow, and confirms the existing channel cache is sufficient. No database-design blocker remains. T-02.1 may implement this design; T-03.2 may proceed once its other dependency, T-03.1, is complete.
