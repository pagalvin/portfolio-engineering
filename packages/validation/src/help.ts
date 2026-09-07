import { z } from 'zod'

const semverPattern = /^\d+\.\d+\.\d+$/
const keyPattern = /^[a-z][a-z0-9]*(?:\.[a-z0-9]+)+$/
const pathPattern = /^content\/help\/(pages|tooltips)\/[a-z0-9][a-z0-9/_.-]*\.(md|txt)$/

export const helpEntrySchema = z.object({
  key: z.string().regex(keyPattern),
  title: z.string().trim().min(1).max(200).optional(),
  type: z.enum(['page', 'tooltip']),
  path: z.string().regex(pathPattern).optional(),
  group: z.string().trim().min(1).max(80).optional(),
  parentKey: z.string().regex(keyPattern).optional(),
  order: z.number().int().nonnegative().max(1_000_000).optional(),
  minAppVersion: z.string().regex(semverPattern),
  aliases: z.array(z.string().regex(keyPattern)).max(20),
  status: z.enum(['active', 'redirect', 'unavailable']),
  replacementKey: z.string().regex(keyPattern).optional(),
  relatedPageKey: z.string().regex(keyPattern).optional(),
}).superRefine((entry, context) => {
  if (entry.status === 'active' && !entry.path) {
    context.addIssue({ code: 'custom', path: ['path'], message: 'Active entries require a content path.' })
  }
  if (entry.status === 'redirect' && !entry.replacementKey) {
    context.addIssue({ code: 'custom', path: ['replacementKey'], message: 'Redirects require a replacement key.' })
  }
  if (entry.status !== 'redirect' && entry.replacementKey) {
    context.addIssue({ code: 'custom', path: ['replacementKey'], message: 'Only redirects may have a replacement key.' })
  }
  if (entry.type === 'page' && entry.status === 'active' &&
      (!entry.title || !entry.group || entry.order === undefined)) {
    context.addIssue({ code: 'custom', message: 'Active pages require title, hierarchy, and order metadata.' })
  }
  if (entry.path && ((entry.type === 'page' && !entry.path.startsWith('content/help/pages/')) ||
      (entry.type === 'tooltip' && !entry.path.startsWith('content/help/tooltips/')))) {
    context.addIssue({ code: 'custom', path: ['path'], message: 'Content path does not match entry type.' })
  }
})

export const helpIndexSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string().regex(semverPattern),
  entries: z.array(helpEntrySchema).min(1).max(500),
}).superRefine((index, context) => {
  const keys = new Set<string>()
  const keyVersions = new Set<string>()
  const aliases = new Set<string>()
  for (const entry of index.entries) {
    const versionedKey = `${entry.key}@${entry.minAppVersion}`
    if (keyVersions.has(versionedKey)) context.addIssue({ code: 'custom', path: ['entries'], message: `Duplicate key/version: ${versionedKey}` })
    keyVersions.add(versionedKey)
    keys.add(entry.key)
    for (const alias of entry.aliases) {
      if (keys.has(alias) || aliases.has(alias)) {
        context.addIssue({ code: 'custom', path: ['entries'], message: `Duplicate alias: ${alias}` })
      }
      aliases.add(alias)
    }
  }
  for (const entry of index.entries) {
    if (entry.parentKey && !keys.has(entry.parentKey)) {
      context.addIssue({ code: 'custom', path: ['entries'], message: `Missing parent: ${entry.parentKey}` })
    }
    if (entry.relatedPageKey && !keys.has(entry.relatedPageKey)) {
      context.addIssue({ code: 'custom', path: ['entries'], message: `Missing related page: ${entry.relatedPageKey}` })
    }
    if (entry.replacementKey && !keys.has(entry.replacementKey)) {
      context.addIssue({ code: 'custom', path: ['entries'], message: `Missing redirect target: ${entry.replacementKey}` })
    }
  }
})

export const helpContentPayloadSchema = z.object({
  pages: z.record(z.string().regex(keyPattern), z.object({ markdown: z.string().max(1_048_576) })),
  tooltips: z.record(z.string().regex(keyPattern), z.object({ text: z.string().max(8192) })),
})

export const appVersionResponseSchema = z.object({ version: z.string().regex(semverPattern) })

export const helpFreshnessStatusSchema = z.enum(['fresh', 'stale', 'unavailable'])
export const helpRefreshStatusSchema = z.enum(['never_attempted', 'succeeded', 'failed', 'invalid'])
export const helpResponseMetadataSchema = z.object({
  source: z.enum(['cache', 'bundled']),
  effectiveVersion: z.string().regex(semverPattern),
  contentVersion: z.string().regex(semverPattern),
  schemaVersion: z.literal(1),
  freshness: helpFreshnessStatusSchema,
  refreshStatus: helpRefreshStatusSchema,
  fetchedAt: z.string().datetime().nullable(),
  lastDownloadAttemptAt: z.string().datetime().nullable(),
})

// Repository paths are deliberately omitted from API responses.
export const helpPublicEntrySchema = z.object({
  key: z.string().regex(keyPattern),
  title: z.string().trim().min(1).max(200).optional(),
  type: z.enum(['page', 'tooltip']),
  group: z.string().trim().min(1).max(80).optional(),
  parentKey: z.string().regex(keyPattern).optional(),
  order: z.number().int().nonnegative().max(1_000_000).optional(),
  minAppVersion: z.string().regex(semverPattern),
  aliases: z.array(z.string().regex(keyPattern)).max(20),
  status: z.enum(['active', 'redirect', 'unavailable']),
  replacementKey: z.string().regex(keyPattern).optional(),
  relatedPageKey: z.string().regex(keyPattern).optional(),
})
export const helpIndexResponseSchema = z.object({
  index: z.object({
    schemaVersion: z.literal(1),
    contentVersion: z.string().regex(semverPattern),
    entries: z.array(helpPublicEntrySchema),
  }),
  metadata: helpResponseMetadataSchema,
})
export const helpTopicResponseSchema = z.object({
  helpKey: z.string().regex(keyPattern),
  status: z.enum(['available', 'redirect', 'unavailable']),
  canonicalKey: z.string().regex(keyPattern).optional(),
  redirectTo: z.string().regex(keyPattern).optional(),
  entry: helpPublicEntrySchema.optional(),
  content: z.union([
    z.object({ markdown: z.string().max(1_048_576) }),
    z.object({ text: z.string().max(8192) }),
  ]).optional(),
  metadata: helpResponseMetadataSchema,
})
export const helpStatusResponseSchema = z.object({
  freshness: helpFreshnessStatusSchema,
  refreshStatus: helpRefreshStatusSchema,
  fetchedAt: z.string().datetime().nullable(),
  lastDownloadAttemptAt: z.string().datetime().nullable(),
  source: z.enum(['cache', 'bundled']),
})
export const helpRefreshResponseSchema = z.object({
  freshness: helpFreshnessStatusSchema,
  refreshStatus: helpRefreshStatusSchema,
  fetchedAt: z.string().datetime().nullable(),
  lastDownloadAttemptAt: z.string().datetime().nullable(),
})
export const helpKeyParamsSchema = z.object({ helpKey: z.string().regex(keyPattern) })

export type HelpIndexInput = z.input<typeof helpIndexSchema>
export type HelpContentPayloadInput = z.input<typeof helpContentPayloadSchema>
