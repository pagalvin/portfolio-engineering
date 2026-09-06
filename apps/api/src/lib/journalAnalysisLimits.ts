export const JOURNAL_ANALYSIS_LIMITS = {
  organizationStartsPerWindow: 10,
  windowMs: 60 * 1000,
  minimumIntervalMs: 3 * 1000,
} as const

interface JournalAnalysisLimitState {
  readonly organizationAttempts: Map<string, number[]>
  readonly lastAnalysisAttempt: Map<string, number>
}

export interface JournalAnalysisLimitInput {
  readonly organizationId: string
  readonly userId: string
  readonly entryId: string
  readonly connectionId: string
}

export interface JournalAnalysisLimitResult {
  readonly allowed: boolean
  readonly retryAt?: Date
  readonly reason?: 'minimum_interval' | 'organization_limit'
}

const state: JournalAnalysisLimitState = {
  organizationAttempts: new Map(),
  lastAnalysisAttempt: new Map(),
}

function getAnalysisKey(input: JournalAnalysisLimitInput): string {
  return JSON.stringify([
    input.organizationId,
    input.userId,
    input.entryId,
    input.connectionId,
  ])
}

function getRecentAttempts(attempts: number[], now: number): number[] {
  const cutoff = now - JOURNAL_ANALYSIS_LIMITS.windowMs
  return attempts.filter((attempt) => attempt > cutoff)
}

function getRetryAt(timestamp: number): Date {
  return new Date(timestamp)
}

export function reserveJournalAnalysisSlot(
  input: JournalAnalysisLimitInput,
  now = Date.now(),
): JournalAnalysisLimitResult {
  const analysisKey = getAnalysisKey(input)
  const lastAttempt = state.lastAnalysisAttempt.get(analysisKey)

  if (
    lastAttempt !== undefined &&
    now - lastAttempt < JOURNAL_ANALYSIS_LIMITS.minimumIntervalMs
  ) {
    return {
      allowed: false,
      reason: 'minimum_interval',
      retryAt: getRetryAt(lastAttempt + JOURNAL_ANALYSIS_LIMITS.minimumIntervalMs),
    }
  }

  const organizationAttempts = getRecentAttempts(
    state.organizationAttempts.get(input.organizationId) ?? [],
    now,
  )

  if (organizationAttempts.length >= JOURNAL_ANALYSIS_LIMITS.organizationStartsPerWindow) {
    return {
      allowed: false,
      reason: 'organization_limit',
      retryAt: getRetryAt(organizationAttempts[0] + JOURNAL_ANALYSIS_LIMITS.windowMs),
    }
  }

  state.organizationAttempts.set(input.organizationId, [...organizationAttempts, now])
  state.lastAnalysisAttempt.set(analysisKey, now)

  return { allowed: true }
}

export function resetJournalAnalysisLimitState(): void {
  state.organizationAttempts.clear()
  state.lastAnalysisAttempt.clear()
}
