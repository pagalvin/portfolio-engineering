import type {
  PredictionDashboardStatsQuery,
  PredictionListQuery,
  PredictionStatus,
  PredictionTypeFilter,
} from '@portfolio-engineering/shared-types/intuitionLedger'

export {
  deriveDirectionFromPrice,
  derivePercentChange,
  derivePredictedValuesFromPercent,
  derivePriceFromPercent,
  deriveTargetPriceDetails,
  suggestPredictionResult,
} from '@portfolio-engineering/domain'

const predictionStatuses: readonly PredictionStatus[] = [
  'active',
  'open',
  'due',
  'resolved',
  'void',
  'all',
]
const predictionTypes: readonly PredictionTypeFilter[] = [
  'direction',
  'percent_move',
  'target_price',
  'event_reaction',
  'freeform',
]
const listQueryKeys = new Set(['q', 'status', 'type', 'symbol', 'result', 'tag', 'amended'])
const dashboardQueryKeys = new Set(['period', 'amended'])
const ledgerPath = '/workspace/intuition-ledger'
const listPath = `${ledgerPath}/predictions`
const safeReturnPaths = new Set([ledgerPath, `${ledgerPath}/due`, listPath])

export type PredictionListUrlQuery = Omit<PredictionListQuery, 'asOfLocalDate'>
export type PredictionDashboardUrlQuery = Pick<PredictionDashboardStatsQuery, 'period' | 'amended'>

export interface ParsedPredictionListQuery {
  query: PredictionListUrlQuery
  error: string | null
}

export interface ParsedPredictionDashboardQuery {
  query: PredictionDashboardUrlQuery
  error: string | null
}

function invalidQuery(error: string): ParsedPredictionListQuery {
  return { query: {}, error }
}

function hasMalformedQueryEncoding(search: string): boolean {
  return search.replace(/^\?/, '').split('&').some((parameter) => {
    const separatorIndex = parameter.indexOf('=')
    const key = separatorIndex < 0 ? parameter : parameter.slice(0, separatorIndex)
    const value = separatorIndex < 0 ? '' : parameter.slice(separatorIndex + 1)
    try {
      decodeURIComponent(key.replace(/\+/g, ' '))
      decodeURIComponent(value.replace(/\+/g, ' '))
      return false
    } catch {
      return true
    }
  })
}

function getSingleQueryValues(
  search: string,
  allowedKeys: ReadonlySet<string>,
): { values: Record<string, string>; error: string | null } {
  if (hasMalformedQueryEncoding(search)) {
    return { values: {}, error: 'Query contains malformed percent-encoding.' }
  }

  const params = new URLSearchParams(search)
  const values: Record<string, string> = {}

  for (const key of new Set(params.keys())) {
    if (!allowedKeys.has(key)) {
      return { values: {}, error: `Unknown filter "${key}". Remove it and try again.` }
    }
    const entries = params.getAll(key)
    if (entries.length !== 1) {
      return { values: {}, error: `Filter "${key}" may only appear once.` }
    }
    const value = entries[0]
    if (!value) {
      return { values: {}, error: `Filter "${key}" cannot be empty.` }
    }
    values[key] = value
  }

  return { values, error: null }
}

export function parsePredictionListQuery(search: string): ParsedPredictionListQuery {
  const { values, error } = getSingleQueryValues(search, listQueryKeys)
  if (error) return invalidQuery(error)

  const statusValue = values.status
  const typeValue = values.type
  const resultValue = values.result
  const amendedValue = values.amended
  const status = statusValue === undefined
    ? undefined
    : predictionStatuses.find((candidate) => candidate === statusValue)
  const type = typeValue === undefined
    ? undefined
    : predictionTypes.find((candidate) => candidate === typeValue)
  const result = resultValue === 'correct' || resultValue === 'incorrect'
    ? resultValue
    : undefined
  const amended = amendedValue === 'only' || amendedValue === 'exclude'
    ? amendedValue
    : undefined

  if (statusValue !== undefined && status === undefined) {
    return invalidQuery('Status must be active, open, due, resolved, void, or all.')
  }
  if (typeValue !== undefined && type === undefined) {
    return invalidQuery(
      'Type must be direction, percent_move, target_price, event_reaction, or freeform.',
    )
  }
  if (resultValue !== undefined && result === undefined) {
    return invalidQuery('Result must be correct or incorrect.')
  }
  if (amendedValue !== undefined && amended === undefined) {
    return invalidQuery('Amended must be only or exclude.')
  }

  return {
    query: {
      status: status ?? 'active',
      ...(values.q === undefined ? {} : { q: values.q }),
      ...(type === undefined ? {} : { type }),
      ...(values.symbol === undefined ? {} : { symbol: values.symbol }),
      ...(result === undefined ? {} : { result }),
      ...(values.tag === undefined ? {} : { tag: values.tag }),
      ...(amended === undefined ? {} : { amended }),
    },
    error: null,
  }
}

export function serializePredictionListQuery(query: PredictionListUrlQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.status && query.status !== 'active') params.set('status', query.status)
  if (query.type) params.set('type', query.type)
  if (query.symbol) params.set('symbol', query.symbol)
  if (query.result) params.set('result', query.result)
  if (query.tag) params.set('tag', query.tag)
  if (query.amended) params.set('amended', query.amended)
  return params
}

