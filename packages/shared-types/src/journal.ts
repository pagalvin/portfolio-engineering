/**
 * Journal Entry Domain Types
 *
 * Defines all TypeScript interfaces for journal entry CRUD, queries, and responses.
 * All operations require organizationId and userId from verified request context.
 * See docs/schema/0001-portfolio-journal-design.md for the complete persistence contract.
 */

/**
 * JournalEntry — Database model representation
 * One Markdown entry per user per local calendar date.
 */
export interface JournalEntry {
  id: string
  organizationId: string
  userId: string
  localDate: string // YYYY-MM-DD
  content: string // Canonical Markdown
  createdAt: Date
  updatedAt: Date
}

/**
 * CreateJournalEntryRequest
 * Client request to create a new entry. organizationId and userId are derived from auth context.
 */
export interface CreateJournalEntryRequest {
  localDate: string // YYYY-MM-DD
  content: string // Non-empty Markdown
  tz?: string // IANA timezone (e.g., 'America/New_York'); validated by backend
}

/**
 * UpdateJournalEntryRequest
 * Client request to update entry content. Only content may be modified.
 */
export interface UpdateJournalEntryRequest {
  content: string // Non-empty Markdown
  tz?: string // IANA timezone for validation context
}

/**
 * MoveJournalEntryRequest
 * Client request to move entry to a different date. Returns 409 if target date occupied.
 */
export interface MoveJournalEntryRequest {
  targetLocalDate: string // YYYY-MM-DD
  tz?: string // IANA timezone for validation context
}

/**
 * QueryScope — Type discriminator for different retrieval scopes
 */
export type QueryScope = 'day' | 'week' | 'month' | 'all' | 'selected'

/**
 * JournalEntriesQuery — Request to retrieve entries by various scopes.
 * organizationId and userId are derived from auth context.
 */
export interface JournalEntriesQuery {
  mode: QueryScope
  tz: string // IANA timezone; always required for date boundary computation

  // Day mode: retrieve single entry for a date
  date?: string // YYYY-MM-DD; required if mode='day'

  // Week mode: retrieve all entries from this Sunday through the following Saturday
  weekStart?: string // Sunday YYYY-MM-DD; required if mode='week'

  // Month mode: retrieve all entries in a given calendar month
  month?: string // YYYY-MM; required if mode='month'

  // All mode: retrieve all entries paginated, reverse chronological
  limit?: number // default 50; max 500
  offset?: number // default 0

  // Selected mode: retrieve specific entries by date for multi-select operations
  dates?: string[] // Array of YYYY-MM-DD; used for selected-week export
}

/**
 * JournalEntriesResponse — Successful retrieval response
 */
export interface JournalEntriesResponse {
  entries: JournalEntry[]
  total?: number // Include for paginated results (all mode)
}

/**
 * JournalConflictError
 * Returned when a move operation targets an already-occupied date.
 */
export interface JournalConflictError {
  code: 'ENTRY_EXISTS'
  message: string // e.g., "You already have an entry on 2026-08-30"
  localDate: string
}

/**
 * JournalValidationError
 * Returned when input validation fails (bad date, invalid timezone, empty content).
 */
export interface JournalValidationError {
  code: 'VALIDATION_ERROR'
  message: string
  field?: string // e.g., 'localDate', 'content', 'tz'
}
