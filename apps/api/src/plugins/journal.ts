/**
 * Protected Journal Entry Routes
 *
 * Implements all journal CRUD and retrieval endpoints.
 * All routes require JWT authentication; organizationId and userId are derived from request.user.
 *
 * See docs/schema/0001-portfolio-journal-design.md for the complete contract.
 * See docs/uxd/flows/0001-portfolio-journal.md for the UX workflow.
 */

import type { FastifyPluginAsync } from 'fastify'
import {
  createJournalStore,
  getPrismaClient,
} from '@portfolio-engineering/database'
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  moveJournalEntrySchema,
  journalEntriesQuerySchema,
  journalEntryResponseSchema,
  journalEntriesResponseSchema,
} from '@portfolio-engineering/validation/journal'

const journalStore = createJournalStore(getPrismaClient())

/**
 * Utility: Convert query parameters to typed JournalEntriesQuery
 * Handles different modes and their required parameters
 */
function parseJournalQuery(
  query: Record<string, unknown>,
  requestUrl: string | undefined,
): Record<string, unknown> {
  const queryInput: Record<string, unknown> = { ...query }

  // Preserve repeated keys independently of the configured Fastify querystring
  // parser. The shared schemas reject arrays for scalar scope parameters while
  // continuing to permit repeated `dates` in selected mode.
  if (requestUrl) {
    try {
      const searchParams = new URL(
        requestUrl,
        'http://localhost',
      ).searchParams

      for (const key of new Set(searchParams.keys())) {
        const values = searchParams.getAll(key)
        queryInput[key] = values.length === 1 ? values[0] : values
      }
    } catch {
      // Fastify's parsed query remains available for shared-schema validation.
    }
  }

  return {
    ...queryInput,
    mode: queryInput.mode ?? 'day',
    tz: queryInput.tz ?? 'UTC',
  }
}

/**
 * Convert a validated Sunday Journal Week start to its inclusive
 * Sunday-Saturday calendar-date range.
 */
