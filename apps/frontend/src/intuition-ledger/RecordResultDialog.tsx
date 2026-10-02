import { useContext, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { PredictionRecord, PredictionResult, RecordPredictionResultRequest } from '@portfolio-engineering/shared-types/intuitionLedger'
import { getResultRecordingBlockReason, hasDeadlinePassed, isResolutionDateInRange, suggestPredictionResult } from '@portfolio-engineering/domain'
import { ApiClientContext } from '../apiClientContext'
import type { ApiError } from '../apiClient'
import { getEnvironmentTimezone } from '../journalApi'
import { getTodayInTimezone, isValidDate } from '../journalDates'
import { parseLocaleDecimal } from '../intuitionLedgerApi'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Calendar } from '../components/ui/calendar'
import { formatPredictionDate } from './PredictionFormPage'

export function predictionCreatedDate(prediction: PredictionRecord): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: getEnvironmentTimezone(), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(prediction.createdAt))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function initialResolutionDate(prediction: PredictionRecord, today: string): string {
  return prediction.resolutionDate ?? (prediction.deadline < today && prediction.deadline >= predictionCreatedDate(prediction) ? prediction.deadline : today)
}

export function resultSuggestion(prediction: PredictionRecord, actualPrice: string): PredictionResult | null {
  return suggestPredictionResult({
    type: prediction.type,
    direction: prediction.direction,
    priceAtPrediction: prediction.priceAtPrediction === null ? null : Number(prediction.priceAtPrediction),
    predictedPrice: prediction.predictedPrice === null ? null : Number(prediction.predictedPrice),
    actualPrice: Number(actualPrice),
  })
}

export function validateResultDraft(input: {
  prediction: PredictionRecord
  result: PredictionResult | null
  resolutionDate: string
  actualPrice: string
  today: string
  locale: string
}): { errors: Record<string, string>; price: string | null } {
  const errors: Record<string, string> = {}
  let price: string | null = null
  if (input.actualPrice.trim()) {
    const parsed = parseLocaleDecimal(input.actualPrice, input.locale)
    if (parsed.error || parsed.value === null || !(Number(parsed.value) > 0) || !Number.isFinite(Number(parsed.value))) {
      errors.actualPrice = 'Enter a price greater than 0.'
    } else {
      price = parsed.value
    }
  }
  if (!input.result) errors.result = 'Choose Correct or Incorrect.'
  else if (getResultRecordingBlockReason({
    type: input.prediction.type, result: input.result,
    deadline: input.prediction.deadline, asOfLocalDate: input.today,
  })) errors.result = "The deadline hasn't passed yet."
  if (!isValidDate(input.resolutionDate) ||
    !isResolutionDateInRange({
      createdDate: predictionCreatedDate(input.prediction),
      resolutionDate: input.resolutionDate, asOfLocalDate: input.today,
    })) errors.resolutionDate = 'Choose a date between creation and today.'
  return { errors, price }
}

export function resolveResultChoice(explicitChoice: PredictionResult | null, suggestion: PredictionResult | null): PredictionResult | null {
  return explicitChoice ?? suggestion
}

export function buildResultPayload(input: {
  result: PredictionResult
  resolutionDate: string
  actualPrice: string | null
  notes: string
  asOfLocalDate: string
}): RecordPredictionResultRequest {
  return {
    result: input.result, resolutionDate: input.resolutionDate,
    actualPrice: input.actualPrice, outcomeNotes: input.notes, asOfLocalDate: input.asOfLocalDate,
  }
}

export function restoreResultDialogFocus(trigger: Pick<HTMLElement, 'isConnected' | 'focus'> | null): void {
  if (trigger?.isConnected) trigger.focus()
}

function useMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return mobile
}

function localCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function calendarDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface RecordResultDialogProps {
  prediction: PredictionRecord
  onClose: () => void
  onSaved: (prediction: PredictionRecord) => void
}

