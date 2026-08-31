/**
 * Journal Entry Validation Schemas
 *
 * Zod schemas for request validation, timezone validation, and Markdown content validation.
 * Used by backend routes to validate client input before database operations.
 * See docs/schema/0001-portfolio-journal-design.md for complete constraints.
 */

import { z } from 'zod'

/**
 * IANA timezone list — subset of common timezones.
 * Validated against this list to prevent injection attacks and ensure backend can compute local dates.
 */
const IANA_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Pacific/Auckland',
] as const

export const ianaTimezoneSchema = z.enum(IANA_TIMEZONES)

/**
 * localDateSchema — YYYY-MM-DD format
 * Validates format and ensures date is valid (e.g., 2026-02-30 rejected).
 */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format; expected YYYY-MM-DD')
  .refine((dateStr) => {
    const date = new Date(dateStr + 'T00:00:00Z')
    // Check if date parsed correctly and matches input (prevents invalid dates like 2026-13-45)
    const [year, month, day] = dateStr.split('-').map(Number)
    return (
      !isNaN(date.getTime()) &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    )
  }, 'Invalid calendar date')

/**
 * journalWeekStartSchema — the Sunday which starts a Journal Week.
 *
 * Journal weeks are identified by a calendar date, never by ISO week number.
 * The seven included dates run from this Sunday through the following Saturday.
 */
export const journalWeekStartSchema = localDateSchema.refine(
  (dateStr) => new Date(`${dateStr}T00:00:00.000Z`).getUTCDay() === 0,
  'Week start must be a Sunday',
)

/**
 * calendarMonthSchema — YYYY-MM format
 * Validates format like 2026-08, and ensures month is valid (01-12).
 */
export const calendarMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Invalid month format; expected YYYY-MM')
  .refine((monthStr) => {
    const month = Number(monthStr.split('-')[1])
    return month >= 1 && month <= 12
  }, 'Month must be between 01 and 12')

/**
 * markdownContentSchema
 * Validates that content is non-empty and under reasonable size limit.
 * Does not perform deep Markdown parsing; backend stores canonical Markdown.
 * Very basic validation: must have at least 1 non-whitespace character, max 500KB.
 */
export const markdownContentSchema = z
  .string()
  .min(1, 'Entry content cannot be empty')
  .max(500_000, 'Entry content exceeds maximum size (500KB)')
  .refine(
    (content) => content.trim().length > 0,
    'Entry content cannot be only whitespace'
  )

/**
 * createJournalEntrySchema
 * Validates POST /api/journal/entries request body.
 * organizationId and userId are derived from auth context, never from request body.
 */
export const createJournalEntrySchema = z.object({
  localDate: localDateSchema,
  content: markdownContentSchema,
  tz: ianaTimezoneSchema.optional().default('UTC'),
})

/**
 * updateJournalEntrySchema
 * Validates PUT /api/journal/entries/:entryId request body.
 * Only content may be updated; date, id, timestamps are immutable.
 */
export const updateJournalEntrySchema = z.object({
  content: markdownContentSchema,
  tz: ianaTimezoneSchema.optional().default('UTC'),
})

/**
 * moveJournalEntrySchema
 * Validates POST /api/journal/entries/:entryId/move request body.
 * Checks if target date is unoccupied; backend returns 409 Conflict if occupied.
 */
export const moveJournalEntrySchema = z.object({
  targetLocalDate: localDateSchema,
  tz: ianaTimezoneSchema.optional().default('UTC'),
})

/**
 * journalEntriesQuerySchema — Multi-mode query parameter validation
 * Different modes require different parameters; this schema is conditional.
 */

/**
 * Day mode query: retrieve single entry for a specific date
 */
export const journalDayQuerySchema = z.object({
  mode: z.literal('day'),
  date: localDateSchema,
  tz: ianaTimezoneSchema.optional().default('UTC'),
}).strict()

/**
 * Week mode query: retrieve all entries from Sunday through Saturday.
 *
 * This strict object intentionally rejects legacy `week`, conflicting scope
 * parameters, and repeated scalar parameters (which Fastify parses as arrays).
 */
export const journalWeekQuerySchema = z.object({
  mode: z.literal('week'),
  weekStart: journalWeekStartSchema,
  tz: ianaTimezoneSchema.optional().default('UTC'),
}).strict()

/**
 * Month mode query: retrieve all entries for a calendar month
 */
export const journalMonthQuerySchema = z.object({
  mode: z.literal('month'),
  month: calendarMonthSchema,
  tz: ianaTimezoneSchema.optional().default('UTC'),
}).strict()

/**
 * All mode query: retrieve all entries paginated, reverse chronological
 */
export const journalAllQuerySchema = z.object({
  mode: z.literal('all'),
  limit: z.coerce.number().int().positive().max(500).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  tz: ianaTimezoneSchema.optional().default('UTC'),
}).strict()

/**
 * Selected mode query: retrieve specific entries by dates (for multi-select operations)
 */
export const journalSelectedQuerySchema = z.object({
  mode: z.literal('selected'),
  dates: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (typeof val === 'string' ? [val] : val))
    .refine((dates) => dates.length > 0, 'At least one date must be selected')
    .refine(
      (dates) => dates.every((d) => localDateSchema.safeParse(d).success),
      'All dates must be valid YYYY-MM-DD format'
    ),
  tz: ianaTimezoneSchema.optional().default('UTC'),
}).strict()

/**
 * Combined schema: discriminated union of all query modes
 * Use this to validate query parameters; it will narrow the type based on mode.
 */
export const journalEntriesQuerySchema = z.discriminatedUnion('mode', [
  journalDayQuerySchema,
  journalWeekQuerySchema,
  journalMonthQuerySchema,
  journalAllQuerySchema,
  journalSelectedQuerySchema,
])

/**
 * Response schemas
 */

export const journalEntryResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  localDate: z.string(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const journalEntriesResponseSchema = z.object({
  entries: z.array(journalEntryResponseSchema),
  total: z.number().nonnegative().optional(),
})

/**
 * Error response schemas
 */

export const journalConflictErrorSchema = z.object({
  code: z.literal('ENTRY_EXISTS'),
  message: z.string(),
  localDate: z.string(),
})

export const journalValidationErrorSchema = z.object({
  code: z.literal('VALIDATION_ERROR'),
  message: z.string(),
  field: z.string().optional(),
})
