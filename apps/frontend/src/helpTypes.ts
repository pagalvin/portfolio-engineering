import type {
  HelpIndexEntry,
  HelpEntryStatus,
} from '@portfolio-engineering/shared-types/help'

export const DEFAULT_EFFECTIVE_APP_VERSION = '1.0.0'

export type HelpFreshness = 'fresh' | 'stale' | 'unavailable'
export type HelpRefreshStatus =
  | 'never_attempted'
  | 'succeeded'
  | 'failed'
  | 'invalid'

export interface AppVersionResponse {
  version: string
}

export interface HelpResponseMetadata {
  source: 'cache' | 'bundled'
  effectiveVersion: string
  contentVersion: string
  schemaVersion: 1
  freshness: HelpFreshness
  refreshStatus: HelpRefreshStatus
  fetchedAt: string | null
  lastDownloadAttemptAt: string | null
}

export interface HelpIndexResponse {
  index: {
    schemaVersion: 1
    contentVersion: string
    entries: HelpIndexEntry[]
  }
  metadata: HelpResponseMetadata
}

export interface HelpTopicResponse {
  helpKey: string
  status: 'available' | 'redirect' | 'unavailable'
  canonicalKey?: string
  redirectTo?: string
  entry?: HelpIndexEntry
  content?: { markdown: string } | { text: string }
  metadata: HelpResponseMetadata
}

export interface HelpStatusResponse {
  freshness: HelpFreshness
  refreshStatus: HelpRefreshStatus
  fetchedAt: string | null
  lastDownloadAttemptAt: string | null
  source: 'cache' | 'bundled'
}

export interface HelpRefreshResponse {
  refreshStatus: Exclude<HelpRefreshStatus, 'never_attempted'>
  freshness: HelpFreshness
  fetchedAt: string | null
  lastDownloadAttemptAt: string | null
}

export type HelpStatusEntry = HelpEntryStatus
