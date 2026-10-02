import type { PredictionDashboardStatsQuery, PredictionDashboardStatsResponse, PredictionRecord } from '@portfolio-engineering/shared-types/intuitionLedger'
import type { AuthenticatedApiClient } from '../apiClient'
import { serializePredictionDashboardQuery, type PredictionDashboardUrlQuery } from '../intuitionLedgerApi'

const DASHBOARD_PATH = '/workspace/intuition-ledger'

export interface DashboardData {
  stats: PredictionDashboardStatsResponse
  duePredictions: PredictionRecord[]
}

export function sortDashboardDuePredictions(predictions: readonly PredictionRecord[]): PredictionRecord[] {
  return [...predictions]
    .sort((left, right) => left.deadline.localeCompare(right.deadline) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
    .slice(0, 5)
}

export async function loadDashboardData(
  client: Pick<AuthenticatedApiClient, 'getPredictionDashboardStats' | 'listPredictions'>,
  query: PredictionDashboardUrlQuery,
  asOfLocalDate: string,
  signal?: AbortSignal,
): Promise<DashboardData> {
  const statsQuery: PredictionDashboardStatsQuery = {
    period: query.period,
    amended: query.amended,
    asOfLocalDate,
  }
  const [stats, dueResponse] = await Promise.all([
    client.getPredictionDashboardStats(statsQuery),
    client.listPredictions({ status: 'due', asOfLocalDate }, signal),
  ])
  return { stats, duePredictions: sortDashboardDuePredictions(dueResponse.predictions) }
}

export function dashboardUrl(query: PredictionDashboardUrlQuery): string {
  const search = serializePredictionDashboardQuery(query).toString()
  return `${DASHBOARD_PATH}${search ? `?${search}` : ''}`
}