export function parsePredictionDashboardQuery(search: string): ParsedPredictionDashboardQuery {
  const { values, error } = getSingleQueryValues(search, dashboardQueryKeys)
  if (error) return { query: { period: 'week', amended: 'include' }, error }
  if (values.period && values.period !== 'week' && values.period !== 'month') {
    return {
      query: { period: 'week', amended: 'include' },
      error: 'Period must be week or month.',
    }
  }
  if (values.amended && values.amended !== 'include' && values.amended !== 'exclude') {
    return {
      query: { period: 'week', amended: 'include' },
      error: 'Amended must be include or exclude.',
    }
  }

  return {
    query: {
      period: values.period === 'month' ? 'month' : 'week',
      amended: values.amended === 'exclude' ? 'exclude' : 'include',
    },
    error: null,
  }
}

export function serializePredictionDashboardQuery(
  query: PredictionDashboardUrlQuery,
): URLSearchParams {
  const params = new URLSearchParams()
  if (query.period !== 'week') params.set('period', query.period)
  if (query.amended && query.amended !== 'include') params.set('amended', query.amended)
  return params
}

export function isSafeIntuitionLedgerReturnTo(value: string | null): boolean {
  if (!value) return false

  try {
    const url = new URL(value, window.location.origin)
    if (
      url.origin !== window.location.origin ||
      !safeReturnPaths.has(url.pathname) ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return false
    }
    if (url.pathname === ledgerPath) {
      return parsePredictionDashboardQuery(url.search).error === null
    }
    if (url.pathname === listPath) {
      return parsePredictionListQuery(url.search).error === null
    }
    return url.search.length === 0
  } catch {
    return false
  }
}

export function getSafeIntuitionLedgerReturnTo(value: string | null): string {
  return value && isSafeIntuitionLedgerReturnTo(value) ? value : ledgerPath
}

export const LOCALE_DECIMAL_ERROR = 'Enter a number like 1234.56'

export interface ParsedLocaleDecimal {
  value: string | null
  error: string | null
}

export function parseLocaleDecimal(value: string, locale: string): ParsedLocaleDecimal {
  const input = value.trim()
  if (!input) return { value: null, error: LOCALE_DECIMAL_ERROR }

  const formatter = new Intl.NumberFormat(locale, { useGrouping: true })
  const sampleParts = formatter.formatToParts(1234567890.5)
  const decimalSeparator = sampleParts.find((part) => part.type === 'decimal')?.value
  const groupSeparator = sampleParts.find((part) => part.type === 'group')?.value
  if (!decimalSeparator) throw new RangeError(`Locale "${locale}" has no decimal separator.`)

  const digitFormatter = new Intl.NumberFormat(locale, { useGrouping: false })
  const localizedDigits = new Map<string, string>()
  for (let digit = 0; digit <= 9; digit += 1) {
    const localized = digitFormatter
      .formatToParts(digit)
      .filter((part) => part.type === 'integer')
      .map((part) => part.value)
      .join('')
    localizedDigits.set(localized, String(digit))
  }

  let normalizedInput = ''
  for (const character of input) {
    normalizedInput += localizedDigits.get(character) ?? character
  }

  const decimalIndex = normalizedInput.indexOf(decimalSeparator)
  if (
    decimalIndex !== normalizedInput.lastIndexOf(decimalSeparator) ||
    (decimalIndex >= 0 && normalizedInput.slice(decimalIndex + decimalSeparator.length).includes(decimalSeparator))
  ) {
    return { value: null, error: LOCALE_DECIMAL_ERROR }
  }

  const integerPart = decimalIndex < 0
    ? normalizedInput
    : normalizedInput.slice(0, decimalIndex)
  const fractionPart = decimalIndex < 0
    ? ''
    : normalizedInput.slice(decimalIndex + decimalSeparator.length)
  if (decimalIndex >= 0 && !fractionPart) return { value: null, error: LOCALE_DECIMAL_ERROR }
  if (groupSeparator && fractionPart.includes(groupSeparator)) {
    return { value: null, error: LOCALE_DECIMAL_ERROR }
  }

  const integerGroups = groupSeparator ? integerPart.split(groupSeparator) : [integerPart]
  const integerDigits = integerGroups.join('')
  const fractionIsDigits = /^\d+$/.test(fractionPart)
  if (
    (!integerDigits && !fractionPart) ||
    (integerDigits && !/^\d+$/.test(integerDigits)) ||
    (fractionPart && !fractionIsDigits) ||
    integerDigits.length > 100 ||
    fractionPart.length > 100
  ) {
    return { value: null, error: LOCALE_DECIMAL_ERROR }
  }

  if (integerGroups.length > 1) {
    if (integerGroups.some((group) => !/^\d+$/.test(group))) {
      return { value: null, error: LOCALE_DECIMAL_ERROR }
    }
    const expectedGrouping = formatter
      .formatToParts(BigInt(integerDigits))
      .filter((part) => part.type === 'integer' || part.type === 'group')
      .map((part) => {
        if (part.type !== 'integer') return part.value
        return [...part.value].map((character) => localizedDigits.get(character) ?? character).join('')
      })
      .join('')
    if (expectedGrouping !== integerPart) return { value: null, error: LOCALE_DECIMAL_ERROR }
  }

  return {
    value: `${integerDigits || '0'}${decimalIndex < 0 ? '' : `.${fractionPart}`}`,
    error: null,
  }
}