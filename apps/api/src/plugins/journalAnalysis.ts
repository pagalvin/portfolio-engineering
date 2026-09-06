import { once } from 'node:events'
import type { ServerResponse } from 'node:http'
import type { FastifyPluginAsync } from 'fastify'
import {
  getProviderDefinition as resolveProviderDefinition,
  type ProviderDefinition,
  type StreamTextEvent,
} from '@portfolio-engineering/ai'
import {
  createAiConnectionStore,
  createJournalStore,
  getPrismaClient,
  type SafeAiConnectionRecord,
} from '@portfolio-engineering/database'
import {
  journalAnalysisParamsSchema,
  journalAnalysisRequestSchema,
  journalAnalysisStreamEventSchema,
  type JournalAnalysisStreamEvent,
} from '@portfolio-engineering/validation/journalAnalysis'
import { z } from 'zod'
import { reserveJournalAnalysisSlot as reserveDefaultJournalAnalysisSlot } from '../lib/journalAnalysisLimits.js'

interface JournalAnalysisEntry {
  readonly localDate: Date
  readonly content: string
}

interface JournalAnalysisJournalStore {
  getEntryById(input: {
    readonly organizationId: string
    readonly userId: string
    readonly entryId: string
  }): Promise<JournalAnalysisEntry | null>
}

interface JournalAnalysisAiConnectionStore {
  findById(input: {
    readonly organizationId: string
    readonly connectionId: string
  }): Promise<SafeAiConnectionRecord | null>
  decryptSecretForInvocation(input: {
    readonly organizationId: string
    readonly connectionId: string
  }): Promise<Record<string, unknown> | string>
}

interface JournalAnalysisLimitResult {
  readonly allowed: boolean
  readonly reason?: 'minimum_interval' | 'organization_limit'
  readonly retryAt?: Date
}

interface JournalAnalysisRouteDependencies {
  readonly journalStore: JournalAnalysisJournalStore
  readonly aiConnectionStore: JournalAnalysisAiConnectionStore
  readonly getProviderDefinition: (providerId: string) => ProviderDefinition | undefined
  readonly reserveJournalAnalysisSlot: (input: {
    readonly organizationId: string
    readonly userId: string
    readonly entryId: string
    readonly connectionId: string
  }) => JournalAnalysisLimitResult
}

interface StreamTextAdapter {
  streamText(
    prompt: string,
    options: {
      readonly connectionId: string
      readonly signal: AbortSignal
      readonly maxOutputTokens: number
    },
  ): AsyncGenerator<StreamTextEvent>
}

const JOURNAL_ANALYSIS_MAX_OUTPUT_TOKENS = 4_000

function createDefaultDependencies(): JournalAnalysisRouteDependencies {
  const prisma = getPrismaClient()

  return {
    journalStore: createJournalStore(prisma),
    aiConnectionStore: createAiConnectionStore(prisma),
    getProviderDefinition: resolveProviderDefinition,
    reserveJournalAnalysisSlot: reserveDefaultJournalAnalysisSlot,
  }
}

function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'configuration'
      return `${field}: ${issue.message}`
    })
    .join('; ')
}

function getProviderFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const { schemaVersion: _schemaVersion, ...providerFields } = payload
  return providerFields
}

function toSafeErrorLog(error: unknown): {
  readonly name: string
} {
  if (error instanceof Error) {
    return {
      name: error.name,
    }
  }

  return {
    name: 'UnknownError',
  }
}

function isConnectionReady(connection: SafeAiConnectionRecord): boolean {
  return connection.enabled && connection.lastTestStatus === 'success'
}

function isStreamTextAdapter(adapter: unknown): adapter is StreamTextAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    'streamText' in adapter &&
    typeof (adapter as { readonly streamText?: unknown }).streamText === 'function'
  )
}

function buildJournalAnalysisPrompt(input: {
  readonly localDate: Date
  readonly content: string
}): string {
  const localDate = input.localDate.toISOString().slice(0, 10)

  return [
    'Assume the role of a helpful financial analyst.',
    'Analyze the following private trading Journal entry as a reflective aid.',
    'Focus on observations, risks, decision-quality patterns, assumptions, and useful follow-up questions the user may want to consider.',
    'Write a complete analysis with 4-6 short Markdown sections and concrete bullet points where helpful.',
    'Do not provide personalized financial advice or instructions to buy, sell, or hold any security.',
    'Return Markdown.',
    '',
    `Journal entry date: ${localDate}`,
    '',
    input.content,
  ].join('\n')
}

function toJournalAnalysisStreamEvent(
  event: StreamTextEvent,
): JournalAnalysisStreamEvent {
  if (event.type === 'chunk') {
    return {
      type: 'chunk',
      text: event.text,
    }
  }

  if (event.type === 'done') {
    return {
      type: 'done',
    }
  }

  return {
    type: 'error',
    code: event.failureKind,
    message: event.message,
  }
}

function writeSseEvent(
  response: ServerResponse,
  event: JournalAnalysisStreamEvent,
): boolean {
  const payload = journalAnalysisStreamEventSchema.parse(event)
  return response.write(`event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`)
}

async function writeSseEventWithBackpressure(
  response: ServerResponse,
  event: JournalAnalysisStreamEvent,
): Promise<void> {
  if (!writeSseEvent(response, event) && !response.destroyed) {
    await once(response, 'drain')
  }
}

