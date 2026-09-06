import {
  DEFAULT_TEST_TIMEOUT_MS,
  getFailureKindForStatus,
  getFailureKindFromError,
  getSafeFailureMessage,
} from './invoke.js'
import type {
  FailureKind,
  StreamTextEvent,
} from './types.js'

export const DEFAULT_STREAMING_OUTPUT_TOKEN_CEILING = 4_000

export type StreamTextParseResult =
  | StreamTextEvent
  | null
  | undefined

export interface InvokeStreamingGenerationOptions {
  readonly providerId: string
  readonly connectionId?: string
  readonly prompt: string
  readonly timeoutMs?: number
  readonly maxOutputTokens?: number
  readonly signal?: AbortSignal
  readonly endpoint: string
  readonly headers?: Record<string, string>
  readonly requestBody: unknown
  readonly parseStreamData: (
    data: string,
  ) => StreamTextParseResult | readonly StreamTextParseResult[]
}

export function clampStreamingMaxOutputTokens(value?: number): number {
  return Math.max(
    1,
    Math.min(
      value ?? DEFAULT_STREAMING_OUTPUT_TOKEN_CEILING,
      DEFAULT_STREAMING_OUTPUT_TOKEN_CEILING,
    ),
  )
}

function withMaxOutputTokens(requestBody: unknown, maxOutputTokens: number): unknown {
  if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
    return requestBody
  }

  const body = requestBody as Record<string, unknown>
  const nextBody = { ...body }

  if ('max_tokens' in nextBody) {
    nextBody.max_tokens = maxOutputTokens
  }

  if ('max_completion_tokens' in nextBody) {
    nextBody.max_completion_tokens = maxOutputTokens
  }

  if (
    nextBody.generationConfig &&
    typeof nextBody.generationConfig === 'object' &&
    !Array.isArray(nextBody.generationConfig)
  ) {
    const generationConfig = nextBody.generationConfig as Record<string, unknown>
    nextBody.generationConfig = {
      ...generationConfig,
      maxOutputTokens,
    }
  }

  return nextBody
}

function toStreamErrorEvent(
  failureKind: FailureKind,
  providerStatusCode?: number,
): StreamTextEvent {
  const event = {
    type: 'error' as const,
    failureKind,
    message: getSafeFailureMessage(failureKind),
  }

  return providerStatusCode === undefined
    ? event
    : { ...event, providerStatusCode }
}

function parseSseFrame(frame: string): string | undefined {
  const dataLines: string[] = []

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return undefined
  }

  return dataLines.join('\n')
}

function normalizeParseResults(
  result: StreamTextParseResult | readonly StreamTextParseResult[],
): StreamTextEvent[] {
  const results = Array.isArray(result) ? result : [result]
  return results.filter((event): event is StreamTextEvent => event !== null && event !== undefined)
}

function isTerminalEvent(event: StreamTextEvent): boolean {
  return event.type === 'done' || event.type === 'error'
}

async function* readSseStream(
  stream: ReadableStream<Uint8Array>,
  parseStreamData: InvokeStreamingGenerationOptions['parseStreamData'],
): AsyncGenerator<StreamTextEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })

      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = done ? '' : frames.pop() ?? ''

      for (const frame of frames) {
        const data = parseSseFrame(frame)
        if (!data) {
          continue
        }

        if (data === '[DONE]') {
          yield { type: 'done' }
          return
        }

        for (const event of normalizeParseResults(parseStreamData(data))) {
          yield event

          if (isTerminalEvent(event)) {
            return
          }
        }
      }

      if (done) {
        break
      }
    }

    if (buffer.trim().length > 0) {
      const data = parseSseFrame(buffer)
      if (data && data !== '[DONE]') {
        for (const event of normalizeParseResults(parseStreamData(data))) {
          yield event

          if (isTerminalEvent(event)) {
            return
          }
        }
      }
    }

    yield { type: 'done' }
  } finally {
    reader.releaseLock()
  }
}

export async function* invokeStreamingGeneration(
  options: InvokeStreamingGenerationOptions,
): AsyncGenerator<StreamTextEvent> {
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS)
  const maxOutputTokens = clampStreamingMaxOutputTokens(options.maxOutputTokens)
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal

  try {
    const response = await fetch(options.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(withMaxOutputTokens(options.requestBody, maxOutputTokens)),
      signal,
    })

    if (!response.ok) {
      yield toStreamErrorEvent(getFailureKindForStatus(response.status), response.status)
      return
    }

    if (!response.body) {
      yield toStreamErrorEvent('provider_error')
      return
    }

    for await (const event of readSseStream(response.body, options.parseStreamData)) {
      yield event
    }
  } catch (error: unknown) {
    yield toStreamErrorEvent(getFailureKindFromError(error))
  } finally {
    clearTimeout(timeoutHandle)
  }
}
