export type FailureKind =
  | 'auth'
  | 'not_found'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'bad_request'
  | 'provider_error'
  | 'unknown'

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

export interface ProviderDefinition<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TAdapter = unknown,
> {
  readonly id: string
  readonly displayName: string
  readonly fields: readonly ProviderFieldDefinition[]
  readonly isUsable: boolean
  readonly adapterFactory: (config: TConfig) => TAdapter
}

export interface TestResultSuccess {
  readonly status: 'success'
  readonly providerId: string
  readonly connectionId: string
  readonly testedAt: string
  readonly latencyMs: number
  readonly responseText: string
  readonly modelUsed?: string
}

export interface TestResultFailure {
  readonly status: 'failure'
  readonly providerId: string
  readonly connectionId: string
  readonly testedAt: string
  readonly latencyMs?: number
  readonly failureKind: FailureKind
  readonly message: string
  readonly providerStatusCode?: number
}

export type TestResult = TestResultSuccess | TestResultFailure
