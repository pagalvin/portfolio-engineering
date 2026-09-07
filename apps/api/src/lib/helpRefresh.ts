import {
  createHelpContentStore,
  getPrismaClient,
  type HelpContentStore,
  type HelpRuntimeCacheRecord,
} from '@portfolio-engineering/database'
import {
  DEFAULT_APP_VERSION,
  HELP_CHANNEL_ID,
  loadRemoteHelpContent,
  HelpContentValidationError,
  type HelpFetcher,
} from './helpContent.js'

const helpStore = createHelpContentStore(getPrismaClient())

export type HelpRefreshOutcome = 'succeeded' | 'failed' | 'invalid'

export interface HelpRefreshResult {
  outcome: HelpRefreshOutcome
  record: HelpRuntimeCacheRecord
}

export interface HelpRefreshLogger {
  warn(fields: { outcome: HelpRefreshOutcome }, message: string): void
}

function isValidationFailure(error: unknown): boolean {
  return error instanceof HelpContentValidationError
}

/**
 * Refreshes the one global help channel. The store methods are deliberately
 * the only persistence boundary: failed/invalid downloads update attempt
 * metadata and never replace a valid payload.
 */
export async function refreshHelp(options: {
  store?: HelpContentStore
  fetcher?: HelpFetcher
  logger?: HelpRefreshLogger
  now?: () => Date
} = {}): Promise<HelpRefreshResult> {
  const store = options.store ?? helpStore
  const attemptedAt = options.now?.() ?? new Date()
  try {
    const loaded = await loadRemoteHelpContent(DEFAULT_APP_VERSION, options.fetcher)
    const record = await store.writeValidatedPayload({
      channelId: HELP_CHANNEL_ID,
      indexPayload: loaded.index,
      contentPayload: loaded.content,
      effectiveAppVersion: DEFAULT_APP_VERSION,
      contentVersion: loaded.index.contentVersion,
      schemaVersion: loaded.index.schemaVersion,
      attemptedAt,
      fetchedAt: loaded.source.fetchedAt ?? attemptedAt,
    } as unknown as Parameters<HelpContentStore['writeValidatedPayload']>[0])
    return { outcome: 'succeeded', record }
  } catch (error: unknown) {
    const outcome: HelpRefreshOutcome = isValidationFailure(error) ? 'invalid' : 'failed'
    const record = await store.recordDownloadAttempt({
      channelId: HELP_CHANNEL_ID,
      attemptedAt,
      status: outcome,
    })
    // Do not log the error or fetched data: remote responses can contain
    // arbitrary content and diagnostics must never become a content channel.
    options.logger?.warn({ outcome }, 'Help refresh did not replace the cached content.')
    return { outcome, record }
  }
}

export function startHelpRefresh(options: Parameters<typeof refreshHelp>[0] = {}): void {
  void refreshHelp(options).catch(() => {
    // Startup refresh is best effort and must never affect listen readiness.
  })
}
