import type { PredictionSymbolStats, PredictionTimeSeriesBucket, PredictionType } from '@portfolio-engineering/shared-types/intuitionLedger'

const typeLabels: Record<PredictionType, string> = {
  DIRECTION: 'Direction',
  PERCENT_MOVE: 'Percent move',
  TARGET_PRICE: 'Target price',
  EVENT_REACTION: 'Event reaction',
  FREEFORM: 'Freeform',
}

export function predictionTypeLabel(type: PredictionType): string {
  return typeLabels[type]
}

export function formatHitRate(value: number | null): string {
  return value === null ? 'Not available' : `${Math.round(value * 100)}%`
}

function dateAtUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dateAtUtc(date))
}

export function formatTimeSeriesLabel(bucket: PredictionTimeSeriesBucket, period: 'week' | 'month'): string {
  if (period === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dateAtUtc(bucket.bucketStart))
  }
  return `${formatShortDate(bucket.bucketStart)}–${formatShortDate(bucket.bucketEnd)}`
}

export function calibrationActualBarFill(lowSample: boolean): string {
  return lowSample ? 'url(#calibration-low-sample)' : 'var(--color-actualHitRate)'
}

export function topPredictionSymbols(symbols: readonly PredictionSymbolStats[]): PredictionSymbolStats[] {
  return [...symbols]
    .sort((left, right) => right.count - left.count || left.symbolNormalized.localeCompare(right.symbolNormalized))
    .slice(0, 10)
}