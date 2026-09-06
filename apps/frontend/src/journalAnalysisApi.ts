import type {
  JournalAnalysisStreamEvent,
} from '@portfolio-engineering/shared-types/journalAnalysis'
import type {
  AuthenticatedApiClient,
  JournalAnalysisStreamOptions,
} from './apiClient'

export type { JournalAnalysisStreamEvent }

export type JournalAnalysisEventHandler = (
  event: JournalAnalysisStreamEvent,
) => void

export interface AnalyzeJournalEntryOptions {
  readonly signal?: AbortSignal
  readonly onEvent: JournalAnalysisEventHandler
}

export function analyzeJournalEntry(
  apiClient: AuthenticatedApiClient,
  entryId: string,
  connectionId: string,
  options: AnalyzeJournalEntryOptions,
): Promise<void> {
  const streamOptions: JournalAnalysisStreamOptions = {
    signal: options.signal,
    onEvent: options.onEvent,
  }

  return apiClient.streamJournalAnalysis(
    entryId,
    { connectionId },
    streamOptions,
  )
}
