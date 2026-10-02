import { useEffect, useRef, useState } from 'react'
import type { SecurityRecord } from '@portfolio-engineering/shared-types/securityMaster'
import { normalizePredictionSymbol } from '@portfolio-engineering/domain'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../components/ui/command'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

export type PredictionSubjectMode = 'security' | 'other' | 'topic'

export interface PredictionSubjectValue {
  mode: PredictionSubjectMode
  securityId: string | null
  otherSymbol: string
  topic: string
}

export const emptyPredictionSubject: PredictionSubjectValue = {
  mode: 'security',
  securityId: null,
  otherSymbol: '',
  topic: '',
}

export function describeSecurityOption(security: SecurityRecord): string {
  return security.name ? `${security.symbol} — ${security.name}` : security.symbol
}

/** The active Security Master record whose normalized symbol matches the typed Other symbol, if any (FR 6). */
export function findOtherSymbolMatch(
  otherSymbol: string,
  securities: readonly SecurityRecord[],
): SecurityRecord | null {
  const normalized = otherSymbol.trim() ? normalizePredictionSymbol(otherSymbol) : ''
  if (!normalized) return null
  return securities.find((security) => normalizePredictionSymbol(security.symbol) === normalized) ?? null
}

export interface SubjectPickerProps {
  value: PredictionSubjectValue
  onChange: (value: PredictionSubjectValue) => void
  securities: readonly SecurityRecord[]
  /** Freeform is the only type that may have no security and no Other symbol. */
  allowTopic: boolean
  fetchOtherSymbolSuggestions: (query: string) => Promise<string[]>
  /** Label for a currently referenced security that is no longer active (FR 4, FR 7). */
  currentInactiveSecurityLabel?: string | null
  error?: string | null
  disabled?: boolean
}

export function SubjectPicker({
  value,
  onChange,
  securities,
  allowTopic,
  fetchOtherSymbolSuggestions,
  currentInactiveSecurityLabel,
  error,
  disabled,
}: SubjectPickerProps) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedSecurity = value.mode === 'security'
    ? securities.find((security) => security.id === value.securityId) ?? null
    : null
  const match = value.mode === 'other' ? findOtherSymbolMatch(value.otherSymbol, securities) : null

  useEffect(() => {
    if (value.mode !== 'other' || !value.otherSymbol.trim()) {
      setSuggestions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const query = value.otherSymbol.trim()
    debounceRef.current = setTimeout(() => {
      fetchOtherSymbolSuggestions(query)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mode, value.otherSymbol])

  const useMatch = () => {
    if (!match) return
    onChange({ ...value, mode: 'security', securityId: match.id })
  }

  const triggerLabel = value.mode === 'security' && selectedSecurity
    ? describeSecurityOption(selectedSecurity)
    : value.mode === 'other'
      ? 'Other symbol…'
      : value.mode === 'topic'
        ? 'No security (topic)'
        : currentInactiveSecurityLabel ?? 'Choose a security'

  return (
    <div className="grid gap-2">
      <span id="subject-label" className="text-sm font-medium text-text-strong">Security</span>
      {currentInactiveSecurityLabel && value.mode === 'security' && !selectedSecurity ? (
        <p className="text-sm text-text-muted">
          Current security: <span className="font-medium text-text-primary">{currentInactiveSecurityLabel}</span>
        </p>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-labelledby="subject-label"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'subject-error' : undefined}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            {triggerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-3rem)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search active securities…" aria-label="Search active securities" />
            <CommandList>
              <CommandEmpty>No matching securities.</CommandEmpty>
              <CommandGroup heading="Active securities">
                {securities.map((security) => (
                  <CommandItem
                    key={security.id}
                    value={describeSecurityOption(security)}
                    onSelect={() => {
                      onChange({ ...value, mode: 'security', securityId: security.id })
                      setOpen(false)
                    }}
                  >
                    {describeSecurityOption(security)}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Other">
                <CommandItem
                  value="other-symbol"
                  onSelect={() => {
                    onChange({ ...value, mode: 'other', securityId: null })
                    setOpen(false)
                  }}
                >
                  Other symbol…
                </CommandItem>
                {allowTopic ? (
                  <CommandItem
                    value="no-security-topic"
                    onSelect={() => {
                      onChange({ ...value, mode: 'topic', securityId: null })
                      setOpen(false)
                    }}
                  >
                    No security (topic)
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? <p id="subject-error" role="alert" className="text-sm text-state-error">{error}</p> : null}

      {value.mode === 'other' ? (
        <div className="grid gap-1">
          <label htmlFor="prediction-otherSymbol" className="text-sm font-medium text-text-strong">Other symbol</label>
          <Input
            id="prediction-otherSymbol"
            list="prediction-other-symbol-suggestions"
            value={value.otherSymbol}
            onChange={(event) => onChange({ ...value, otherSymbol: event.target.value })}
            placeholder="e.g. AAPL"
            disabled={disabled}
            aria-describedby={match ? 'prediction-other-symbol-match' : undefined}
          />
          <datalist id="prediction-other-symbol-suggestions">
            {suggestions.map((symbol) => <option key={symbol} value={symbol} />)}
          </datalist>
          {match ? (
            <p id="prediction-other-symbol-match" role="status" aria-live="polite" className="text-sm text-text-muted">
              {match.symbol} is in your Security Master.{' '}
              <button type="button" className="text-action-primary underline" onClick={useMatch}>Use it</button>
            </p>
          ) : null}
        </div>
      ) : null}

      {value.mode === 'topic' ? (
        <div className="grid gap-1">
          <label htmlFor="prediction-topic" className="text-sm font-medium text-text-strong">Topic</label>
          <Input
            id="prediction-topic"
            value={value.topic}
            onChange={(event) => onChange({ ...value, topic: event.target.value })}
            placeholder="e.g. Fed rate decision"
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  )
}
