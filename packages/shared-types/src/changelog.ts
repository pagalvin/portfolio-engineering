export type ChangelogSource = 'cache' | 'bundled'
export type ChangelogFreshness = 'fresh' | 'stale' | 'unavailable'
export type ChangelogRefreshStatus = 'never_attempted' | 'succeeded' | 'failed' | 'invalid'

export interface ChangelogMetadata {
  source: ChangelogSource
  freshness: ChangelogFreshness
  refreshStatus: ChangelogRefreshStatus
  contentVersion: string
  fetchedAt: string | null
  lastDownloadAttemptAt: string | null
}

export interface ChangelogResponse {
  markdown: string
  sectionIdentities: string[]
  contentVersion: string
  unreadSectionIdentities: string[]
  metadata: ChangelogMetadata
}

export interface ChangelogAcknowledgmentRequest {
  contentVersion: string
  sectionIdentities: string[]
}

export interface ChangelogAcknowledgmentResponse {
  acknowledgedSectionIdentities: string[]
  unreadSectionIdentities: string[]
}

export type ChangelogErrorCode =
  | 'VALIDATION_ERROR'
  | 'SNAPSHOT_MISMATCH'
  | 'CONTENT_UNAVAILABLE'
  | 'PERSISTENCE_ERROR'

export interface ChangelogErrorResponse {
  code: ChangelogErrorCode
  message: string
}
