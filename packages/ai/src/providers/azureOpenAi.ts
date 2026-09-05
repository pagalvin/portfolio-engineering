import {
  azureOpenAiConfigSchema,
} from '@portfolio-engineering/validation/aiConnection'
import { clampMaxOutputTokens, DEFAULT_TEST_TIMEOUT_MS, invokeGeneration } from '../invoke.js'
import { registerProvider } from '../registry.js'
import type { ProviderDefinition, TestResult } from '../types.js'

export type AzureOpenAiConfig = Record<string, unknown> & {
  readonly endpoint: string
  readonly deployment: string
  readonly apiKey: string
  readonly apiVersion: string
}

export interface AzureOpenAiAdapter {
  readonly providerId: 'azure-openai'
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

function parseAzureResponse(payload: unknown): {
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

  const firstChoice = response.choices?.[0]
  const content = firstChoice?.message?.content

  if (typeof content === 'string') {
    return { responseText: content, modelUsed: response.model }
  }

  if (Array.isArray(content)) {
    const responseText = content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')

    return { responseText, modelUsed: response.model }
  }

  return { responseText: '' }
}

function usesAzureV1Api(config: AzureOpenAiConfig): boolean {
  const pathname = new URL(config.endpoint).pathname.replace(/\/+$/, '')
  return pathname.endsWith('/openai/v1') || config.deployment.startsWith('gpt-5')
}

function buildAzureChatCompletionUrl(config: AzureOpenAiConfig): string {
  const baseEndpoint = config.endpoint.replace(/\/+$/, '')

  if (usesAzureV1Api(config)) {
    return baseEndpoint.endsWith('/openai/v1')
      ? `${baseEndpoint}/chat/completions`
      : `${baseEndpoint}/openai/v1/chat/completions`
  }

  const deployment = encodeURIComponent(config.deployment)
  const apiVersion = encodeURIComponent(config.apiVersion)

  return `${baseEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
}

export function createAzureOpenAiAdapter(
  config: AzureOpenAiConfig,
): AzureOpenAiAdapter {
  const validatedConfig = azureOpenAiConfigSchema.parse(config)

  return {
    providerId: 'azure-openai',
    async generateText(
      prompt,
      options,
    ): Promise<TestResult> {
      const requestPrompt = prompt.trim() || 'Say hello and confirm you are online.'

      return invokeGeneration({
        providerId: 'azure-openai',
        connectionId: options?.connectionId,
        prompt: requestPrompt,
        timeoutMs: options?.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS,
        maxOutputTokens: clampMaxOutputTokens(options?.maxOutputTokens),
        signal: options?.signal,
        endpoint: buildAzureChatCompletionUrl(validatedConfig),
        apiKey: validatedConfig.apiKey,
        headers: {
          'api-key': validatedConfig.apiKey,
        },
        requestBody: usesAzureV1Api(validatedConfig)
          ? {
              model: validatedConfig.deployment,
              messages: [{ role: 'user', content: requestPrompt }],
              max_completion_tokens: clampMaxOutputTokens(options?.maxOutputTokens),
            }
          : {
              messages: [{ role: 'user', content: requestPrompt }],
              max_tokens: clampMaxOutputTokens(options?.maxOutputTokens),
              temperature: 0,
              stream: false,
            },
        parseResponse: parseAzureResponse,
      })
    },
  }
}

const azureOpenAiProviderDefinition: ProviderDefinition = {
  id: 'azure-openai',
  displayName: 'Azure OpenAI',
  fields: [
    { name: 'endpoint', type: 'string', required: true, secret: false },
    { name: 'deployment', type: 'string', required: true, secret: false },
    { name: 'apiKey', type: 'string', required: true, secret: true },
    { name: 'apiVersion', type: 'string', required: true, secret: false },
  ],
  isUsable: true,
  adapterFactory: (config) => createAzureOpenAiAdapter(config as AzureOpenAiConfig),
}

export const azureOpenAiProvider = registerProvider(azureOpenAiProviderDefinition)
export { azureOpenAiConfigSchema }
