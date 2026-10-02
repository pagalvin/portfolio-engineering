import { z } from 'zod'

const sectionIdentitySchema = z.string()
  .regex(/^### \d{4}-\d{2}-\d{2}$/)
  .refine((identity) => {
    const date = identity.slice(4)
    const parsed = new Date(`${date}T00:00:00.000Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
  })

const contentVersionSchema = z.string().regex(/^[a-f0-9]{64}$/)
const timestampSchema = z.string().datetime().nullable()

export const changelogAcknowledgmentRequestSchema = z.object({
  contentVersion: contentVersionSchema,
  sectionIdentities: z.array(sectionIdentitySchema).min(1).max(1000),
}).strict()

export const changelogMetadataSchema = z.object({
  source: z.enum(['cache', 'bundled']),
  freshness: z.enum(['fresh', 'stale', 'unavailable']),
  refreshStatus: z.enum(['never_attempted', 'succeeded', 'failed', 'invalid']),
  contentVersion: contentVersionSchema,
  fetchedAt: timestampSchema,
  lastDownloadAttemptAt: timestampSchema,
})

export const changelogResponseSchema = z.object({
  markdown: z.string().min(1).max(1_048_576),
  sectionIdentities: z.array(sectionIdentitySchema).min(1),
  contentVersion: contentVersionSchema,
  unreadSectionIdentities: z.array(sectionIdentitySchema),
  metadata: changelogMetadataSchema,
}).strict()

export const changelogAcknowledgmentResponseSchema = z.object({
  acknowledgedSectionIdentities: z.array(sectionIdentitySchema),
  unreadSectionIdentities: z.array(sectionIdentitySchema),
}).strict()

export const changelogRefreshResponseSchema = z.object({
  freshness: z.enum(['fresh', 'stale', 'unavailable']),
  refreshStatus: z.enum(['never_attempted', 'succeeded', 'failed', 'invalid']),
  fetchedAt: timestampSchema,
  lastDownloadAttemptAt: timestampSchema,
}).strict()

export const changelogErrorResponseSchema = z.object({
  code: z.enum([
    'VALIDATION_ERROR',
    'SNAPSHOT_MISMATCH',
    'CONTENT_UNAVAILABLE',
    'PERSISTENCE_ERROR',
  ]),
  message: z.string(),
}).strict()

export type ChangelogAcknowledgmentRequest = z.infer<typeof changelogAcknowledgmentRequestSchema>
export type ChangelogResponse = z.infer<typeof changelogResponseSchema>
