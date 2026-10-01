import type {
  ChangelogAcknowledgmentResponse,
  ChangelogResponse,
} from '@portfolio-engineering/shared-types'
import type { AuthenticatedApiClient } from './apiClient'

function isSectionIdentity(value: unknown): value is string {
  return typeof value === 'string' && /^### \d{4}-\d{2}-\d{2}$/.test(value)
}

export function isChangelogResponse(value: unknown): value is ChangelogResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<ChangelogResponse>
  const markdownLines = typeof response.markdown === 'string'
    ? response.markdown.split(/\r?\n/)
    : []
  if (
    typeof response.markdown !== 'string' ||
    typeof response.contentVersion !== 'string' ||
    !/^[a-f0-9]{64}$/.test(response.contentVersion) ||
    !Array.isArray(response.sectionIdentities) ||
    !response.sectionIdentities.every(isSectionIdentity) ||
    !response.sectionIdentities.every((identity) => markdownLines.includes(identity)) ||
    new Set(response.sectionIdentities).size !== response.sectionIdentities.length ||
    !Array.isArray(response.unreadSectionIdentities) ||
    !response.unreadSectionIdentities.every((identity) =>
      isSectionIdentity(identity) && response.sectionIdentities?.includes(identity),
    )
  ) {
    return false
  }

  const metadata = response.metadata
  return Boolean(
    metadata &&
    (metadata.source === 'cache' || metadata.source === 'bundled') &&
    (metadata.freshness === 'fresh' ||
      metadata.freshness === 'stale' ||
      metadata.freshness === 'unavailable') &&
    (metadata.refreshStatus === 'never_attempted' ||
      metadata.refreshStatus === 'succeeded' ||
      metadata.refreshStatus === 'failed' ||
      metadata.refreshStatus === 'invalid') &&
    typeof metadata.contentVersion === 'string' &&
    metadata.contentVersion === response.contentVersion &&
    (metadata.fetchedAt === null || typeof metadata.fetchedAt === 'string')
  ) && (metadata?.lastDownloadAttemptAt === null ||
    typeof metadata?.lastDownloadAttemptAt === 'string')
}

function isAcknowledgmentResponse(
  value: unknown,
  identities: readonly string[],
): value is ChangelogAcknowledgmentResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<ChangelogAcknowledgmentResponse>
  if (
    !Array.isArray(response.acknowledgedSectionIdentities) ||
    !response.acknowledgedSectionIdentities.every(
      (identity) => typeof identity === 'string',
    ) ||
    !Array.isArray(response.unreadSectionIdentities) ||
    !response.unreadSectionIdentities.every(
      isSectionIdentity,
    )
  ) {
    return false
  }
  return response.acknowledgedSectionIdentities.length === identities.length &&
    identities.every((identity) =>
      response.acknowledgedSectionIdentities?.includes(identity),
    )
}

export async function acknowledgeRenderedChangelog(
  client: Pick<AuthenticatedApiClient, 'acknowledgeChangelog'>,
  value: unknown,
  onAcknowledged?: () => void,
): Promise<ChangelogAcknowledgmentResponse | null> {
  if (!isChangelogResponse(value) || value.sectionIdentities.length === 0) {
    return null
  }

  const result = await client.acknowledgeChangelog({
    contentVersion: value.contentVersion,
    sectionIdentities: [...value.sectionIdentities],
  })
  if (!isAcknowledgmentResponse(result, value.sectionIdentities)) {
    throw new Error('The changelog acknowledgment response was invalid.')
  }
  onAcknowledged?.()
  return result
}
