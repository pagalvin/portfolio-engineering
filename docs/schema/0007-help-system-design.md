# Help Runtime Cache Persistence Design

## Status and scope

- Plan: [0007-help-system](../plans/0007-help-system.md), task T-02.1
- Status: design complete; implementation is deferred to T-02.2
- Scope: the validated, global/system-scoped `help` runtime channel
- Out of scope: organization notes, tenant overrides, refresh-attempt history, GitHub credentials, and arbitrary repository paths

This design implements the database portion of [ADR 0009](../ADRs/0009-use-github-repo-sourced-runtime-content.md). It is intentionally not organization-owned data: [ADR 0001](../ADRs/0001-organization-aware-data-access.md) does not apply because this cache is system content shared by all authenticated application users. No `organizationId`, organization relation, or organization filter is permitted.

## Model

T-02.2 should add a Prisma model mapped to `help_runtime_caches`:

| Column | Type/nullability | Contract |
| --- | --- | --- |
| `id` | `String`, primary key | CUID-style database identity; not used as channel identity |
| `channelId` | `String`, required, unique | Fixed backend-owned identifier, initially exactly `help` |
| `indexPayload` | `Json`, nullable | Complete validated help index, including entries, aliases, hierarchy, paths, statuses, and `minAppVersion` values |
| `contentPayload` | `Json`, nullable | Complete validated referenced content set, normalized as `{ pages: { [key]: { markdown } }, tooltips: { [key]: { text } } }`; keys correspond to the validated index |
| `effectiveAppVersion` | `String`, nullable | Three-part semantic version used by the backend when validating/selecting this content set; metadata only, never a substitute for current-version validation |
| `contentVersion` | `String`, nullable | Version of the official help content set from the index; not an app version |
| `schemaVersion` | `Int`, nullable | Structural schema version from the index |
| `freshnessStatus` | `String`, required, default `unavailable` | `fresh`, `stale`, or `unavailable`; describes whether a usable cached payload is current according to the backend freshness policy |
| `lastRefreshStatus` | `String`, required, default `never_attempted` | `never_attempted`, `succeeded`, `failed`, or `invalid`; describes the latest download/validation outcome |
| `fetchedAt` | `DateTime`, nullable | Time of the latest successfully fetched and validated payload; never changed by a failed attempt |
| `lastDownloadAttemptAt` | `DateTime`, nullable | Time of every latest download attempt, including failed, invalid, and timed-out attempts |
| `createdAt` | `DateTime`, required | Row creation time |
| `updatedAt` | `DateTime`, required | Row update time |

`indexPayload`, `contentPayload`, and all three version columns are either populated as one successful payload or all null for an attempt-metadata-only row. The design permits the first startup attempt to be recorded even when GitHub has never supplied valid content. A database `CHECK` constraint should enforce the all-null/all-populated relationship and JSON object types; detailed schema, path, Markdown safety, plain-text, semver, and size validation remains an application boundary before writes.

### Validated JSON boundary

The store accepts only the already validated payload produced by the backend content loader. It must not accept a URL, filesystem path, raw GitHub response, executable content, or client-provided JSON. The loader owns allowlisting and validation; the database stores the validated result for reuse.

The application validation contract must bound the encoded payload before persistence: index JSON at 256 KiB, each Markdown page at 1 MiB, each tooltip at 8 KiB, and the complete content payload at 5 MiB. These limits protect the JSONB row and request path; they are not a reason to truncate content. A payload exceeding a limit is rejected and cannot replace the prior valid payload.

## Identity, constraints, and indexes

- `channelId` is the channel identity and has a unique constraint. There is exactly one cache row for `help`, whether it currently contains valid content or only attempt metadata.
- The primary key is `id`; no organization or user foreign key exists.
- `freshnessStatus` and `lastRefreshStatus` use application-owned string values with database `CHECK` constraints. PostgreSQL enums are deliberately avoided so adding a status is an additive application/migration change.
- A `CHECK` constraint must reject negative `schemaVersion` values when it is present.
- There are no foreign keys because the channel is system-owned and its source is repository configuration, not a database entity.
- The unique `channelId` index supports the only cache lookup and upsert pattern. No additional index is justified for the one-row-per-channel table.
- `lastDownloadAttemptAt` and `fetchedAt` do not need standalone indexes: the system never performs a time-range scan or attempt-history query.

## Freshness, update, and retention behavior

