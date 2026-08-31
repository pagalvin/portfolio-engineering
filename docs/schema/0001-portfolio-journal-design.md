# Design: Journal Entry Persistence Model (Plan 0001)

- **Date:** 2026-08-30
- **Task:** T-02.1 — Designing the journal-entry persistence model
- **Owner:** database-design
- **Depends on:** T-01.2 (UX scaffold reconciliation) ✓
- **Status:** Design (awaiting implementation in T-02.5)
- **Related ADR:** [ADR 0001 — Organization-aware data access](../ADRs/0001-organization-aware-data-access.md)
- **Related UX:** [0001-portfolio-journal.md](../uxd/flows/0001-portfolio-journal.md)

---

## Summary

This document specifies the approved `journal_entries` persistence model before implementation. The model stores one Markdown entry per authenticated user per local calendar date, with organization-scoped data access, uniqueness constraints, and deterministic query patterns for day/week/month/all-entries views. Image and screenshot embedding is deferred to E-05 via a separate `journal_entries_media` relationship, documented here but not implemented until E-05.

---

## Context & Requirements

### From Spec (0001-portfolio-journal.md)

1. Private journal for authenticated users (user-owned, not org-shared in MVP).
2. One entry per calendar date (local, user's environment timezone).
3. Canonical storage format: Markdown.
4. Move entry to different date: explicit operation, reject if destination occupied.
5. Views by scope: day, week (Sunday–Saturday), month, entire journal.
6. Timezone-aware grouping using user-reported IANA timezone (per-request).
7. Image/screenshot embedding deferred to E-05; stored as Base64 in PostgreSQL.
8. No autosave, no draft recovery; unsaved changes are ephemeral.

### From UX Flows (0001-portfolio-journal.md)

- **Day view:** Load entry for YYYY-MM-DD; "no entry" state if missing.
- **Week view:** All entries for ISO 8601 week (YYYY-Www); may be partial/empty.
- **Month view:** All entries for calendar month (YYYY-MM); may be partial/empty.
- **All-entries view:** Reverse chronological, paginated.
- **Move operation:** User-facing "move to [date]" action; rejects if target date already has an entry.
- **Export:** Clipboard and download; must preserve Markdown content exactly.

### From ADR 0001

- Every organization-owned table must have direct `organizationId`.
- Scope all reads, writes, updates, deletes, aggregates by `organizationId`.
- Every store operation accepts verified `organizationId` and `userId`.
- Missing organization scope is an error.
- Direct scoping is required; do not rely only on foreign-key joins.

---

## Data Model

### Primary Table: `journal_entries`

Represents a single Markdown entry for one user on one local calendar date.

#### Fields

| Field | Type | Constraints | Notes |
|-------|------|---|---|
| `id` | string (CUID) | PK | Unique identifier |
| `organizationId` | string | FK → organizations.id; NOT NULL; indexed | **Direct organization scoping (ADR 0001)** |
| `userId` | string | FK → users.id; NOT NULL; indexed | Entry owner; user must belong to organization |
| `localDate` | date | NOT NULL; indexed | Calendar date in user's environment timezone; no time component |
| `content` | text | NOT NULL | Canonical Markdown; validates as Markdown on save; empty string not persisted (see Lifecycle) |
| `createdAt` | datetime | NOT NULL; default now() | Entry creation timestamp (UTC) |
| `updatedAt` | datetime | NOT NULL; default now(); auto-update | Last modification timestamp (UTC) |

#### Uniqueness & Primary Constraints

- **Primary key:** `id`
- **Unique constraint:** `(organizationId, userId, localDate)` — one entry per user per day
- **Indexed:** `organizationId`, `userId`, `localDate`, `(organizationId, userId, localDate)`
- **Foreign keys:**
  - `organizationId` → `organizations.id` with `onDelete: Restrict` (protect org data)
  - `userId` → `users.id` with `onDelete: Cascade` (clean up user's entries on user deletion)

#### Why Direct `organizationId`

Although entries are retrieved via user (which carries organizationId), direct scoping ensures:
- Query scoping by organization is explicit and cannot be bypassed via stale user state
- Bulk deletes or org-wide queries are direct and efficient
- Audit and retention policies can operate at org level without user joins
- Violates ADR 0001 if `organizationId` is inferred only from user relationship

### Forward Reference: `journal_entries_media` (E-05)

Image and screenshot embedding will be implemented in E-05 as a separate table, defined here to document the relationship.

#### Fields (to be implemented in E-05)

| Field | Type | Constraints | Notes |
|-------|------|---|---|
| `id` | string (CUID) | PK | Unique identifier |
| `organizationId` | string | FK → organizations.id; NOT NULL; indexed | Direct org scoping |
| `journalEntryId` | string | FK → journal_entries.id; NOT NULL; indexed | Parent entry |
| `mediaType` | enum | NOT NULL; values: `image/png`, `image/jpeg`, `image/webp`, `image/gif` | MIME type |
| `base64Data` | text | NOT NULL | Base64-encoded image payload; size limit TBD in E-05 design |
| `sizeBytes` | integer | NOT NULL | Unencoded image size for quota and storage planning |
| `createdAt` | datetime | NOT NULL; default now() | Upload timestamp |

#### Cardinality & Lifecycle (E-05 Design)

- Cardinality: `journal_entries` 1:N `journal_entries_media` (one entry may have multiple images)
- Cascade delete: Media deleted when entry is deleted
- Payload validation: Size limits, MIME type validation per E-05 design
- Orphan prevention: Media cannot exist without parent entry

**Note:** T-02.1 does not create this table. E-05 task (database-design agent) will document detailed size limits, storage constraints, and migration strategy in a separate design task before T-05.x implementation.

---

## Query Patterns & Indexes

Every query scopes by verified `organizationId` and `userId` from authenticated request context, never from client-supplied identifiers.

### Query 1: Get Entry for a Single Day

```sql
SELECT * FROM journal_entries
WHERE organizationId = $1
  AND userId = $2
  AND localDate = $3
LIMIT 1
```

- **Index:** `(organizationId, userId, localDate)` — composite for rapid lookup
- **Expected result:** 0 or 1 row (enforced by uniqueness constraint)

### Query 2: Get All Entries for a Week (ISO 8601 week context)

```sql
SELECT * FROM journal_entries
WHERE organizationId = $1
  AND userId = $2
  AND localDate >= $3  -- Sunday of week (computed in app)
  AND localDate <= $4  -- Saturday of week (computed in app)
ORDER BY localDate ASC
```

- **Index:** `(organizationId, userId, localDate)` satisfies the range query
- **Expected result:** 0–7 rows (may have partial week)
- **Note:** Week bounds computed by app in user's environment timezone; backend validates bounds

### Query 3: Get All Entries for a Calendar Month

```sql
SELECT * FROM journal_entries
WHERE organizationId = $1
  AND userId = $2
  AND date_trunc('month', localDate) = $3
ORDER BY localDate ASC
```

- **Index:** `(organizationId, userId, localDate)` supports range query
- **Expected result:** 0–31 rows
- **Note:** Month extracted by app; backend may use PostgreSQL `date_trunc()` or app-computed bounds

### Query 4: Get All Entries (Paginated)

```sql
SELECT * FROM journal_entries
WHERE organizationId = $1
  AND userId = $2
ORDER BY localDate DESC
LIMIT $3 OFFSET $4
```

- **Index:** `(organizationId, userId, localDate DESC)` — reverse chronological pagination
- **Expected result:** N rows (page size ≥ 1)
- **Note:** Pagination required for performance; assume 100+ entries per user over time

### Query 5: Check for Destination Conflict on Move

```sql
SELECT id FROM journal_entries
WHERE organizationId = $1
  AND userId = $2
  AND localDate = $3
  AND id != $4  -- exclude current entry
LIMIT 1
```

- **Index:** `(organizationId, userId, localDate)` — rapid conflict detection
- **Expected result:** 0 or 1 row
- **Logic:** Move operation checks if target date is occupied *before* allowing move; returns conflict error if destination occupied

---

## Lifecycle & Constraints

### Entry Creation

1. User submits non-empty Markdown text via POST `/api/journal/entries`
2. API validates:
   - `organizationId` and `userId` from verified JWT context (not from request body)
   - `localDate` provided as YYYY-MM-DD; must be a valid date
   - `content` non-empty (≥1 character) and valid Markdown
3. Backend checks: no existing entry for `(organizationId, userId, localDate)`
4. If exists: return 409 Conflict with "Entry already exists for this date"
5. If new: INSERT into `journal_entries` with `createdAt`/`updatedAt` = now()
6. Response: 201 Created with full entry record

**Empty Entry Rule:** An empty string is never persisted. Saving without content is a no-op or returns 400 Bad Request.

### Entry Retrieval

- GET `/api/journal/entries?mode=day&date=...` → single entry or 404
- GET `/api/journal/entries?mode=week&week=...` → 0–7 entries
- GET `/api/journal/entries?mode=month&month=...` → 0–31 entries
- GET `/api/journal/entries?mode=all&limit=...&offset=...` → paginated results

All queries filtered by `(organizationId, userId)` from auth context.

### Entry Update

1. User submits revised Markdown via PUT `/api/journal/entries/:entryId`
2. API validates:
   - `organizationId` and `userId` from JWT (not request)
   - `entryId` belongs to authenticated user in authenticated org (via uniqueness constraint)
   - New `content` is non-empty and valid Markdown
3. Backend UPDATE: set `content` = new value, `updatedAt` = now()
4. Response: 200 OK with updated entry

**No Partial Updates:** Only `content` may be updated. `localDate`, `organizationId`, `userId`, `createdAt` are immutable.

### Entry Move (explicit operation)

1. User invokes "move to [target-date]" action via POST `/api/journal/entries/:entryId/move`
2. Request body includes `targetLocalDate` (YYYY-MM-DD)
3. API validates:
   - `organizationId`, `userId` from JWT
   - `entryId` belongs to user in org
   - `targetLocalDate` is a valid date
4. Backend checks: does an entry already exist at `(organizationId, userId, targetLocalDate)`?
   - **If yes:** Return 409 Conflict with "You already have an entry on [target-date]"
   - **If no:** UPDATE `journal_entries` SET `localDate` = targetLocalDate, `updatedAt` = now()
5. Response: 200 OK with moved entry or 409 Conflict error

**Move Result:** Successful move updates `localDate` in place; no new row is created. `id`, `createdAt`, `organizationId`, `userId` remain unchanged.

### Entry Deletion

1. User deletes entry via DELETE `/api/journal/entries/:entryId`
2. API validates:
   - `organizationId`, `userId` from JWT
   - `entryId` belongs to user in org
3. Backend: DELETE from `journal_entries` WHERE `id` = entryId AND `organizationId` = ... AND `userId` = ...
4. Response: 204 No Content (or 200 OK with deleted record)

**Cascade:** If E-05 adds `journal_entries_media`, deleting an entry cascades to its media rows.

### User Deletion Cascade

- When a user is deleted (via `users` table cascade), all their entries are deleted
- Foreign key: `userId` → `users.id` with `onDelete: Cascade`

### Organization Deletion Safeguard

- When an organization is deleted, entries are protected via `organizationId` → `organizations.id` with `onDelete: Restrict`
- This ensures accidental org deletion does not silently cascade; it must be an explicit decision or deferred to a separate org-level retention policy

---

## Timezone Handling (Open for Backend/Database Sync)

### Current Design Assumption

1. Client reports environment timezone with each request: `tz: 'America/New_York'` (IANA format)
2. Backend receives timezone, validates it against a known list, and uses it to compute local date boundaries
3. Entry `localDate` is stored as a date (no time component), effectively pre-normalized to the client's timezone
4. Frontend computes week/month boundaries using the same timezone on load

### Decision Pending: Immutable vs. Dynamic Timezone

**Question for T-02.2 (backend-coding) and UX review:**
- Should `localDate` be immutable (stored at creation time, represents the timezone at creation)?
- Or should date grouping be dynamic (always based on client-reported timezone at query time)?

**For T-02.1 Design:** Either approach works; the model stores `localDate` as a date, and the backend validates timezone input. The specific policy (stored vs. dynamic) will be clarified in T-02.2 validation schema and T-02.3 API route behavior.

**Current assumption for implementation:** Backend accepts timezone per-request; validates; computes boundaries; treats `localDate` as immutable once stored.

---

## Row Count & Performance Estimates

### Estimated Growth

- **Per user:** 365 entries/year (daily habit)
- **Per org (MVP):** 1–100 users; worst case 100 × 365 = 36,500 entries/year
- **Retention:** Assume 2–5 years of journaling history per user; ~100K–500K rows per org over time

### Query Performance

- **Indexed lookups** (day, week, month): millisecond-range with composite indexes
- **All-entries pagination:** 10–50 rows per page; index scan efficient
- **Concurrent writes:** One entry per user per day limits write contention; no hot rows

### Storage

- **Average entry size:** 500–2000 characters (Markdown text)
- **Bytes per row** (including overhead): ~1KB–5KB
- **E-05 media additions** (Base64 images): 100KB–1MB per image; will require separate size limits and pagination

### No Special Optimization Needed for MVP

Standard indexing on `(organizationId, userId, localDate)` is sufficient for initial launch. Denormalization or caching can be added later if query patterns change.

---

## Constraints & Validation

### Database Constraints

| Constraint | Type | Enforcement | Rationale |
|---|---|---|---|
| Unique `(organizationId, userId, localDate)` | Unique constraint | PostgreSQL | One entry per user per day |
| `organizationId` NOT NULL | NOT NULL | PostgreSQL | ADR 0001 — required scoping |
| `userId` NOT NULL | NOT NULL | PostgreSQL | Entry must have owner |
| `localDate` NOT NULL | NOT NULL | PostgreSQL | Entry must have date |
| `content` NOT NULL | NOT NULL | PostgreSQL | Entry must have content (never blank) |
| `localDate` is a date | Type | PostgreSQL | No time component; local date only |
| Foreign key `userId` → `users.id` | FK + cascade delete | PostgreSQL | User deletion removes entries |
| Foreign key `organizationId` → `organizations.id` | FK + restrict delete | PostgreSQL | Org data protected |

### Application-Level Validation (T-02.2)

- **Timezone:** IANA timezone string; validated against known list
- **localDate:** YYYY-MM-DD format; valid date; not in future (or allow configurable future threshold)
- **Markdown:** Valid Markdown syntax; no arbitrary HTML; no embedded scripts
- **Content length:** ≥1 character (not empty); <500K characters (server payload limit)
- **Move operation:** Target date must be unoccupied by same user

---

## Migration Strategy & Rollback

### Initial Migration (T-02.5)

1. Create `journal_entries` table with all fields, indexes, constraints
2. No backfill needed; table starts empty
3. Prisma schema updated; client generated
4. Typecheck and build pass
5. Test: create, retrieve, update, move, delete operations; verify constraints

### Rollout Risk: None

- New table; no existing data
- No schema changes to other tables
- No breaking API changes to existing endpoints
- Additive feature; no removal of existing data

### Rollback (if needed)

- Drop `journal_entries` table
- Revert Prisma schema
- Regenerate client

---

## Implementation Readiness

### Ready for T-02.5 (Migration)

✓ All fields, relationships, constraints, indexes specified
✓ Query patterns documented
✓ Lifecycle and validation rules defined
✓ Timezone handling strategy identified (open question noted for T-02.2)
✓ No blocking dependencies

### Ready for T-02.2 (Validation & Types)

✓ Request/response shapes implied by lifecycle rules
✓ Validation rules scoped (timezone, Markdown, date format, move collision)
✓ Error outcomes documented (conflict, validation failure)

### Ready for T-02.6 (Store Implementation)

✓ All query patterns and scoping rules defined
✓ Store interface can be designed to match this model
✓ Organization/user scope explicit on every operation

### Ready for T-02.3 (API Routes)

✓ CRUD operations, move operation, scope rules all specified
✓ HTTP status codes and error responses documented
✓ Authentication and authorization model clear (JWT org/user scope)

---

## E-05 Media Integration (Forward Design)

When E-05 defines the media table, the following decisions must be made:

1. **Size limits:** Max bytes per image; max images per entry; total size cap per entry
2. **Encoding:** Accept Base64 or raw binary in request? Store only Base64?
3. **MIME types:** Supported formats (png, jpeg, webp, gif); reject others
4. **Orphan cleanup:** Periodic task to remove media without entries? Or cascade delete only?
5. **Storage backfill:** If media is added later, how do existing entries reference images?

**Scope for T-02.1:** Document the relationship shape and lifecycle. Implementation deferred to E-05 design task.

---

## Summary & Sign-Off

**The `journal_entries` model is approved for implementation.**

- ✓ Enforces one entry per user per calendar date
- ✓ Stores Markdown canonical content
- ✓ Supports day/week/month/all-entries query patterns via efficient indexes
- ✓ Handles move operations with conflict detection
- ✓ Follows ADR 0001 direct organization scoping
- ✓ Defines clear lifecycle for creation, update, move, deletion
- ✓ Leaves media table relationship documented for E-05 implementation
- ✓ No blocking dependencies; ready for T-02.5 migration

**Open for Backend/Database Coordination:** Timezone mutability strategy will be finalized during T-02.2 (validation design) in consultation with backend-coding agent.

**Next steps:**
- T-02.5: Implement Prisma schema and PostgreSQL migration
- T-02.2: Define domain types and Zod validation schemas
- T-02.6: Implement journalStore factory and query methods
- T-02.3: Implement protected Fastify routes
