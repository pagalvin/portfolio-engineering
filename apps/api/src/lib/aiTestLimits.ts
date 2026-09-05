import type { FailureKind } from '@portfolio-engineering/ai'

export const AI_TEST_LIMITS = {
  connectionTestsPerWindow: 10,
  organizationTestsPerWindow: 30,
  windowMs: 60 * 60 * 1000,
  minimumIntervalMs: 5 * 1000,
  escalationFailureCount: 3,
} as const

const deterministicFailureKinds = new Set<FailureKind>([
  'auth',
  'not_found',
  'bad_request',
])

function isFailureKind(value: string): value is FailureKind {
  return [
    'auth',
    'not_found',
    'rate_limit',
    'timeout',
    'network',
    'bad_request',
    'provider_error',
    'unknown',
  ].includes(value)
}

interface TestLimitState {
  readonly connectionAttempts: Map<string, number[]>
  readonly organizationAttempts: Map<string, number[]>
  readonly lastConnectionAttempt: Map<string, number>
}

export interface TestLimitResult {
  readonly allowed: boolean
  readonly retryAt?: Date
  readonly reason?: 'minimum_interval' | 'connection_limit' | 'organization_limit'
}

const state: TestLimitState = {
  connectionAttempts: new Map(),
  organizationAttempts: new Map(),
  lastConnectionAttempt: new Map(),
}

function getRecentAttempts(attempts: number[], now: number): number[] {
  const cutoff = now - AI_TEST_LIMITS.windowMs
  return attempts.filter((attempt) => attempt > cutoff)
}

function getRetryAt(timestamp: number): Date {
  return new Date(timestamp)
}

export function reserveAiTestSlot(
  organizationId: string,
  connectionId: string,
  now = Date.now(),
): TestLimitResult {
  const lastAttempt = state.lastConnectionAttempt.get(connectionId)
  if (
    lastAttempt !== undefined &&
    now - lastAttempt < AI_TEST_LIMITS.minimumIntervalMs
  ) {
    return {
      allowed: false,
      reason: 'minimum_interval',
      retryAt: getRetryAt(lastAttempt + AI_TEST_LIMITS.minimumIntervalMs),
    }
  }

  const connectionAttempts = getRecentAttempts(
    state.connectionAttempts.get(connectionId) ?? [],
    now,
  )
  if (connectionAttempts.length >= AI_TEST_LIMITS.connectionTestsPerWindow) {
    return {
      allowed: false,
      reason: 'connection_limit',
      retryAt: getRetryAt(connectionAttempts[0] + AI_TEST_LIMITS.windowMs),
    }
  }

  const organizationAttempts = getRecentAttempts(
    state.organizationAttempts.get(organizationId) ?? [],
    now,
  )
  if (organizationAttempts.length >= AI_TEST_LIMITS.organizationTestsPerWindow) {
    return {
      allowed: false,
      reason: 'organization_limit',
      retryAt: getRetryAt(organizationAttempts[0] + AI_TEST_LIMITS.windowMs),
    }
  }

  state.connectionAttempts.set(connectionId, [...connectionAttempts, now])
  state.organizationAttempts.set(organizationId, [...organizationAttempts, now])
  state.lastConnectionAttempt.set(connectionId, now)

  return { allowed: true }
}

export function isAiTestEscalated(input: {
  readonly failureKind?: string | null
  readonly consecutiveFailureCount: number
}): boolean {
  if (!input.failureKind || !isFailureKind(input.failureKind)) {
    return false
  }

  return (
    deterministicFailureKinds.has(input.failureKind) ||
    input.consecutiveFailureCount >= AI_TEST_LIMITS.escalationFailureCount
  )
}

export function resetAiTestLimitState(): void {
  state.connectionAttempts.clear()
  state.organizationAttempts.clear()
  state.lastConnectionAttempt.clear()
}
