import type { FastifyPluginAsync } from 'fastify'
import {
  createChangelogAcknowledgmentStore,
  createHelpContentStore,
  getPrismaClient,
  type ChangelogAcknowledgmentStore,
  type HelpContentStore,
} from '@portfolio-engineering/database'
import {
  changelogAcknowledgmentRequestSchema,
  changelogAcknowledgmentResponseSchema,
  changelogErrorResponseSchema,
  changelogRefreshResponseSchema,
  changelogResponseSchema,
} from '@portfolio-engineering/validation'
import {
  refreshChangelog,
  type HelpRefreshResult,
} from '../lib/helpRefresh.js'
import {
  loadChangelogContent,
  type LoadedChangelog,
} from '../lib/changelogContent.js'

const prisma = getPrismaClient()
const defaultAcknowledgmentStore = createChangelogAcknowledgmentStore(prisma)
const defaultContentStore = createHelpContentStore(prisma)

type ChangelogContentStore = Pick<HelpContentStore, 'getLastValid'>

export interface ChangelogRouteOptions {
  acknowledgmentStore?: ChangelogAcknowledgmentStore
  contentStore?: ChangelogContentStore
  loadContent?: (store: ChangelogContentStore) => Promise<LoadedChangelog>
  refresh?: () => Promise<HelpRefreshResult>
}

function dateValue(value: Date | null): string | null {
  return value?.toISOString() ?? null
}

function unreadIdentities(
  publishedIdentities: string[],
  acknowledgedIdentities: string[],
): string[] {
  const acknowledged = new Set(acknowledgedIdentities)
  return publishedIdentities.filter((identity) => !acknowledged.has(identity))
}

export function createChangelogRoutes(
  options: ChangelogRouteOptions = {},
): FastifyPluginAsync {
  const acknowledgmentStore = options.acknowledgmentStore ?? defaultAcknowledgmentStore
  const contentStore = options.contentStore ?? defaultContentStore
  const loadContent = options.loadContent ?? loadChangelogContent
  const refresh = options.refresh

  return async (app) => {
    app.get('/api/changelog', async (request, reply) => {
      let content: LoadedChangelog
      try {
        content = await loadContent(contentStore)
      } catch (error) {
        app.log.error({ err: error }, 'Validated changelog content is unavailable.')
        reply.code(503)
        return changelogErrorResponseSchema.parse({
          code: 'CONTENT_UNAVAILABLE',
          message: 'Changelog content is temporarily unavailable.',
        })
      }

      let acknowledgedIdentities: string[]
      try {
        acknowledgedIdentities =
          await acknowledgmentStore.listAcknowledgedSectionIdentities({
            organizationId: request.user.organizationId,
            userId: request.user.sub,
          })
      } catch (error) {
        app.log.error({ err: error }, 'Could not read changelog acknowledgments.')
        reply.code(503)
        return changelogErrorResponseSchema.parse({
          code: 'PERSISTENCE_ERROR',
          message: 'Changelog reading status is temporarily unavailable.',
        })
      }

      return changelogResponseSchema.parse({
        markdown: content.markdown,
        sectionIdentities: content.sectionIdentities,
        contentVersion: content.contentVersion,
        unreadSectionIdentities: unreadIdentities(
          content.sectionIdentities,
          acknowledgedIdentities,
        ),
        metadata: {
          source: content.source.kind === 'cache' ? 'cache' : 'bundled',
          freshness: content.metadata.freshness,
          refreshStatus: content.metadata.refreshStatus,
          contentVersion: content.contentVersion,
          fetchedAt: dateValue(content.metadata.fetchedAt),
          lastDownloadAttemptAt: dateValue(content.metadata.lastDownloadAttemptAt),
        },
      })
    })

    app.post('/api/changelog/acknowledgments', async (request, reply) => {
      const parsedBody = changelogAcknowledgmentRequestSchema.safeParse(request.body)
      if (!parsedBody.success) {
        reply.code(400)
        return changelogErrorResponseSchema.parse({
          code: 'VALIDATION_ERROR',
          message: 'The changelog acknowledgment request is invalid.',
        })
      }

      let content: LoadedChangelog
      try {
        content = await loadContent(contentStore)
      } catch (error) {
        app.log.error({ err: error }, 'Validated changelog content is unavailable.')
        reply.code(503)
        return changelogErrorResponseSchema.parse({
          code: 'CONTENT_UNAVAILABLE',
          message: 'Changelog content is temporarily unavailable.',
        })
      }

      if (parsedBody.data.contentVersion !== content.contentVersion) {
        reply.code(409)
        return changelogErrorResponseSchema.parse({
          code: 'SNAPSHOT_MISMATCH',
          message: 'The changelog snapshot has changed. Reload it before acknowledging sections.',
        })
      }

      const requestedIdentities = [...new Set(parsedBody.data.sectionIdentities)]
      const snapshotIdentities = new Set(content.sectionIdentities)
      if (requestedIdentities.some((identity) => !snapshotIdentities.has(identity))) {
        reply.code(400)
        return changelogErrorResponseSchema.parse({
          code: 'VALIDATION_ERROR',
          message: 'Acknowledgments may include only sections in the referenced changelog snapshot.',
        })
      }

      try {
        const previouslyAcknowledgedIdentities =
          await acknowledgmentStore.listAcknowledgedSectionIdentities({
            organizationId: request.user.organizationId,
            userId: request.user.sub,
          })
        await acknowledgmentStore.acknowledgeSections({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          sectionIdentities: requestedIdentities,
        })
        return changelogAcknowledgmentResponseSchema.parse({
          acknowledgedSectionIdentities: requestedIdentities,
          unreadSectionIdentities: unreadIdentities(
            content.sectionIdentities,
            [...previouslyAcknowledgedIdentities, ...requestedIdentities],
          ),
        })
      } catch (error) {
        app.log.error({ err: error }, 'Could not save changelog acknowledgments.')
        reply.code(503)
        return changelogErrorResponseSchema.parse({
          code: 'PERSISTENCE_ERROR',
          message: 'Changelog reading status could not be saved.',
        })
      }
    })

    app.post('/api/changelog/refresh', async (_request, reply) => {
      let result: HelpRefreshResult
      try {
        result = refresh
          ? await refresh()
          : await refreshChangelog({ logger: app.log })
      } catch (error) {
        app.log.error({ err: error }, 'Changelog refresh could not be recorded.')
        reply.code(503)
        return changelogErrorResponseSchema.parse({
          code: 'PERSISTENCE_ERROR',
          message: 'Changelog refresh status is temporarily unavailable.',
        })
      }

      return changelogRefreshResponseSchema.parse({
        refreshStatus: result.record.lastRefreshStatus,
        freshness: result.record.freshnessStatus,
        fetchedAt: dateValue(result.record.fetchedAt),
        lastDownloadAttemptAt: dateValue(result.record.lastDownloadAttemptAt),
      })
    })
  }
}

export const changelogRoutes = createChangelogRoutes()
