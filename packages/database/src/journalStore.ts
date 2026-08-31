/**
 * Journal Entry Store
 *
 * Data access layer for journal entries. All operations require organizationId and userId.
 * Implements the persistence contract defined in docs/schema/0001-portfolio-journal-design.md.
 * Follows the same pattern as authStore.ts for consistency.
 */

import type {
  JournalEntry,
  PrismaClient,
} from './generated/prisma/client.js'

/**
 * Convert the Journal domain's timezone-normalized calendar date to the UTC
 * midnight Date required by Prisma for PostgreSQL `date` columns. UTC avoids
 * changing the calendar day when the API server uses a non-UTC timezone.
 */
function localDateToPrismaDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`)
}

/**
 * Move result discriminator: success or conflict
 */
export type MoveResult =
  | { ok: true; entry: JournalEntry }
  | { ok: false; reason: 'ENTRY_EXISTS'; localDate: string }

/**
 * Journal Entry Store Interface
 * All methods scope operations by organizationId and userId.
 */
export interface JournalStore {
  /**
   * Create a new journal entry
   * Returns 409 Conflict if entry already exists for this date
   */
  createEntry(input: {
    organizationId: string
    userId: string
    localDate: string // YYYY-MM-DD
    content: string
  }): Promise<JournalEntry | null>

  /**
   * Get entry for a single date
   * Returns null if entry does not exist
   */
  getEntryForDate(input: {
    organizationId: string
    userId: string
    localDate: string // YYYY-MM-DD
  }): Promise<JournalEntry | null>

  /**
   * Get all entries for a date range (e.g., week or month)
   * Returns empty array if no entries found
   */
  getEntriesInRange(input: {
    organizationId: string
    userId: string
    startDate: string // YYYY-MM-DD
    endDate: string // YYYY-MM-DD
  }): Promise<JournalEntry[]>

  /**
   * Get all entries for a user, paginated, reverse chronological
   */
  getAllEntriesPaginated(input: {
    organizationId: string
    userId: string
    limit: number
    offset: number
  }): Promise<{
    entries: JournalEntry[]
    total: number
  }>

  /**
   * Get specific entries by date list
   * Used for multi-select/week export
   */
  getEntriesByDates(input: {
    organizationId: string
    userId: string
    dates: string[] // Array of YYYY-MM-DD
  }): Promise<JournalEntry[]>

  /**
   * Update entry content (only field that can be modified)
   * Returns null if entry does not exist
   */
  updateEntry(input: {
    organizationId: string
    userId: string
    entryId: string
    content: string
  }): Promise<JournalEntry | null>

  /**
   * Move entry to a different date
   * Returns { ok: false, reason: 'ENTRY_EXISTS' } if destination occupied
   * Returns { ok: true, entry } on success
   */
  moveEntry(input: {
    organizationId: string
    userId: string
    entryId: string
    targetLocalDate: string // YYYY-MM-DD
  }): Promise<MoveResult>

  /**
   * Delete entry
   * Returns null if entry does not exist
   */
  deleteEntry(input: {
    organizationId: string
    userId: string
    entryId: string
  }): Promise<JournalEntry | null>

  /**
   * Check if entry exists for a specific date
   * Used by move operation to detect conflicts
   */
  entryExistsForDate(input: {
    organizationId: string
    userId: string
    localDate: string // YYYY-MM-DD
  }): Promise<boolean>

  /**
   * Get total count of entries for a user
   * Used for pagination metadata
   */
  countEntries(input: {
    organizationId: string
    userId: string
  }): Promise<number>
}

export function createJournalStore(prisma: PrismaClient): JournalStore {
  return {
    async createEntry(input) {
      try {
        return await prisma.journalEntry.create({
          data: {
            organizationId: input.organizationId,
            userId: input.userId,
            localDate: localDateToPrismaDate(input.localDate),
            content: input.content,
          },
        })
      } catch (error: unknown) {
        // Unique constraint violation: entry already exists for this date
        if (
          error instanceof Error &&
          error.message.includes('Unique constraint failed')
        ) {
          return null
        }
        throw error
      }
    },

    async getEntryForDate(input) {
      return prisma.journalEntry.findUnique({
        where: {
          organizationId_userId_localDate: {
            organizationId: input.organizationId,
            userId: input.userId,
            localDate: localDateToPrismaDate(input.localDate),
          },
        },
      })
    },

    async getEntriesInRange(input) {
      return prisma.journalEntry.findMany({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
          localDate: {
            gte: localDateToPrismaDate(input.startDate),
            lte: localDateToPrismaDate(input.endDate),
          },
        },
        orderBy: {
          localDate: 'asc',
        },
      })
    },

    async getAllEntriesPaginated(input) {
      const [entries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
          orderBy: {
            localDate: 'desc',
          },
          take: input.limit,
          skip: input.offset,
        }),
        prisma.journalEntry.count({
          where: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        }),
      ])

      return { entries, total }
    },

    async getEntriesByDates(input) {
      return prisma.journalEntry.findMany({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
          localDate: {
            in: input.dates.map(localDateToPrismaDate),
          },
        },
        orderBy: {
          localDate: 'asc',
        },
      })
    },

    async updateEntry(input) {
      try {
        // Verify entry exists and belongs to user/org
        const existing = await prisma.journalEntry.findFirst({
          where: {
            id: input.entryId,
            organizationId: input.organizationId,
            userId: input.userId,
          },
        })

        if (!existing) {
          return null
        }

        return await prisma.journalEntry.update({
          where: { id: input.entryId },
          data: {
            content: input.content,
          },
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('not found')) {
          return null
        }
        throw error
      }
    },

    async moveEntry(input) {
      // Use transaction to ensure atomicity
      try {
        return await prisma.$transaction(async (tx) => {
          // Verify entry exists and belongs to user/org
          const entry = await tx.journalEntry.findFirst({
            where: {
              id: input.entryId,
              organizationId: input.organizationId,
              userId: input.userId,
            },
          })

          if (!entry) {
            throw new Error('Entry not found')
          }

          // Check if destination date is occupied
          const existingAtDestination = await tx.journalEntry.findFirst({
            where: {
              organizationId: input.organizationId,
              userId: input.userId,
              localDate: localDateToPrismaDate(input.targetLocalDate),
            },
          })

          if (existingAtDestination) {
            return {
              ok: false,
              reason: 'ENTRY_EXISTS',
              localDate: input.targetLocalDate,
            } as const
          }

          // Move is safe: update entry
          const updated = await tx.journalEntry.update({
            where: { id: input.entryId },
            data: {
              localDate: localDateToPrismaDate(input.targetLocalDate),
            },
          })

          return { ok: true, entry: updated } as const
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Entry not found') {
          // Entry not found is not an error for move; caller should handle null
          throw new Error('Entry not found')
        }
        throw error
      }
    },

    async deleteEntry(input) {
      try {
        // Verify entry exists and belongs to user/org
        const existing = await prisma.journalEntry.findFirst({
          where: {
            id: input.entryId,
            organizationId: input.organizationId,
            userId: input.userId,
          },
        })

        if (!existing) {
          return null
        }

        return await prisma.journalEntry.delete({
          where: { id: input.entryId },
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('not found')) {
          return null
        }
        throw error
      }
    },

    async entryExistsForDate(input) {
      const entry = await prisma.journalEntry.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
          localDate: localDateToPrismaDate(input.localDate),
        },
        select: { id: true },
      })
      return !!entry
    },

    async countEntries(input) {
      return prisma.journalEntry.count({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      })
    },
  }
}