export function RecordResultDialog({ prediction, onClose, onSaved }: RecordResultDialogProps) {
  const client = useContext(ApiClientContext)
  const returnFocusRef = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const mobile = useMobile()
  const id = useId()
  const today = getTodayInTimezone(getEnvironmentTimezone())
  const createdDate = predictionCreatedDate(prediction)
  const early = !hasDeadlinePassed(prediction.deadline, today)
  const eligible = getResultRecordingBlockReason({
    type: prediction.type, result: 'CORRECT', deadline: prediction.deadline, asOfLocalDate: today,
  }) === null
  const [actualPrice, setActualPrice] = useState(prediction.actualPrice ?? '')
  const [choice, setChoice] = useState<PredictionResult | null>(prediction.result)
  const [explicitChoice, setExplicitChoice] = useState(prediction.result !== null)
  const [resolutionDate, setResolutionDate] = useState(initialResolutionDate(prediction, today))
  const [notes, setNotes] = useState(prediction.outcomeNotes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const parsedPrice = actualPrice.trim() ? parseLocaleDecimal(actualPrice, navigator.language) : null
  const validPrice = parsedPrice?.value && Number(parsedPrice.value) > 0 && Number.isFinite(Number(parsedPrice.value))
    ? parsedPrice.value : null
  const suggestion = validPrice ? resultSuggestion(prediction, validPrice) : null
  const selected = resolveResultChoice(explicitChoice ? choice : null, early && suggestion === 'INCORRECT' ? null : suggestion)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const draft = validateResultDraft({ prediction, result: selected, resolutionDate, actualPrice, today, locale: navigator.language })
    setErrors(draft.errors)
    if (Object.keys(draft.errors).length) {
      const first = Object.keys(draft.errors)[0]
      document.getElementById(`${id}-${first}`)?.focus()
      return
    }
    if (!client || !selected) {
      setFailure('The Intuition Ledger service is unavailable.')
      return
    }
    setSaving(true)
    setFailure(null)
    const payload = buildResultPayload({
      result: selected, resolutionDate, actualPrice: draft.price, notes,
      asOfLocalDate: getTodayInTimezone(getEnvironmentTimezone()),
    })
    try {
      const response = await client.recordPredictionResult(prediction.id, payload)
      onSaved(response.prediction)
    } catch (error) {
      const apiError = error as ApiError
      if (apiError.code === 'deadline_not_passed') setFailure("The deadline hasn't passed yet.")
      else if (apiError.code === 'resolution_date_out_of_range') setErrors({ resolutionDate: 'Choose a date between creation and today.' })
      else if (apiError.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(apiError.fieldErrors).map(([key, messages]) => [key, messages.join(' ')])))
      } else setFailure(apiError.message || 'Unable to save the result. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (!client || saving) return
    setSaving(true)
    setFailure(null)
    try {
      const response = await client.clearPredictionResult(prediction.id)
      onSaved(response.prediction)
    } catch (error) {
      const apiError = error as ApiError
      setFailure(apiError.message || 'Unable to clear the result. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const title = prediction.result ? 'Change result' : 'Record result'
  const description = prediction.result
    ? 'The change will be recorded in this prediction\'s result history.'
    : prediction.claimText
  const header = (mobile
    ? <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
    : <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>) as ReactNode
  const form = (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 overflow-y-auto text-sm">
      {!eligible && <p role="status">You can record a result after <time dateTime={prediction.deadline}>{formatPredictionDate(prediction.deadline)}</time>. The deadline hasn't passed yet.</p>}
      {prediction.type !== 'FREEFORM' && <div className="grid gap-1">
        <label htmlFor={`${id}-actualPrice`} className="font-medium">Actual price (optional)</label>
        <Input id={`${id}-actualPrice`} inputMode="decimal" value={actualPrice} onChange={(event) => setActualPrice(event.target.value)} aria-invalid={Boolean(errors.actualPrice)} aria-describedby={errors.actualPrice ? `${id}-actualPrice-error` : `${id}-price-help`} />
        <p id={`${id}-price-help`} className="text-text-muted">{prediction.type === 'TARGET_PRICE' ? (prediction.direction === 'FALLS' ? 'Lowest price reached (for a falling target)' : 'Highest price reached (for a rising target)') : 'Price when you judged the outcome'}</p>
        {errors.actualPrice && <p id={`${id}-actualPrice-error`} role="alert" className="text-state-error">{errors.actualPrice}</p>}
      </div>}
      {suggestion && <p role="status" className="text-text-muted">Suggested: {suggestion === 'CORRECT' ? '✓ Correct' : '✗ Incorrect'} based on the actual price. You can choose a different result.</p>}
      <fieldset className="grid gap-2"><legend className="font-medium">Result</legend>
        <RadioGroup id={`${id}-result`} value={selected ?? ''} onValueChange={(value) => { setChoice(value as PredictionResult); setExplicitChoice(true) }} aria-label="Result" aria-invalid={Boolean(errors.result)}>
          <div className="flex items-center gap-2"><RadioGroupItem id={`${id}-correct`} value="CORRECT" disabled={!eligible || saving} /><label htmlFor={`${id}-correct`}>✓ Correct{early && eligible ? (prediction.type === 'TARGET_PRICE' ? ' — Target reached' : ' — Goal reached') : ''}{suggestion === 'CORRECT' && !explicitChoice ? ' (Suggested)' : ''}</label></div>
          <div className="flex items-center gap-2"><RadioGroupItem id={`${id}-incorrect`} value="INCORRECT" disabled={early || saving} /><label htmlFor={`${id}-incorrect`}>✗ Incorrect{suggestion === 'INCORRECT' && !explicitChoice && !early ? ' (Suggested)' : ''}</label></div>
        </RadioGroup>
        {early && <p>The deadline hasn't passed yet. Incorrect is unavailable.</p>}
        {errors.result && <p role="alert" className="text-state-error">{errors.result}</p>}
      </fieldset>
      <div className="grid gap-1"><label className="font-medium" htmlFor={`${id}-resolutionDate`}>Resolution date</label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild><Button type="button" variant="outline" id={`${id}-resolutionDate`} aria-invalid={Boolean(errors.resolutionDate)} disabled={saving}>{resolutionDate ? formatPredictionDate(resolutionDate) : 'Choose a date'}</Button></PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" weekStartsOn={0} selected={resolutionDate ? localCalendarDate(resolutionDate) : undefined} defaultMonth={localCalendarDate(resolutionDate || today)} disabled={{ before: localCalendarDate(createdDate), after: localCalendarDate(today) }} onSelect={(date) => { if (date) { setResolutionDate(calendarDateValue(date)); setCalendarOpen(false) } }} /></PopoverContent>
        </Popover>
        <p className="text-text-muted">From {formatPredictionDate(createdDate)} through {formatPredictionDate(today)}.</p>
        {errors.resolutionDate && <p role="alert" className="text-state-error">{errors.resolutionDate}</p>}
      </div>
      <div className="grid gap-1"><label className="font-medium" htmlFor={`${id}-notes`}>Outcome notes (optional)</label><Textarea id={`${id}-notes`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /><p className="text-text-muted">Markdown formatting is supported.</p></div>
      {failure && <p role="alert" className="text-state-error">{failure}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {prediction.result && <Button type="button" variant="outline" disabled={saving} onClick={() => void clear()}>Clear result</Button>}
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving || !eligible}>{saving ? 'Saving…' : 'Save result'}</Button>
      </div>
    </form>
  )
  return mobile ? (
    <Sheet open onOpenChange={(open) => { if (!open && !saving) onClose() }}><SheetContent onCloseAutoFocus={(event) => { event.preventDefault(); restoreResultDialogFocus(returnFocusRef.current) }} side="bottom" className="max-h-[90vh] overflow-y-auto bg-surface-default text-text-primary"><div className="mx-auto grid max-w-lg gap-4">{header}{form}</div></SheetContent></Sheet>
  ) : (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}><DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); restoreResultDialogFocus(returnFocusRef.current) }} className="max-h-[90vh] overflow-y-auto">{header}{form}</DialogContent></Dialog>
  )
}
