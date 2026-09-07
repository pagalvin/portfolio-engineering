import type { FastifyPluginAsync } from 'fastify'
import {
  createHelpContentStore,
  getPrismaClient,
  type HelpContentStore,
  type HelpRuntimeCacheRecord,
} from '@portfolio-engineering/database'
import {
  appVersionResponseSchema,
  errorMessageResponseSchema,
  helpIndexResponseSchema,
  helpKeyParamsSchema,
  helpStatusResponseSchema,
  helpTopicResponseSchema,
} from '@portfolio-engineering/validation'
import {
  DEFAULT_APP_VERSION,
  HELP_CHANNEL_ID,
  type HelpPayload,
  resolveHelpKey,
  selectEligibleEntries,
  validateHelpPayload,
} from '../lib/helpContent.js'
import { bundledHelpContent, bundledHelpIndex } from '../lib/bundledHelp.js'

const helpStore = createHelpContentStore(getPrismaClient())

interface HelpView {
  payload: HelpPayload
  source: 'cache' | 'bundled'
  record: HelpRuntimeCacheRecord | null
}

function dateValue(value: Date | null): string | null {
  return value?.toISOString() ?? null
}

function publicEntry(entry: HelpPayload['index']['entries'][number]) {
  const { path: _path, ...safeEntry } = entry
  return safeEntry
}

function metadata(view: HelpView) {
  return {
    source: view.source,
    effectiveVersion: DEFAULT_APP_VERSION,
    contentVersion: view.payload.index.contentVersion,
    schemaVersion: view.payload.index.schemaVersion,
    freshness: view.record?.freshnessStatus ?? 'unavailable',
    refreshStatus: view.record?.lastRefreshStatus ?? 'never_attempted',
    fetchedAt: dateValue(view.record?.fetchedAt ?? null),
    lastDownloadAttemptAt: dateValue(view.record?.lastDownloadAttemptAt ?? null),
  }
}

async function getHelpView(store: HelpContentStore = helpStore): Promise<HelpView> {
  let record: HelpRuntimeCacheRecord | null = null
  try {
    record = await store.getLastValid(HELP_CHANNEL_ID)
    if (record) {
      const payload = validateHelpPayload(record.indexPayload, record.contentPayload)
      return { payload, source: 'cache', record }
    }
  } catch {
    // Invalid cache data or a temporary database failure must not expose details.
  }

  const payload = validateHelpPayload(bundledHelpIndex, bundledHelpContent)
  return { payload, source: 'bundled', record }
}

export const helpRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/app-version', async () =>
    appVersionResponseSchema.parse({ version: DEFAULT_APP_VERSION }),
  )

  app.get('/api/help/index', async () => {
    const view = await getHelpView()
    const entries = selectEligibleEntries(view.payload.index, DEFAULT_APP_VERSION)
    return helpIndexResponseSchema.parse({
      index: {
        schemaVersion: view.payload.index.schemaVersion,
        contentVersion: view.payload.index.contentVersion,
        entries: entries.map(publicEntry),
      },
      metadata: metadata(view),
    })
  })

  app.get('/api/help/topics/:helpKey', async (request, reply) => {
    const paramsResult = helpKeyParamsSchema.safeParse(request.params)
    if (!paramsResult.success) {
      reply.code(400)
      return errorMessageResponseSchema.parse({ message: 'Invalid help topic key.' })
    }
    const params = paramsResult.data
    const view = await getHelpView()
    const resolved = resolveHelpKey(view.payload.index, params.helpKey, DEFAULT_APP_VERSION)
    const response: Record<string, unknown> = {
      helpKey: params.helpKey,
      status: 'unavailable',
      metadata: metadata(view),
    }

    if (!resolved) return helpTopicResponseSchema.parse(response)
    if (resolved.redirectTo) {
      return helpTopicResponseSchema.parse({
        ...response,
        status: 'redirect',
        redirectTo: resolved.redirectTo,
        canonicalKey: resolved.redirectTo,
      })
    }
    if (resolved.unavailable) return helpTopicResponseSchema.parse(response)

    const entry = resolved.entry
    if (params.helpKey !== entry.key) {
      return helpTopicResponseSchema.parse({
        ...response,
        status: 'redirect',
        redirectTo: entry.key,
        canonicalKey: entry.key,
      })
    }
    const content = entry.type === 'page'
      ? view.payload.content.pages[entry.key]
      : view.payload.content.tooltips[entry.key]
    if (!content) return helpTopicResponseSchema.parse(response)

    return helpTopicResponseSchema.parse({
      ...response,
      status: 'available',
      canonicalKey: entry.key,
      entry: publicEntry(entry),
      content,
    })
  })

  app.get('/api/help/status', async () => {
    let record: HelpRuntimeCacheRecord | null = null
    try {
      record = await helpStore.get(HELP_CHANNEL_ID)
    } catch {
      // Status is intentionally safe and non-diagnostic.
    }
    return helpStatusResponseSchema.parse({
      freshness: record?.freshnessStatus ?? 'unavailable',
      refreshStatus: record?.lastRefreshStatus ?? 'never_attempted',
      fetchedAt: dateValue(record?.fetchedAt ?? null),
      lastDownloadAttemptAt: dateValue(record?.lastDownloadAttemptAt ?? null),
      source: record?.indexPayload && record.contentPayload ? 'cache' : 'bundled',
    })
  })
}
