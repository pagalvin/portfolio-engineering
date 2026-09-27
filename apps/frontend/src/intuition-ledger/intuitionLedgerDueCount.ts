import { createContext, useContext } from 'react'
import type { AuthenticatedApiClient } from '../apiClient'
import { getEnvironmentTimezone } from '../journalApi'
import { getTodayInTimezone } from '../journalDates'

interface DueCountState {
  count: number | null
  refresh: () => void
}

export const IntuitionLedgerDueCountContext = createContext<DueCountState | null>(null)

export function useIntuitionLedgerDueCount(): DueCountState {
  const state = useContext(IntuitionLedgerDueCountContext)
  if (!state) throw new Error('Intuition Ledger due count requires a workspace session.')
  return state
}

export function intuitionLedgerNavLabel(count: number | null): string {
  return count !== null && count > 0 ? `Intuition Ledger, ${count} due` : 'Intuition Ledger'
}

export async function fetchIntuitionLedgerDueCount(client: Pick<AuthenticatedApiClient, 'getPredictionDueCount'>): Promise<number> {
  const { dueCount } = await client.getPredictionDueCount({
    asOfLocalDate: getTodayInTimezone(getEnvironmentTimezone()),
  })
  if (!Number.isSafeInteger(dueCount) || dueCount < 0) {
    throw new Error('Invalid Intuition Ledger due count response.')
  }
  return dueCount
}