export function createJournalAnalysisRoutes(
  dependencies: JournalAnalysisRouteDependencies = createDefaultDependencies(),
): FastifyPluginAsync {
  return async (app) => {
    const {
      journalStore,
      aiConnectionStore,
      getProviderDefinition,
      reserveJournalAnalysisSlot,
    } = dependencies

    app.post<{
      Params: unknown
      Body: unknown
    }>('/api/journal/entries/:entryId/analyze', async (request, reply) => {
      const paramsResult = journalAnalysisParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        reply.code(400)
        return {
          code: 'VALIDATION_ERROR',
          message: formatValidationError(paramsResult.error),
        }
      }

      const requestResult = journalAnalysisRequestSchema.safeParse(request.body)
      if (!requestResult.success) {
        reply.code(400)
        return {
          code: 'VALIDATION_ERROR',
          message: formatValidationError(requestResult.error),
        }
      }

      const organizationId = request.user.organizationId
      const userId = request.user.sub
      const { entryId } = paramsResult.data
      const { connectionId } = requestResult.data

      const entry = await journalStore.getEntryById({
        organizationId,
        userId,
        entryId,
      })

      if (!entry) {
        reply.code(404)
        return {
          code: 'NOT_FOUND',
          message: 'The requested Journal entry was not found.',
        }
      }

      const connection = await aiConnectionStore.findById({
        organizationId,
        connectionId,
      })

      if (!connection) {
        reply.code(404)
        return {
          code: 'NOT_FOUND',
          message: 'The requested AI connection was not found.',
        }
      }

      const definition = getProviderDefinition(connection.providerId)
      if (!definition || !definition.isUsable || !isConnectionReady(connection)) {
        reply.code(400)
        return {
          code: 'CONNECTION_NOT_READY',
          message: 'The selected AI connection is not ready for analysis.',
        }
      }

      const limit = reserveJournalAnalysisSlot({
        organizationId,
        userId,
        entryId,
        connectionId: connection.id,
      })

      if (!limit.allowed) {
        reply.code(429)
        return {
          code: 'RATE_LIMITED',
          message: `Analysis cannot start before ${limit.retryAt?.toISOString() ?? 'a later time'}.`,
        }
      }

      let secretPayload: Record<string, unknown>
      try {
        const decryptedSecret = await aiConnectionStore.decryptSecretForInvocation({
          organizationId,
          connectionId: connection.id,
        })
        secretPayload = typeof decryptedSecret === 'string'
          ? { apiKey: decryptedSecret }
          : decryptedSecret
      } catch (error: unknown) {
        request.log.error(
          {
            error: toSafeErrorLog(error),
            providerId: connection.providerId,
            connectionId: connection.id,
          },
          'Journal analysis credential decryption failed',
        )
        reply.code(400)
        return {
          code: 'CONNECTION_NOT_READY',
          message: 'The selected AI connection could not be prepared for analysis.',
        }
      }

      let adapter: StreamTextAdapter
      try {
        const candidate = definition.adapterFactory({
          ...getProviderFields(connection.configPayload as Record<string, unknown>),
          ...getProviderFields(secretPayload),
        })

        if (!isStreamTextAdapter(candidate)) {
          reply.code(400)
          return {
            code: 'CONNECTION_NOT_READY',
            message: 'The selected AI connection does not support streaming analysis.',
          }
        }

        adapter = candidate
      } catch (error: unknown) {
        if (!(error instanceof z.ZodError)) {
          request.log.error(
            {
              error: toSafeErrorLog(error),
              providerId: connection.providerId,
              connectionId: connection.id,
            },
            'Journal analysis adapter setup failed',
          )
          throw error
        }

        reply.code(400)
        return {
          code: 'CONNECTION_NOT_READY',
          message: 'The selected AI connection is not ready for analysis.',
        }
      }

      const abortController = new AbortController()
      const abortProviderRequest = () => {
        abortController.abort()
      }
      request.raw.on('aborted', abortProviderRequest)
      request.raw.on('close', abortProviderRequest)
      reply.raw.on('close', abortProviderRequest)

      reply.hijack()
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      try {
        const prompt = buildJournalAnalysisPrompt({
          localDate: entry.localDate,
          content: entry.content,
        })

        for await (const providerEvent of adapter.streamText(prompt, {
          connectionId: connection.id,
          signal: abortController.signal,
          maxOutputTokens: JOURNAL_ANALYSIS_MAX_OUTPUT_TOKENS,
        })) {
          if (reply.raw.destroyed) {
            abortController.abort()
            return
          }

          await writeSseEventWithBackpressure(
            reply.raw,
            toJournalAnalysisStreamEvent(providerEvent),
          )

          if (providerEvent.type === 'error' || providerEvent.type === 'done') {
            break
          }
        }
      } catch (error: unknown) {
        request.log.error(
          {
            error: toSafeErrorLog(error),
            providerId: connection.providerId,
            connectionId: connection.id,
          },
          'Journal analysis stream failed',
        )

        if (!reply.raw.destroyed) {
          await writeSseEventWithBackpressure(reply.raw, {
            type: 'error',
            code: 'provider_error',
            message: 'The provider stopped responding before the analysis finished.',
          })
        }
      } finally {
        if (!reply.raw.destroyed) {
          reply.raw.end()
        }
      }
    })
  }
}

export const journalAnalysisRoutes = createJournalAnalysisRoutes()
