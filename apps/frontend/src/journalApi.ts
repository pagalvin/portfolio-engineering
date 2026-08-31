import type { JournalEntry, JournalEntriesResponse, JournalEntriesQuery } from '@portfolio-engineering/shared-types/journal'
import type { AuthenticatedApiClient } from './apiClient'

/**
 * Journal API helpers
 * Provides type-safe wrappers around authenticated API calls for journal operations
 */

export async function getJournalEntries(
  apiClient: AuthenticatedApiClient,
  query: JournalEntriesQuery,
): Promise<JournalEntriesResponse> {
  return apiClient.getEntries({
    mode: query.mode,
    tz: query.tz,
    date: query.date,
    weekStart: query.weekStart,
    month: query.month,
    limit: query.limit,
    offset: query.offset,
    dates: query.dates,
  })
}

export async function createJournalEntry(
  apiClient: AuthenticatedApiClient,
  localDate: string,
  content: string,
  tz: string,
): Promise<JournalEntry> {
  return apiClient.createEntry({ localDate, content, tz })
}

export async function updateJournalEntry(
  apiClient: AuthenticatedApiClient,
  entryId: string,
  content: string,
  tz: string,
): Promise<JournalEntry> {
  return apiClient.updateEntry(entryId, { content, tz })
}

export async function moveJournalEntry(
  apiClient: AuthenticatedApiClient,
  entryId: string,
  targetLocalDate: string,
  tz: string,
): Promise<JournalEntry | { ok: false; reason: 'ENTRY_EXISTS'; localDate: string }> {
  return apiClient.moveEntry(entryId, { targetLocalDate, tz })
}

export async function deleteJournalEntry(
  apiClient: AuthenticatedApiClient,
  entryId: string,
): Promise<void> {
  return apiClient.deleteEntry(entryId)
}

export function getEnvironmentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
}
