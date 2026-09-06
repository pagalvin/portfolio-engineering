import { z } from 'zod'

export const journalAnalysisParamsSchema = z.object({
  entryId: z.string().trim().min(1),
}).strict()

export const journalAnalysisRequestSchema = z.object({
  connectionId: z.string().trim().min(1),
}).strict()

export type JournalAnalysisParams = z.infer<typeof journalAnalysisParamsSchema>
export type JournalAnalysisRequest = z.infer<typeof journalAnalysisRequestSchema>

export const journalAnalysisChunkEventSchema = z.object({
  type: z.literal('chunk'),
  text: z.string(),
}).strict()

export const journalAnalysisDoneEventSchema = z.object({
  type: z.literal('done'),
}).strict()

export const journalAnalysisErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string().min(1),
  code: z.string().min(1).optional(),
}).strict()

export const journalAnalysisStreamEventSchema = z.discriminatedUnion('type', [
  journalAnalysisChunkEventSchema,
  journalAnalysisDoneEventSchema,
  journalAnalysisErrorEventSchema,
])

export type JournalAnalysisStreamEvent = z.infer<typeof journalAnalysisStreamEventSchema>
