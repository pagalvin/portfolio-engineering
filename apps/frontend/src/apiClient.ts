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
  AiConnection,
  AiConnectionInput,
  AiConnectionUpdateInput,
  AiTestResult,
  ProviderMetadata,
} from './aiConnectionApi'

/**
 * API error response with optional details
 */
export interface ApiError {
  status: number
  code?: string
  message: string
}

/**
 * Configuration for API requests
 */
interface ApiClientConfig {
  baseUrl?: string
  getAccessToken: () => string | null
  onSessionExpired: () => void
}

/**
 * Authenticated API Client
 * All methods require an access token from the session.
 */
export class AuthenticatedApiClient {
  private baseUrl: string
  private getAccessToken: () => string | null
  private onSessionExpired: () => void

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl || '/api'
    this.getAccessToken = config.getAccessToken
    this.onSessionExpired = config.onSessionExpired
  }

  /**
   * Internal method: Make authenticated request with token refresh on 401
   */
  private async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown
      query?: Record<string, string | number | boolean | undefined>
    },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin)

    // Add query parameters
    if (options?.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const accessToken = this.getAccessToken()
    if (!accessToken) {
      this.onSessionExpired()
      throw new Error('No access token available; session may have expired')
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

    // Handle 401 Unauthorized — session expired
    if (response.status === 401) {
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

    return (await response.json()) as T
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
    dates?: string[] // for selected mode
    tz?: string // IANA timezone
  }): Promise<JournalEntriesResponse> {
    const query: Record<string, string | number | boolean | undefined> = {
      mode: params.mode,
      tz: params.tz || 'UTC',
    }

    // Add mode-specific parameters
    if (params.mode === 'day' && params.date) {
      query.date = params.date
    } else if (params.mode === 'week' && params.weekStart) {
      query.weekStart = params.weekStart
    } else if (params.mode === 'month' && params.month) {
      query.month = params.month
    } else if (params.mode === 'all') {
      if (params.limit !== undefined) query.limit = params.limit
      if (params.offset !== undefined) query.offset = params.offset
    }

    // Build URL manually for array params
    const url = new URL(`${this.baseUrl}/journal/entries`, window.location.origin)
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })

    // Handle selected mode dates
    if (params.mode === 'selected' && params.dates?.length) {
      params.dates.forEach((date) => {
        url.searchParams.append('dates', date)
      })
    }

    const accessToken = this.getAccessToken()
    if (!accessToken) {
      this.onSessionExpired()
      throw new Error('No access token available')
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.status === 401) {
      this.onSessionExpired()
      throw {
        status: 401,
        message: 'Session expired',
      } as ApiError
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw {
        status: response.status,
        message: errorData.message || `HTTP ${response.status}`,
      } as ApiError
    }

    return (await response.json()) as JournalEntriesResponse
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
}

/**
 * Factory function to create an authenticated API client
 * Requires session to be passed in
 */
export function createAuthenticatedApiClient(config: ApiClientConfig): AuthenticatedApiClient {
  return new AuthenticatedApiClient(config)
}