function weekStartToDateRange(weekStart: string): [string, string] {
  const start = new Date(`${weekStart}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)

  return [
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  ]
}

/**
 * Utility: Convert calendar month (YYYY-MM) to date range
 * Returns [startDate, endDate] in YYYY-MM-DD format
 */
function monthToDateRange(monthStr: string): [string, string] {
  const [year, month] = monthStr.split('-').map(Number)
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  
  return [start, end]
}

export const journalRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/journal/entries
   * Retrieve entries by scope (day, week, month, all, selected)
   * Query parameters: mode, date|weekStart|month|dates, tz, limit, offset
   */
  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/journal/entries',
    async (request, reply) => {
      try {
        // Parse and validate query
        const queryInput = parseJournalQuery(request.query, request.raw.url)
        const queryResult = journalEntriesQuerySchema.safeParse(queryInput)

        if (!queryResult.success) {
          reply.code(400)
          return {
            code: 'VALIDATION_ERROR',
            message: queryResult.error.issues
              .map((issue) => issue.message)
              .join('; '),
          }
        }

        const validatedQuery = queryResult.data

        const organizationId = request.user.organizationId
        const userId = request.user.sub

        let entries: any[] = []
        let total: number | undefined

        switch (validatedQuery.mode) {
          case 'day': {
            const entry = await journalStore.getEntryForDate({
              organizationId,
              userId,
              localDate: validatedQuery.date,
            })
            entries = entry ? [entry] : []
            break
          }

          case 'week': {
            const [startDate, endDate] = weekStartToDateRange(
              validatedQuery.weekStart,
            )
            entries = await journalStore.getEntriesInRange({
              organizationId,
              userId,
              startDate,
              endDate,
            })
            break
          }

          case 'month': {
            const [startDate, endDate] = monthToDateRange(validatedQuery.month)
            entries = await journalStore.getEntriesInRange({
              organizationId,
              userId,
              startDate,
              endDate,
            })
            break
          }

          case 'all': {
            const result = await journalStore.getAllEntriesPaginated({
              organizationId,
              userId,
              limit: validatedQuery.limit,
              offset: validatedQuery.offset,
            })
            entries = result.entries
            total = result.total
            break
          }

          case 'selected': {
            entries = await journalStore.getEntriesByDates({
              organizationId,
              userId,
              dates: validatedQuery.dates,
            })
            break
          }
        }

        const response = {
          entries: entries.map((e) =>
            journalEntryResponseSchema.parse({
              id: e.id,
              organizationId: e.organizationId,
              userId: e.userId,
              localDate: e.localDate.toISOString().split('T')[0], // Date object to YYYY-MM-DD
              content: e.content,
              createdAt: e.createdAt,
              updatedAt: e.updatedAt,
            })
          ),
          ...(total !== undefined && { total }),
        }

        return journalEntriesResponseSchema.parse(response)
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('validation')) {
          reply.code(400)
          return { code: 'VALIDATION_ERROR', message: error.message }
        }
        throw error
      }
    }
  )

  /**
   * POST /api/journal/entries
   * Create a new journal entry
   * Body: { localDate, content, tz? }
   */
  app.post<{ Body: Record<string, unknown> }>(
    '/api/journal/entries',
    async (request, reply) => {
      try {
        const validatedInput = createJournalEntrySchema.parse(request.body)

        const organizationId = request.user.organizationId
        const userId = request.user.sub

        const entry = await journalStore.createEntry({
          organizationId,
          userId,
          localDate: validatedInput.localDate,
          content: validatedInput.content,
        })

        if (!entry) {
          reply.code(409)
          return {
            code: 'ENTRY_EXISTS',
            message: `You already have an entry on ${validatedInput.localDate}`,
            localDate: validatedInput.localDate,
          }
        }

        reply.code(201)
        return journalEntryResponseSchema.parse({
          id: entry.id,
          organizationId: entry.organizationId,
          userId: entry.userId,
          localDate: entry.localDate.toISOString().split('T')[0],
          content: entry.content,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('validation')) {
          reply.code(400)
          return { code: 'VALIDATION_ERROR', message: error.message }
        }
        throw error
      }
    }
  )

  /**
   * PUT /api/journal/entries/:entryId
   * Update entry content (only field that can be modified)
   * Body: { content, tz? }
   */
  app.put<{ Params: { entryId: string }; Body: Record<string, unknown> }>(
    '/api/journal/entries/:entryId',
    async (request, reply) => {
      try {
        const validatedInput = updateJournalEntrySchema.parse(request.body)
        const { entryId } = request.params

        const organizationId = request.user.organizationId
        const userId = request.user.sub

        const entry = await journalStore.updateEntry({
          organizationId,
          userId,
          entryId,
          content: validatedInput.content,
        })

        if (!entry) {
          reply.code(404)
          return { message: 'Entry not found' }
        }

        return journalEntryResponseSchema.parse({
          id: entry.id,
          organizationId: entry.organizationId,
          userId: entry.userId,
          localDate: entry.localDate.toISOString().split('T')[0],
          content: entry.content,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('validation')) {
          reply.code(400)
          return { code: 'VALIDATION_ERROR', message: error.message }
        }
        throw error
      }
    }
  )

  /**
   * POST /api/journal/entries/:entryId/move
   * Move entry to a different date
   * Body: { targetLocalDate, tz? }
   * Returns 409 Conflict if destination date is already occupied
   */
  app.post<{ Params: { entryId: string }; Body: Record<string, unknown> }>(
    '/api/journal/entries/:entryId/move',
    async (request, reply) => {
      try {
        const validatedInput = moveJournalEntrySchema.parse(request.body)
        const { entryId } = request.params

        const organizationId = request.user.organizationId
        const userId = request.user.sub

        const result = await journalStore.moveEntry({
          organizationId,
          userId,
          entryId,
          targetLocalDate: validatedInput.targetLocalDate,
        })

        if (!result.ok) {
          reply.code(409)
          return {
            code: result.reason,
            message: `You already have an entry on ${result.localDate}`,
            localDate: result.localDate,
          }
        }

        return journalEntryResponseSchema.parse({
          id: result.entry.id,
          organizationId: result.entry.organizationId,
          userId: result.entry.userId,
          localDate: result.entry.localDate.toISOString().split('T')[0],
          content: result.entry.content,
          createdAt: result.entry.createdAt,
          updatedAt: result.entry.updatedAt,
        })
      } catch (error: unknown) {
        if (error instanceof Error) {
          if (error.message === 'Entry not found') {
            reply.code(404)
            return { message: 'Entry not found' }
          }
          if (error.message.includes('validation')) {
            reply.code(400)
            return { code: 'VALIDATION_ERROR', message: error.message }
          }
        }
        throw error
      }
    }
  )

  /**
   * DELETE /api/journal/entries/:entryId
   * Delete a journal entry
   */
  app.delete<{ Params: { entryId: string } }>(
    '/api/journal/entries/:entryId',
    async (request, reply) => {
      const { entryId } = request.params
      const organizationId = request.user.organizationId
      const userId = request.user.sub

      const entry = await journalStore.deleteEntry({
        organizationId,
        userId,
        entryId,
      })

      if (!entry) {
        reply.code(404)
        return { message: 'Entry not found' }
      }

      reply.code(204)
      return
    }
  )
}
