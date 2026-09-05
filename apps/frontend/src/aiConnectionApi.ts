import type { AuthenticatedApiClient } from './apiClient'

export type ProviderFieldType = 'string' | 'number' | 'boolean'

export interface ProviderFieldDefinition {
  readonly name: string
  readonly type: ProviderFieldType
  readonly required: boolean
  readonly secret: boolean
  readonly label?: string
  readonly placeholder?: string
  readonly description?: string
}

export interface ProviderMetadata {
  readonly id: string
  readonly displayName: string
  readonly fields: readonly ProviderFieldDefinition[]
  readonly usable: boolean
}

export interface AiConnection {
  readonly id: string
  readonly providerId: string
  readonly label: string
  readonly enabled: boolean
  readonly config: Record<string, unknown>
  readonly health: 'ready' | 'untested' | 'failing' | 'disabled'
  readonly escalated: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastTestedAt: string | null
  readonly lastTestStatus: 'success' | 'failure' | null
  readonly lastTestFailureKind: string | null
  readonly consecutiveFailureCount: number
  readonly lastErrorSummary: string | null
}

export interface AiConnectionInput {
  readonly providerId: string
  readonly label: string
  readonly config: Record<string, unknown>
  readonly secrets: Record<string, unknown>
}

export interface AiConnectionUpdateInput {
  readonly label?: string
  readonly config?: Record<string, unknown>
  readonly secrets?: Record<string, unknown>
  readonly enabled?: boolean
}

export interface AiTestSuccess {
  readonly status: 'success'
  readonly providerId: string
  readonly connectionId: string
  readonly testedAt: string
  readonly latencyMs: number
  readonly responseText: string
  readonly modelUsed?: string
}

export interface AiTestFailure {
  readonly status: 'failure'
  readonly providerId: string
  readonly connectionId: string
  readonly testedAt: string
  readonly latencyMs?: number
  readonly failureKind: string
  readonly message: string
  readonly providerStatusCode?: number
}

export type AiTestResult = AiTestSuccess | AiTestFailure

export function listAiProviders(
  apiClient: AuthenticatedApiClient,
): Promise<{ providers: readonly ProviderMetadata[] }> {
  return apiClient.listAiProviders()
}

export function listAiConnections(
  apiClient: AuthenticatedApiClient,
): Promise<{ connections: readonly AiConnection[] }> {
  return apiClient.listAiConnections()
}

export function createAiConnection(
  apiClient: AuthenticatedApiClient,
  input: AiConnectionInput,
): Promise<AiConnection> {
  return apiClient.createAiConnection(input)
}

export function updateAiConnection(
  apiClient: AuthenticatedApiClient,
  connectionId: string,
  input: AiConnectionUpdateInput,
): Promise<AiConnection> {
  return apiClient.updateAiConnection(connectionId, input)
}

export function deleteAiConnection(
  apiClient: AuthenticatedApiClient,
  connectionId: string,
): Promise<{ deleted: true }> {
  return apiClient.deleteAiConnection(connectionId)
}

export function testAiConnection(
  apiClient: AuthenticatedApiClient,
  connectionId: string,
): Promise<AiTestResult> {
  return apiClient.testAiConnection(connectionId)
}
