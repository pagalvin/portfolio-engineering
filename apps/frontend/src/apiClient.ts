/**
 * Authenticated API Client
 *
 * Provides type-safe methods for calling protected journal endpoints.
 * Automatically attaches bearer token and handles token refresh on 401.
 * All requests require an active authenticated session.
 */

import type {
  JournalEntry,
  CreateJournalEntryRequest,
  UpdateJournalEntryRequest,
  MoveJournalEntryRequest,
  JournalEntriesResponse,
} from '@portfolio-engineering/shared-types/journal'
import type {
  JournalAnalysisRequest,
  JournalAnalysisStreamEvent,
} from '@portfolio-engineering/shared-types/journalAnalysis'
import type {
  AiConnection,
  AiConnectionInput,
  AiConnectionUpdateInput,
  AiTestResult,
  ProviderMetadata,
} from './aiConnectionApi'
import type {
  InvestorProfileRecord,
  InvestorProfileCatalogs,
  UpsertInvestorProfileInput,
} from './investorProfileApi'
import { refreshAccessToken as defaultRefreshAccessToken } from './authSession'

/**
 * API error response with optional details
 */
export interface ApiError {
  status: number
  code?: string
  message: string
}

export interface JournalAnalysisStreamOptions {
  signal?: AbortSignal
  onEvent: (event: JournalAnalysisStreamEvent) => void
}

/**
 * Configuration for API requests
 */
export interface ApiClientConfig {
  baseUrl?: string
  getAccessToken: () => string | null
  onSessionExpired: () => void
  refreshAccessToken?: () => Promise<string | null>
}

/**
 * Authenticated API Client
 * All methods require an access token from the session.
 */