1. `recordDownloadAttempt` upserts the channel row and sets `lastDownloadAttemptAt` in the same database operation. It must not clear or replace a valid payload.
2. A successful validated refresh uses `writeValidatedPayload` to atomically replace both JSON payloads and all payload metadata, set both `lastDownloadAttemptAt` and `fetchedAt` to the successful fetch time (or their supplied event times), set `lastRefreshStatus=succeeded`, and set `freshnessStatus=fresh`.
3. An invalid, failed, or unavailable refresh updates attempt/status metadata only. It preserves the previous payload and `fetchedAt`, sets `lastRefreshStatus=invalid` or `failed`, and sets `freshnessStatus=stale` when a valid payload exists, otherwise `unavailable`.
4. Freshness is evaluated by backend policy using `fetchedAt`; the table does not hard-code a refresh interval. A valid payload can therefore be retained while reported stale.
5. `effectiveAppVersion` is recorded for observability, but every read rechecks the current effective app version against cached entry `minAppVersion`. A version mismatch never authorizes serving incompatible content.
6. There is no attempt-history retention requirement. Keep one row indefinitely, retaining the last valid payload until a newer valid payload replaces it or an explicit channel-retirement operation removes it. Do not delete valid content on refresh failure.
7. Future channels require an explicit design and may use the same table only if their payload, validation, and lifecycle contracts are compatible. They must not reuse `help` identity.

## Fallback semantics

The persistence layer returns the last valid cached content only when both payload JSON columns and their metadata are present and valid. Backend selection then applies current-version eligibility:

1. eligible fresh cached content;
2. eligible stale cached content, with stale metadata;
3. eligible bundled defaults;
4. an explicit unavailable result for a missing/incompatible topic.

The database store never reads bundled files, fetches GitHub, follows aliases, constructs paths, renders Markdown, or decides UI wording. A failed refresh cannot make invalid content visible and cannot erase a usable cache. If no valid cache exists, an attempt-only row remains useful for status/last-attempt display while bundled fallback remains outside the database.

## Store contract for backend consumers

T-02.2 should export a `HelpContentStore` with methods equivalent to:

- `get(channelId: string): Promise<HelpRuntimeCacheRecord | null>` — read global channel state, including status and timestamps.
- `getLastValid(channelId: string): Promise<HelpRuntimeCacheRecord | null>` — return only a complete validated payload; never return an attempt-only or failed replacement.
- `recordDownloadAttempt(input: { channelId: string; attemptedAt?: Date; status: 'failed' | 'invalid' }): Promise<HelpRuntimeCacheRecord>` — create/update attempt metadata without changing payload or `fetchedAt`.
- `writeValidatedPayload(input: { channelId: string; indexPayload: Json; contentPayload: Json; effectiveAppVersion: string; contentVersion: string; schemaVersion: number; attemptedAt?: Date; fetchedAt?: Date }): Promise<HelpRuntimeCacheRecord>` — atomically replace the complete valid set, record the successful attempt, and mark it fresh/succeeded.
- `markFreshness(input: { channelId: string; freshnessStatus: 'fresh' | 'stale' | 'unavailable' }): Promise<HelpRuntimeCacheRecord | null>` — update derived freshness state without changing content; scoped by `channelId`.

The store must constrain every operation by the fixed channel identifier and use an upsert for first-attempt creation. It must return safe typed records; callers must not receive raw database internals beyond validated JSON and metadata. No method accepts `organizationId` because this model is explicitly system-scoped.

## Migration and rollout safety

The migration is additive: create the new table, constraints, unique index, and the channel row only through normal store operation. It does not alter existing tables, add organization dependencies, backfill user data, or require a write to existing rows. Existing deployments can run the migration before backend code begins using the table.

The migration must not seed an unvalidated payload. If a seed row is needed, create only an attempt/status row with null payload columns, or let the first refresh create it. Rollback is a forward fix after deployment; dropping the table would discard the last valid cache and must not be used as an application-level refresh recovery. T-02.2 must verify migration application, Prisma generation, and preservation of a valid payload across failed/invalid refresh updates before updating `docs/schema/current.md`.

## Decisions and blockers

- Global scope and one-row channel uniqueness are fixed by the spec and ADR 0009.
- Payloads are stored as validated JSONB boundaries rather than separate page rows because the initial requirement is atomic replacement of one help content set and no per-topic query or history is required.
- No unresolved persistence decision blocks T-02.2. The backend task must still implement the stated validation/size limits and choose its concrete freshness interval; that interval is intentionally not a schema decision.
