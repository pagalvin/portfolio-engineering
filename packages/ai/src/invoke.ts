import type { TestResult, FailureKind } from './types.js'

export const DEFAULT_TEST_TIMEOUT_MS = 15_000
export const DEFAULT_OUTPUT_TOKEN_CEILING = 64

export interface GenerationRequestOptions {
  readonly providerId: string
  readonly connectionId?: string
  readonly prompt: string
  readonly timeoutMs?: number
  readonly maxOutputTokens?: number
  readonly signal?: AbortSignal
}

export interface InvokeGenerationOptions extends GenerationRequestOptions {
  readonly endpoint: string
  readonly apiKey?: string
  readonly headers?: Record<string, string>
  readonly requestBody: unknown
  readonly parseResponse: (payload: unknown) => {
    readonly responseText: string
    readonly modelUsed?: string
  }
}

export function getSafeFailureMessage(failureKind: FailureKind): string {
  switch (failureKind) {
    case 'auth':
      return 'Authentication failed.'
    case 'not_found':
      return 'The configured endpoint or deployment was not found.'
    case 'rate_limit':
      return 'Rate limit reached. Please wait before retrying.'
    case 'timeout':
      return 'The request timed out.'
    case 'network':
      return 'The provider could not be reached.'
    case 'bad_request':
      return 'The request configuration was rejected.'
    case 'provider_error':
      return 'The provider returned an internal error.'
    case 'unknown':
    default:
      return 'The provider request failed.'
  }
}

function getFailureKindForStatus(statusCode?: number): FailureKind {
  if (!statusCode) {
    return 'unknown'
  }

  if (statusCode === 401 || statusCode === 403) {
    return 'auth'
  }

  if (statusCode === 404) {
    return 'not_found'
  }

  if (statusCode === 429) {
    return 'rate_limit'
  }

  if (statusCode === 400 || statusCode === 422) {
    return 'bad_request'
  }

  if (statusCode >= 500 && statusCode < 600) {
    return 'provider_error'
  }

  return 'unknown'
}

function getFailureKindFromError(error: unknown): FailureKind {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'timeout'
  }

  if (typeof error === 'object' && error !== null && 'cause' in error) {
    const cause = (error as { cause?: unknown }).cause
    if (cause instanceof Error && cause.name === 'AbortError') {
      return 'timeout'
    }
  }

  return 'network'
}

function toSuccessResult(
  providerId: string,
  connectionId: string,
  startedAt: number,
  responseText: string,
  modelUsed?: string,
): TestResult {
  return {
    status: 'success',
    providerId,
    connectionId,
    testedAt: new Date(startedAt).toISOString(),
    latencyMs: Math.max(0, Date.now() - startedAt),
    responseText,
    modelUsed,
  }
}

function toFailureResult(
  providerId: string,
  connectionId: string,
  startedAt: number,
  failureKind: FailureKind,
  providerStatusCode?: number,
): TestResult {
  return {
    status: 'failure',
    providerId,
    connectionId,
    testedAt: new Date(startedAt).toISOString(),
    latencyMs: Math.max(0, Date.now() - startedAt),
    failureKind,
    message: getSafeFailureMessage(failureKind),
    providerStatusCode,
  }
}

export async function invokeGeneration(
  options: InvokeGenerationOptions,
): Promise<TestResult> {
  const startedAt = Date.now()
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS)
  const maxOutputTokens = Math.max(
    1,
    Math.min(options.maxOutputTokens ?? DEFAULT_OUTPUT_TOKEN_CEILING, DEFAULT_OUTPUT_TOKEN_CEILING),
  )
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal
  const requestBody = options.requestBody as Record<string, unknown> | undefined

  if (requestBody && typeof requestBody === 'object' && 'max_tokens' in requestBody) {
    requestBody.max_tokens = maxOutputTokens
  }

  try {
    const response = await fetch(options.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(requestBody),
      signal,
    })

    if (!response.ok) {
      return toFailureResult(
        options.providerId,
        options.connectionId ?? '',
        startedAt,
        getFailureKindForStatus(response.status),
        response.status,
      )
    }

    const payload = await response.json().catch(() => undefined)
    const parsed = options.parseResponse(payload)

    return toSuccessResult(
      options.providerId,
      options.connectionId ?? '',
      startedAt,
      parsed.responseText,
      parsed.modelUsed,
    )
  } catch (error: unknown) {
    const failureKind = getFailureKindFromError(error)
    return toFailureResult(
      options.providerId,
      options.connectionId ?? '',
      startedAt,
      failureKind,
    )
  } finally {
    clearTimeout(timeoutHandle)
  }
}

export function clampMaxOutputTokens(value?: number): number {
  return Math.max(1, Math.min(value ?? DEFAULT_OUTPUT_TOKEN_CEILING, DEFAULT_OUTPUT_TOKEN_CEILING))
}