export class AuthenticatedApiClient {
  private baseUrl: string
  private getAccessToken: () => string | null
  private onSessionExpired: () => void
  private refreshFn: () => Promise<string | null>
  private refreshPromise: Promise<string | null> | null = null

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl || '/api'
    this.getAccessToken = config.getAccessToken
    this.onSessionExpired = config.onSessionExpired
    this.refreshFn = config.refreshAccessToken || defaultRefreshAccessToken
  }

  private async performRefresh(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.refreshFn().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  /**
   * Internal method: Make authenticated request with single-flight token refresh and retry on 401
   */
  private async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown
      query?: Record<string, string | number | boolean | readonly string[] | undefined>
    },
    isRetry = false,
  ): Promise<T> {
    let accessToken = this.getAccessToken()

    if (!accessToken && !isRetry) {
      accessToken = await this.performRefresh()
    }

    if (!accessToken) {
      this.onSessionExpired()
      throw {
        status: 401,
        message: 'No access token available; session may have expired',
      } as ApiError
    }

    const url = new URL(`${this.baseUrl}${path}`, window.location.origin)

    // Add query parameters
    if (options?.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => url.searchParams.append(key, String(v)))
          } else {
            url.searchParams.append(key, String(value))
          }
        }
      })
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    }

    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    })

    // Handle 401 Unauthorized — attempt single-flight refresh and 1 retry
    if (response.status === 401) {
      if (!isRetry) {
        const newToken = await this.performRefresh()
        if (newToken) {
          return this.request<T>(method, path, options, true)
        }
      }
      this.onSessionExpired()
      throw {
        status: 401,
        message: 'Session expired or invalid token',
      } as ApiError
    }

    // Handle other HTTP errors
    if (!response.ok) {
      let errorData: Partial<ApiError> = {}
      const contentType = response.headers.get('content-type') ?? ''

      if (contentType.includes('application/json')) {
        try {
          errorData = await response.json()
        } catch {
          // Ignore JSON parse errors
        }
      }

      throw {
        status: response.status,
        code: errorData.code,
        message: errorData.message || `HTTP ${response.status}`,
      } as ApiError
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  private async readApiError(response: Response): Promise<ApiError> {
    let errorData: Partial<ApiError> = {}
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      try {
        errorData = (await response.json()) as Partial<ApiError>
      } catch {
        errorData = {}
      }
    }

    return {
      status: response.status,
      code: errorData.code,
      message: errorData.message || `HTTP ${response.status}`,
    }
  }

  private parseJournalAnalysisEvent(data: string): JournalAnalysisStreamEvent | null {
    const parsed = JSON.parse(data) as unknown

    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
      return null
    }

    const event = parsed as {
      readonly type?: unknown
      readonly text?: unknown
      readonly message?: unknown
      readonly code?: unknown
    }

    if (event.type === 'chunk' && typeof event.text === 'string') {
      return {
        type: 'chunk',
        text: event.text,
      }
    }

    if (event.type === 'done') {
      return { type: 'done' }
    }

    if (event.type === 'error' && typeof event.message === 'string') {
      return {
        type: 'error',
        message: event.message,
        code: typeof event.code === 'string' ? event.code : undefined,
      }
    }

    return null
  }

  private emitJournalAnalysisFrame(
    frame: string,
    onEvent: (event: JournalAnalysisStreamEvent) => void,
  ): void {
    const dataLines = frame
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice('data: '.length))

    if (dataLines.length === 0) {
      return
    }

    const event = this.parseJournalAnalysisEvent(dataLines.join('\n'))
    if (event) {
      onEvent(event)
    }
  }

  /**
   * POST /api/journal/entries/:entryId/analyze
   * Stream one saved Journal entry through one ready AI connection.
   */
  async streamJournalAnalysis(
    entryId: string,
    input: JournalAnalysisRequest,
    options: JournalAnalysisStreamOptions,
    isRetry = false,
  ): Promise<void> {
    let accessToken = this.getAccessToken()

    if (!accessToken && !isRetry) {
      accessToken = await this.performRefresh()
    }

    if (!accessToken) {
      this.onSessionExpired()
      throw {
        status: 401,
        message: 'No access token available; session may have expired',
      } as ApiError
    }

    const url = new URL(
      `${this.baseUrl}/journal/entries/${encodeURIComponent(entryId)}/analyze`,
      window.location.origin,
    )

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ connectionId: input.connectionId }),
      signal: options.signal,
    })

    if (response.status === 401) {
      if (!isRetry) {
        const newToken = await this.performRefresh()
        if (newToken) {
          return this.streamJournalAnalysis(entryId, input, options, true)
        }
      }
      this.onSessionExpired()
      throw {
        status: 401,
        message: 'Session expired or invalid token',
      } as ApiError
    }

    if (!response.ok) {
      throw await this.readApiError(response)
    }

    if (!response.body) {
      throw {
        status: response.status,
        message: 'Analysis stream could not be opened.',
      } as ApiError
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader()
    let buffered = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffered += value
      let frameBoundary = buffered.indexOf('\n\n')

      while (frameBoundary >= 0) {
        const frame = buffered.slice(0, frameBoundary).trim()
        buffered = buffered.slice(frameBoundary + 2)

        if (frame.length > 0) {
          this.emitJournalAnalysisFrame(frame, options.onEvent)
        }

        frameBoundary = buffered.indexOf('\n\n')
      }
    }

    const finalFrame = buffered.trim()
    if (finalFrame.length > 0) {
      this.emitJournalAnalysisFrame(finalFrame, options.onEvent)
    }
  }

  /**
   * GET /api/journal/entries
   * Retrieve entries by scope (day, week, month, all, selected).
   */
  async getEntries(params: {
    mode: 'day' | 'week' | 'month' | 'all' | 'selected'
    date?: string // YYYY-MM-DD for day mode
    weekStart?: string // Sunday YYYY-MM-DD for week mode
    month?: string // YYYY-MM for month mode
    limit?: number // for all mode
    offset?: number // for all mode
    dates?: readonly string[] // for selected mode
    tz?: string // IANA timezone
  }): Promise<JournalEntriesResponse> {
    const query: Record<
      string,
      string | number | boolean | readonly string[] | undefined
    > = {
      mode: params.mode,
      tz: params.tz || 'UTC',
    }

    if (params.mode === 'day' && params.date) {
      query.date = params.date
    } else if (params.mode === 'week' && params.weekStart) {
      query.weekStart = params.weekStart
    } else if (params.mode === 'month' && params.month) {
      query.month = params.month
    } else if (params.mode === 'all') {
      if (params.limit !== undefined) query.limit = params.limit
      if (params.offset !== undefined) query.offset = params.offset
    } else if (params.mode === 'selected' && params.dates?.length) {
      query.dates = params.dates
    }

    return this.request<JournalEntriesResponse>('GET', '/journal/entries', {
      query,
    })
  }

  /**
   * POST /api/journal/entries
   * Create a new journal entry
   */
  async createEntry(
    input: CreateJournalEntryRequest,
  ): Promise<JournalEntry> {
    return this.request<JournalEntry>('POST', '/journal/entries', {
      body: input,
    })
  }

  /**
   * PUT /api/journal/entries/:entryId
   * Update entry content (only field that can be modified)
   */
  async updateEntry(
    entryId: string,
    input: UpdateJournalEntryRequest,
  ): Promise<JournalEntry> {
    return this.request<JournalEntry>('PUT', `/journal/entries/${entryId}`, {
      body: input,
    })
  }

  /**
   * POST /api/journal/entries/:entryId/move
   * Move entry to a different date
   * Returns 409 Conflict if destination date is occupied
   */
  async moveEntry(
    entryId: string,
    input: MoveJournalEntryRequest,
  ): Promise<JournalEntry> {
    return this.request<JournalEntry>('POST', `/journal/entries/${entryId}/move`, {
      body: input,
    })
  }

  /**
   * DELETE /api/journal/entries/:entryId
   * Delete a journal entry
   */
  async deleteEntry(entryId: string): Promise<void> {
    await this.request('DELETE', `/journal/entries/${entryId}`)
  }

  async listAiProviders(): Promise<{ providers: readonly ProviderMetadata[] }> {
    return this.request('GET', '/ai/providers')
  }

  async listAiConnections(): Promise<{ connections: readonly AiConnection[] }> {
    return this.request('GET', '/ai/connections')
  }

  async createAiConnection(input: AiConnectionInput): Promise<AiConnection> {
    return this.request('POST', '/ai/connections', { body: input })
  }

  async updateAiConnection(
    connectionId: string,
    input: AiConnectionUpdateInput,
  ): Promise<AiConnection> {
    return this.request('PATCH', `/ai/connections/${connectionId}`, {
      body: input,
    })
  }

  async deleteAiConnection(
    connectionId: string,
  ): Promise<{ deleted: true }> {
    return this.request('DELETE', `/ai/connections/${connectionId}`)
  }

  async testAiConnection(connectionId: string): Promise<AiTestResult> {
    return this.request('POST', `/ai/connections/${connectionId}/test`, {
      body: {},
    })
  }

  async getInvestorProfile(): Promise<{ profile: InvestorProfileRecord | null }> {
    return this.request<{ profile: InvestorProfileRecord | null }>('GET', '/investor-profile')
  }

  async updateInvestorProfile(
    input: UpsertInvestorProfileInput,
  ): Promise<{ profile: InvestorProfileRecord }> {
    return this.request<{ profile: InvestorProfileRecord }>('PUT', '/investor-profile', {
      body: input,
    })
  }

  async getInvestorProfileCatalogs(): Promise<{ catalogs: InvestorProfileCatalogs }> {
    return this.request<{ catalogs: InvestorProfileCatalogs }>('GET', '/investor-profile/catalogs')
  }
}

/**
 * Factory function to create an authenticated API client
 * Requires session to be passed in
 */
export function createAuthenticatedApiClient(config: ApiClientConfig): AuthenticatedApiClient {
  return new AuthenticatedApiClient(config)
}
