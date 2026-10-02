import {
  anthropicConfigSchema,
} from '@portfolio-engineering/validation/aiConnection'
import {
  clampMaxOutputTokens,
  DEFAULT_TEST_TIMEOUT_MS,
  getSafeFailureMessage,
  invokeGeneration,
} from '../invoke.js'
import { registerProvider } from '../registry.js'
import {
  clampStreamingMaxOutputTokens,
  invokeStreamingGeneration,
} from '../stream.js'
import type {
  FailureKind,
  ProviderDefinition,
  StreamTextEvent,
  TestResult,
} from '../types.js'

export type AnthropicConfig = Record<string, unknown> & {
  readonly apiKey: string
  readonly model: string
}

export const anthropicProviderFields = [
  { name: 'apiKey', type: 'string', required: true, secret: true },
  { name: 'model', type: 'string', required: true, secret: false },
] as const

export function validateAnthropicConfig(
  config: AnthropicConfig,
): AnthropicConfig {
  return anthropicConfigSchema.parse(config) as AnthropicConfig
}

export interface AnthropicAdapter {
  readonly providerId: 'anthropic'
  generateText(
    prompt: string,
    options?: {
      readonly connectionId?: string
      readonly signal?: AbortSignal
      readonly timeoutMs?: number
      readonly maxOutputTokens?: number
    },
  ): Promise<TestResult>
  streamText(
    prompt: string,
    options?: {
      readonly connectionId?: string
      readonly signal?: AbortSignal
      readonly timeoutMs?: number
      readonly maxOutputTokens?: number
    },
  ): AsyncGenerator<StreamTextEvent>
}

function parseAnthropicResponse(payload: unknown): {
  readonly responseText: string
  readonly modelUsed?: string
} {
  const response = payload as {
    readonly content?: Array<{
      readonly type?: string
      readonly text?: string
    }>
    readonly model?: string
  }

  return {
    responseText: Array.isArray(response.content)
      ? response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text ?? '')
          .join('')
      : '',
    modelUsed: response.model,
  }
}

function getAnthropicStreamFailureKind(errorType?: string): FailureKind {
  switch (errorType) {
    case 'authentication_error':
    case 'permission_error':
      return 'auth'
    case 'not_found_error':
      return 'not_found'
    case 'rate_limit_error':
      return 'rate_limit'
    case 'invalid_request_error':
      return 'bad_request'
    case 'api_error':
    case 'overloaded_error':
      return 'provider_error'
    default:
      return 'unknown'
  }
}

function parseAnthropicStreamData(data: string): StreamTextEvent | undefined {
  let payload: {
    readonly type?: string
    readonly delta?: {
      readonly type?: string
      readonly text?: string
    }
    readonly error?: {
      readonly type?: string
    }
  }

  try {
    payload = JSON.parse(data) as typeof payload
  } catch {
    return {
      type: 'error',
      failureKind: 'provider_error',
      message: getSafeFailureMessage('provider_error'),
    }
  }

  if (
    payload.type === 'content_block_delta' &&
    payload.delta?.type === 'text_delta' &&
    typeof payload.delta.text === 'string' &&
    payload.delta.text.length > 0
  ) {
    return { type: 'chunk', text: payload.delta.text }
  }

  if (payload.type === 'message_stop') {
    return { type: 'done' }
  }

  if (payload.type === 'error') {
    const failureKind = getAnthropicStreamFailureKind(payload.error?.type)
    return {
      type: 'error',
      failureKind,
      message: getSafeFailureMessage(failureKind),
    }
  }

  return undefined
}

export function createAnthropicAdapter(
  config: AnthropicConfig,
): AnthropicAdapter {
  const validatedConfig = anthropicConfigSchema.parse(config)

  return {
    providerId: 'anthropic',
    async generateText(prompt, options): Promise<TestResult> {
      const requestPrompt = prompt.trim() || 'Say hello and confirm you are online.'
      const maxOutputTokens = clampMaxOutputTokens(options?.maxOutputTokens)

      return invokeGeneration({
        providerId: 'anthropic',
        connectionId: options?.connectionId,
        prompt: requestPrompt,
        timeoutMs: options?.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS,
        maxOutputTokens,
        signal: options?.signal,
        endpoint: 'https://api.anthropic.com/v1/messages',
        headers: {
          'x-api-key': validatedConfig.apiKey,
          'anthropic-version': '2023-06-01',
        },
        requestBody: {
          model: validatedConfig.model,
          max_tokens: maxOutputTokens,
          messages: [{ role: 'user', content: requestPrompt }],
          stream: false,
        },
        parseResponse: parseAnthropicResponse,
      })
    },
    async *streamText(prompt, options): AsyncGenerator<StreamTextEvent> {
      const requestPrompt = prompt.trim() || 'Say hello and confirm you are online.'
      const maxOutputTokens = clampStreamingMaxOutputTokens(options?.maxOutputTokens)

      yield* invokeStreamingGeneration({
        providerId: 'anthropic',
        connectionId: options?.connectionId,
        prompt: requestPrompt,
        timeoutMs: options?.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS,
        maxOutputTokens,
        signal: options?.signal,
        endpoint: 'https://api.anthropic.com/v1/messages',
        headers: {
          'x-api-key': validatedConfig.apiKey,
          'anthropic-version': '2023-06-01',
        },
        requestBody: {
          model: validatedConfig.model,
          max_tokens: maxOutputTokens,
          messages: [{ role: 'user', content: requestPrompt }],
          stream: true,
        },
        parseStreamData: parseAnthropicStreamData,
      })
    },
  }
}

const anthropicProviderDefinition: ProviderDefinition = {
  id: 'anthropic',
  displayName: 'Anthropic',
  fields: anthropicProviderFields,
  isUsable: true,
  adapterFactory: (config) => createAnthropicAdapter(config as AnthropicConfig),
}

export const anthropicProvider = registerProvider(anthropicProviderDefinition)
export { anthropicConfigSchema }
