import { openAiConfigSchema } from '@portfolio-engineering/validation/aiConnection'
import { clampMaxOutputTokens, DEFAULT_TEST_TIMEOUT_MS, invokeGeneration } from '../invoke.js'
import { registerProvider } from '../registry.js'
import type { ProviderDefinition, TestResult } from '../types.js'

export type OpenAiConfig = Record<string, unknown> & {
  readonly apiKey: string
  readonly model: string
}

export interface OpenAiAdapter {
  readonly providerId: 'openai'
  generateText(
    prompt: string,
    options?: {
      readonly connectionId?: string
      readonly signal?: AbortSignal
      readonly timeoutMs?: number
      readonly maxOutputTokens?: number
    },
  ): Promise<TestResult>
}

export const openAiProviderFields = [
  { name: 'apiKey', type: 'string', required: true, secret: true },
  { name: 'model', type: 'string', required: true, secret: false },
] as const

function parseOpenAiResponse(payload: unknown): {
  readonly responseText: string
  readonly modelUsed?: string
} {
  const response = payload as {
    readonly choices?: Array<{
      readonly message?: {
        readonly content?: string | Array<{ readonly text?: string }>
      }
    }>
    readonly model?: string
  }
  const content = response.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return { responseText: content, modelUsed: response.model }
  }

  if (Array.isArray(content)) {
    return {
      responseText: content
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join(''),
      modelUsed: response.model,
    }
  }

  return { responseText: '', modelUsed: response.model }
}

export function validateOpenAiConfig(config: OpenAiConfig): OpenAiConfig {
  return openAiConfigSchema.parse(config) as OpenAiConfig
}

export function createOpenAiAdapter(config: OpenAiConfig): OpenAiAdapter {
  const validatedConfig = openAiConfigSchema.parse(config)

  return {
    providerId: 'openai',
    async generateText(prompt, options): Promise<TestResult> {
      const requestPrompt = prompt.trim() || 'Say hello and confirm you are online.'
      const maxOutputTokens = clampMaxOutputTokens(options?.maxOutputTokens)

      return invokeGeneration({
        providerId: 'openai',
        connectionId: options?.connectionId,
        prompt: requestPrompt,
        timeoutMs: options?.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS,
        maxOutputTokens,
        signal: options?.signal,
        endpoint: 'https://api.openai.com/v1/chat/completions',
        headers: {
          Authorization: `Bearer ${validatedConfig.apiKey}`,
        },
        requestBody: {
          model: validatedConfig.model,
          messages: [{ role: 'user', content: requestPrompt }],
          max_tokens: maxOutputTokens,
          temperature: 0,
          stream: false,
        },
        parseResponse: parseOpenAiResponse,
      })
    },
  }
}

const openAiProviderDefinition: ProviderDefinition = {
  id: 'openai',
  displayName: 'OpenAI',
  fields: openAiProviderFields,
  isUsable: true,
  adapterFactory: (config) => createOpenAiAdapter(config as OpenAiConfig),
}

export const openAiProvider = registerProvider(openAiProviderDefinition)
export { openAiConfigSchema }
