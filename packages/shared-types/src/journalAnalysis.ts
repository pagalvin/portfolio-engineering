/**
 * Journal Entry AI Analysis Types
 *
 * Client requests identify only the selected AI connection. Journal entry id,
 * organization scope, user scope, prompt text, and Journal content are owned by
 * the protected backend route and verified auth context.
 */

export interface JournalAnalysisRequest {
  connectionId: string
}

export interface JournalAnalysisChunkEvent {
  type: 'chunk'
  text: string
}

export interface JournalAnalysisDoneEvent {
  type: 'done'
}

export interface JournalAnalysisErrorEvent {
  type: 'error'
  message: string
  code?: string
}

export type JournalAnalysisStreamEvent =
  | JournalAnalysisChunkEvent
  | JournalAnalysisDoneEvent
  | JournalAnalysisErrorEvent
