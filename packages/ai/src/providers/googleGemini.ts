import {
  googleGeminiConfigSchema,
} from '@portfolio-engineering/validation/aiConnection'
import { clampMaxOutputTokens, DEFAULT_TEST_TIMEOUT_MS, invokeGeneration } from '../invoke.js'
import { registerProvider } from '../registry.js'
import { clampStreamingMaxOutputTokens, invokeStreamingGeneration } from '../stream.js'
import type { ProviderDefinition, StreamTextEvent, TestResult } from '../types.js'

export type GoogleGeminiConfig = Record<string, unknown> & {
  readonly apiKey: string
  readonly model: string
}

export interface GoogleGeminiAdapter {
  readonly providerId: 'google-gemini'
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

function parseGeminiResponse(payload: unknown): {
  readonly responseText: string
  readonly modelUsed?: string
} {
  const response = payload as {
    readonly candidates?: Array<{
      readonly content?: {
        readonly parts?: Array<{ readonly text?: string }>
      }
    }>
    readonly modelVersion?: string
  }
  const parts = response.candidates?.[0]?.content?.parts
  const responseText = Array.isArray(parts)
    ? parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
    : ''

  return { responseText, modelUsed: response.modelVersion }
}

function parseGeminiStreamData(data: string): StreamTextEvent | undefined {
  let response: {
    readonly candidates?: Array<{
      readonly content?: {
        readonly parts?: Array<{ readonly text?: string }>
      }
      readonly finishReason?: string
    }>
    readonly event_type?: string
    readonly delta?: {
      readonly type?: string
      readonly text?: string
    }
    readonly text?: string
  }

  try {
    response = JSON.parse(data) as typeof response
  } catch {
    return {
      type: 'error',
      failureKind: 'provider_error',
      message: 'The provider returned an internal error.',
    }
  }

  if (response.event_type === 'interaction.completed') {
    return { type: 'done' }
  }

  if (response.delta?.type === 'text' && typeof response.delta.text === 'string') {
    return response.delta.text.length > 0
      ? { type: 'chunk', text: response.delta.text }
      : undefined
  }

  if (typeof response.text === 'string' && response.text.length > 0) {
    return { type: 'chunk', text: response.text }
  }

  const candidate = response.candidates?.[0]
  const parts = candidate?.content?.parts
  const responseText = Array.isArray(parts)
    ? parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
    : ''

  if (responseText.length > 0) {
    return { type: 'chunk', text: responseText }
  }

  return typeof candidate?.finishReason === 'string'
    ? { type: 'done' }
    : undefined
}

function buildGeminiGenerateContentUrl(config: GoogleGeminiConfig): string {
  const model = encodeURIComponent(config.model)
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

function buildGeminiStreamGenerateContentUrl(config: GoogleGeminiConfig): string {
  const model = encodeURIComponent(config.model)
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`
}

export function createGoogleGeminiAdapter(
  config: GoogleGeminiConfig,
): GoogleGeminiAdapter {
  const validatedConfig = googleGeminiConfigSchema.parse(config)

  return {
    providerId: 'google-gemini',
    async generateText(prompt, options): Promise<TestResult> {
      const requestPrompt = prompt.trim() || 'Say hello and confirm you are online.'
      const maxOutputTokens = clampMaxOutputTokens(options?.maxOutputTokens)

      return invokeGeneration({
        providerId: 'google-gemini',
        connectionId: options?.connectionId,
        prompt: requestPrompt,
        timeoutMs: options?.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS,
        maxOutputTokens,
        signal: options?.signal,
        endpoint: buildGeminiGenerateContentUrl(validatedConfig),
        headers: {
          'x-goog-api-key': validatedConfig.apiKey,
        },
        requestBody: {
          contents: [{ parts: [{ text: requestPrompt }] }],
          generationConfig: {
            maxOutputTokens,
            temperature: 0,
          },
        },
        parseResponse: parseGeminiResponse,
      })
    },
    async *streamText(prompt, options): AsyncGenerator<StreamTextEvent> {
      const requestPrompt = prompt.trim() || 'Say hello and confirm you are online.'
      const maxOutputTokens = clampStreamingMaxOutputTokens(options?.maxOutputTokens)

      yield* invokeStreamingGeneration({
        providerId: 'google-gemini',
        connectionId: options?.connectionId,
        prompt: requestPrompt,
        timeoutMs: options?.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS,
        maxOutputTokens,
        signal: options?.signal,
        endpoint: buildGeminiStreamGenerateContentUrl(validatedConfig),
        headers: {
          'x-goog-api-key': validatedConfig.apiKey,
        },
        requestBody: {
          contents: [{ parts: [{ text: requestPrompt }] }],
          generationConfig: {
            maxOutputTokens,
            temperature: 0,
          },
        },
        parseStreamData: parseGeminiStreamData,
      })
    },
  }
}

const googleGeminiProviderDefinition: ProviderDefinition = {
  id: 'google-gemini',
  displayName: 'Google Gemini',
  fields: [
    { name: 'apiKey', type: 'string', required: true, secret: true },
    { name: 'model', type: 'string', required: true, secret: false },
  ],
  isUsable: true,
  adapterFactory: (config) => createGoogleGeminiAdapter(config as GoogleGeminiConfig),
}

export const googleGeminiProvider = registerProvider(googleGeminiProviderDefinition)
export { googleGeminiConfigSchema }
