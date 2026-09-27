import type {
  SecurityListQuery,
  SecurityType,
} from '@portfolio-engineering/shared-types/securityMaster'

export const securityTypes: readonly SecurityType[] = ['STOCK', 'ETF', 'INDEX', 'OTHER']
export const exchangeChoices = ['NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSX'] as const
const listKeys = new Set(['q', 'status', 'type', 'exchange'])

export interface ExchangeDropdownChoice {
  value: string
  label: string
  legacy?: true
}

export function getExchangeDropdownChoices(currentValue: string): ExchangeDropdownChoice[] {
  const choices: ExchangeDropdownChoice[] = [
    { value: '', label: 'No exchange' },
    ...exchangeChoices.map((value) => ({ value, label: value })),
    { value: 'OTHER', label: 'Other' },
  ]

  if (currentValue && !choices.some((choice) => choice.value === currentValue)) {
    choices.splice(1, 0, {
      value: currentValue,
      label: `Other (existing value: ${currentValue})`,
      legacy: true,
    })
  }

  return choices
}

export function getExchangeFilterChoices(currentValue: string): ExchangeDropdownChoice[] {
  const choices: ExchangeDropdownChoice[] = [
    { value: '', label: 'All exchanges' },
    ...exchangeChoices.map((value) => ({ value, label: value })),
    { value: 'OTHER', label: 'Other' },
  ]

  if (currentValue && !choices.some((choice) => choice.value === currentValue)) {
    choices.splice(1, 0, {
      value: currentValue,
      label: `Other (current filter: ${currentValue})`,
      legacy: true,
    })
  }

  return choices
}

export function getSecurityDetailPath(securityId: string, returnTo: string): string {
  return `/workspace/security-master/${encodeURIComponent(securityId)}?returnTo=${encodeURIComponent(returnTo)}`
}

export interface ParsedSecurityListQuery {
  query: SecurityListQuery
  error: string | null
}

export function parseSecurityListQuery(search: string): ParsedSecurityListQuery {
  const params = new URLSearchParams(search)
  const values: Record<string, string> = {}
  for (const key of new Set(params.keys())) {
    const entries = params.getAll(key)
    if (!listKeys.has(key)) {
      return { query: {}, error: `Unknown filter "${key}". Remove it and try again.` }
    }
    if (entries.length !== 1) {
      return { query: {}, error: `Filter "${key}" may only appear once.` }
    }
    const value = entries[0]
    if (!value) {
      return { query: {}, error: `Filter "${key}" cannot be empty.` }
    }
    values[key] = value
  }

  if (values.status && !['all', 'active', 'inactive'].includes(values.status)) {
    return { query: {}, error: 'Status must be all, active, or inactive.' }
  }
  if (values.type && !securityTypes.includes(values.type as SecurityType)) {
    return { query: {}, error: 'Type must be STOCK, ETF, INDEX, or OTHER.' }
  }

  return {
    query: {
      q: values.q,
      status: (values.status ?? 'active') as SecurityListQuery['status'],
      type: values.type as SecurityType | undefined,
      exchange: values.exchange,
    },
    error: null,
  }
}

export function isSafeSecurityReturnTo(value: string | null): boolean {
  if (!value) return false
  try {
    const url = new URL(value, window.location.origin)
    if (
      url.origin !== window.location.origin ||
      url.pathname !== '/workspace/security-master' ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return false
    }
    const parsed = parseSecurityListQuery(url.search)
    return parsed.error === null
  } catch {
    return false
  }
}

export function getSafeSecurityReturnTo(value: string | null): string {
  return isSafeSecurityReturnTo(value) ? value! : '/workspace/security-master'
}
