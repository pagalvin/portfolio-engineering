import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import type {
  CreatePredictionRequest,
  PredictionClaimField,
  PredictionDirection,
  PredictionRecord,
  PredictionType,
  UpdatePredictionRequest,
} from '@portfolio-engineering/shared-types/intuitionLedger'
import type { SecurityRecord } from '@portfolio-engineering/shared-types/securityMaster'
import {
  derivePercentChange,
  deriveDirectionFromPrice,
  derivePredictedValuesFromPercent,
  deriveTargetPriceDetails,
  getGracePeriodRemainingMs,
  isTradingDay,
  isWithinGracePeriod,
  resolveDeadlinePreset,
} from '@portfolio-engineering/domain'
import { ApiClientContext } from '../apiClientContext'
import type { ApiError } from '../apiClient'
import { getEnvironmentTimezone } from '../journalApi'
import { getTodayInTimezone } from '../journalDates'
import { getSafeIntuitionLedgerReturnTo, parseLocaleDecimal } from '../intuitionLedgerApi'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { Slider } from '../components/ui/slider'
import { Badge } from '../components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import {
  emptyPredictionSubject,
  SubjectPicker,
  type PredictionSubjectValue,
} from './SubjectPicker'

export type DeadlinePresetChoice = 'today' | 'week' | 'month' | 'custom'
export type PercentSource = 'percent' | 'price'

export const predictionTypeOptions: ReadonlyArray<{
  value: PredictionType
  label: string
  description: string
}> = [
  { value: 'DIRECTION', label: 'Direction', description: "Predict that a security's price will rise or fall by a deadline." },
  { value: 'PERCENT_MOVE', label: 'Percent move', description: 'Predict a price move of a certain size by a deadline.' },
  { value: 'TARGET_PRICE', label: 'Target price', description: 'Predict a security will reach a specific price by a deadline.' },
  { value: 'EVENT_REACTION', label: 'Event reaction', description: "Predict how a security will react to a specific event." },
  { value: 'FREEFORM', label: 'Freeform', description: 'Predict any outcome in your own words.' },
]

export const deadlinePresetOptions: ReadonlyArray<{ value: DeadlinePresetChoice; label: string }> = [
  { value: 'today', label: 'End of today' },
  { value: 'week', label: 'End of week' },
  { value: 'month', label: 'End of month' },
  { value: 'custom', label: 'Custom date' },
]

/** Human labels for claim fields, used to describe changed fields in the Amended confirmation. */
export const claimFieldLabels: Record<PredictionClaimField, string> = {
  securityId: 'Security',
  otherSymbol: 'Symbol',
  topic: 'Topic',
  symbolSnapshot: 'Symbol',
  symbolNormalizedSnapshot: 'Symbol',
  type: 'Prediction type',
  direction: 'Direction',
  claimText: 'Claim',
  eventLabel: 'Event',
  deadline: 'Deadline',
  confidence: 'Confidence',
  priceAtPrediction: 'Price at prediction',
  priceCapturedAt: 'Price captured at',
  predictedPrice: 'Predicted price',
  predictedPercent: 'Move size',
}

export function describeChangedClaimFields(fields: readonly PredictionClaimField[]): string {
  const labels = [...new Set(fields.map((field) => claimFieldLabels[field] ?? field))]
  return labels.join(', ')
}

/** Formats grace-window remaining time as "m:ss" (e.g. "4:12"). */
export function formatGraceCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Localized medium date with weekday, timezone-independent for calendar-date strings (e.g. "Fri, Oct 2"). */
export function formatPredictionDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`))
}

export interface DeadlineResolution {
  deadline: string | null
  hint: string | null
}

/** Resolves the selected deadline preset (or custom date) to a calendar date and an optional non-trading-day hint. */
export function resolveDeadlineChoice(
  preset: DeadlinePresetChoice,
  customDate: string,
  asOfLocalDate: string,
): DeadlineResolution {
  if (preset === 'custom') {
    if (!customDate) return { deadline: null, hint: null }
    return {
      deadline: customDate,
      hint: isTradingDay(customDate) ? null : `${formatPredictionDate(customDate)} isn't a trading day.`,
    }
  }
  return { deadline: resolveDeadlinePreset(preset, asOfLocalDate), hint: null }
}

function formatDecimalDisplay(value: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
}

function formatPercentDisplay(value: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function describeMove(direction: PredictionDirection, percent: number): string {
  return `${direction === 'RISES' ? 'rises' : 'falls'} ${formatPercentDisplay(percent)}%`
}

export interface PricePreviewInput {
  type: PredictionType
  direction: PredictionDirection | null
  priceAtPrediction: number | null
  percentSource: PercentSource
  percentValue: number | null
  predictedPriceValue: number | null
  targetPriceValue: number | null
}

export interface PricePreviewResult {
  predictedPrice: number
  predictedPercent: number
  direction: PredictionDirection
  text: string
}

/** Computes the predicted price/percent preview shown while typing, mirroring the server's derivation rules. */
export function computePricePreview(input: PricePreviewInput): PricePreviewResult | null {
  const { type, priceAtPrediction } = input
  if (priceAtPrediction === null || !(priceAtPrediction > 0)) return null

  try {
    if (type === 'TARGET_PRICE') {
      if (input.targetPriceValue === null) return null
      const details = deriveTargetPriceDetails(priceAtPrediction, input.targetPriceValue)
      return {
        ...details,
        text: `Predicted price ${formatDecimalDisplay(details.predictedPrice)} (${describeMove(details.direction, details.predictedPercent)}).`,
      }
    }

    const magnitudeApplies = type === 'PERCENT_MOVE' || type === 'EVENT_REACTION'
    if (!magnitudeApplies) return null

    if (input.percentSource === 'percent') {
      if (input.percentValue === null || !input.direction) return null
      const derived = derivePredictedValuesFromPercent(priceAtPrediction, input.percentValue, input.direction)
      return {
        ...derived,
        direction: input.direction,
        text: `Predicted price ${formatDecimalDisplay(derived.predictedPrice)} (${describeMove(input.direction, derived.predictedPercent)}).`,
      }
    }

    if (input.predictedPriceValue === null) return null
    const derivedDirection = deriveDirectionFromPrice(priceAtPrediction, input.predictedPriceValue)
    const percent = Math.abs(derivePercentChange(priceAtPrediction, input.predictedPriceValue))
    return {
      predictedPrice: input.predictedPriceValue,
      predictedPercent: percent,
      direction: derivedDirection,
      text: `Predicted price ${formatDecimalDisplay(input.predictedPriceValue)} (${describeMove(derivedDirection, percent)}).`,
    }
  } catch {
    return null
  }
}

/** Generates the readable claim summary stored in claimText for non-Freeform types (FR 8; the Claim list cell). */
export function buildClaimSummary(input: {
  type: PredictionType
  subjectLabel: string
  direction: PredictionDirection | null
  deadline: string | null
  eventLabel: string
  preview: PricePreviewResult | null
  claimText: string
}): string {
  const { type, subjectLabel, deadline, eventLabel, preview, claimText } = input
  const byDeadline = deadline ? ` by ${formatPredictionDate(deadline)}` : ''

  if (type === 'FREEFORM') return claimText.trim()
  if (type === 'TARGET_PRICE') {
    return preview
      ? `${subjectLabel} will reach ${formatDecimalDisplay(preview.predictedPrice)}${byDeadline}`
      : `${subjectLabel} will reach a target price${byDeadline}`
  }
  if (type === 'EVENT_REACTION') {
    const direction = preview?.direction ?? input.direction
    const directionText = direction ? (direction === 'RISES' ? 'rises' : 'falls') : 'reacts'
    return `${subjectLabel} ${directionText} on ${eventLabel || 'the event'}${byDeadline}`
  }
  if (type === 'PERCENT_MOVE') {
    return preview
      ? `${subjectLabel} will ${describeMove(preview.direction, preview.predictedPercent)}${byDeadline}`
      : `${subjectLabel} will ${input.direction === 'FALLS' ? 'fall' : 'rise'}${byDeadline}`
  }
  // DIRECTION
  return `${subjectLabel} will ${input.direction === 'FALLS' ? 'fall' : 'rise'}${byDeadline}`
}

export type PredictionFormFieldErrors = Record<string, string>

export interface ValidateClaimInput {
  type: PredictionType
  subject: PredictionSubjectValue
  direction: PredictionDirection | null
  claimText: string
  eventLabel: string
  deadline: string | null
  confidence: number
  priceAtPrediction: number | null
  percentSource: PercentSource
  percentValue: number | null
  predictedPriceValue: number | null
  targetPriceValue: number | null
}

/** Client-side pre-checks for immediate feedback; the server remains authoritative (AC 6, AC 8). */
export function validateClaimForSubmit(input: ValidateClaimInput): PredictionFormFieldErrors {
  const errors: PredictionFormFieldErrors = {}
  const measurable = input.type !== 'FREEFORM'
  const hasSecurity = input.subject.mode === 'security' && Boolean(input.subject.securityId)
  const hasOtherSymbol = input.subject.mode === 'other' && Boolean(input.subject.otherSymbol.trim())
  const hasTopic = input.subject.mode === 'topic' && Boolean(input.subject.topic.trim())
  const hasSubject = hasSecurity || hasOtherSymbol || hasTopic

  if (!hasSubject && input.type !== 'FREEFORM') {
    errors.securityId = 'Choose a security, or pick Other symbol.'
  }
  if (input.type === 'EVENT_REACTION' && input.subject.mode === 'topic') {
    errors.securityId = 'Choose a security, or pick Other symbol.'
  }
  if (!input.deadline) {
    errors.deadline = 'Choose a deadline on or after today.'
  }
  if (!Number.isInteger(input.confidence) || input.confidence < 50 || input.confidence > 100) {
    errors.confidence = 'Confidence must be between 50% and 100%.'
  }
  if (measurable && !(input.priceAtPrediction !== null && input.priceAtPrediction > 0)) {
    errors.priceAtPrediction = 'Enter a price greater than 0.'
  }
  if (input.type === 'PERCENT_MOVE') {
    if (input.percentSource === 'percent' && !(input.percentValue !== null && input.percentValue > 0)) {
      errors.predictedPercent = 'Enter a move size greater than 0.'
    }
    if (input.percentSource === 'price' && input.predictedPriceValue === null) {
      errors.predictedPrice = 'Enter a predicted price.'
    }
  }
  if (input.type === 'TARGET_PRICE') {
    if (input.targetPriceValue === null) {
      errors.predictedPrice = 'Enter a target price.'
    } else if (input.priceAtPrediction !== null && input.targetPriceValue === input.priceAtPrediction) {
      errors.predictedPrice = 'The target must be different from the price at prediction.'
    }
  }
  if (
    (input.type === 'DIRECTION' || input.type === 'PERCENT_MOVE' || input.type === 'EVENT_REACTION') &&
    !input.direction
  ) {
    errors.direction = 'Choose Rises or Falls.'
  }
  if (
    (input.type === 'PERCENT_MOVE' || input.type === 'EVENT_REACTION') &&
    input.percentSource === 'price' &&
    input.direction &&
    input.priceAtPrediction &&
    input.predictedPriceValue &&
    input.priceAtPrediction !== input.predictedPriceValue
  ) {
    try {
      const derivedDirection = deriveDirectionFromPrice(input.priceAtPrediction, input.predictedPriceValue)
      if (derivedDirection !== input.direction) {
        errors.predictedPrice = 'A contradictory direction cannot be entered.'
      }
    } catch {
      // Handled by the price-difference check below.
    }
  }
  if (
    (input.type === 'PERCENT_MOVE' || input.type === 'EVENT_REACTION') &&
    input.percentSource === 'price' &&
    input.predictedPriceValue !== null &&
    input.priceAtPrediction !== null &&
    input.predictedPriceValue === input.priceAtPrediction
  ) {
    errors.predictedPrice = 'The predicted price must differ from the price at prediction.'
  }
  if (input.type === 'FREEFORM' && !input.claimText.trim()) {
    errors.claimText = 'Enter your prediction.'
  }
  if (input.type === 'EVENT_REACTION' && !input.eventLabel.trim()) {
    errors.eventLabel = 'Enter an event label.'
  }

  return errors
}

const fieldFocusOrder: readonly string[] = [
  'securityId',
  'claimText',
  'eventLabel',
  'direction',
  'predictedPercent',
  'predictedPrice',
  'priceAtPrediction',
  'deadline',
  'confidence',
]

export function getFirstInvalidFieldId(errors: PredictionFormFieldErrors): string | null {
  const field = fieldFocusOrder.find((candidate) => errors[candidate]) ?? Object.keys(errors)[0]
  return field ? `prediction-${field}` : null
}

/** Maps a thrown ApiError to field-level messages, matching known Intuition Ledger error shapes. */
export function mapPredictionFieldErrors(error: unknown): PredictionFormFieldErrors {
  const apiError = error as Partial<ApiError> & { fieldErrors?: Record<string, string[]> }
  const errors: PredictionFormFieldErrors = {}
  if (apiError.fieldErrors) {
    for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
      if (messages?.[0]) errors[field] = messages[0]
    }
  }
  if (apiError.code === 'invalid_security_reference' && Object.keys(errors).length === 0) {
    errors.securityId = typeof apiError.message === 'string' ? apiError.message : 'Choose an active security in this organization.'
  }
  return errors
}

function errorMessage(error: unknown, fallback: string): string {
  const apiError = error as Partial<ApiError>
  return typeof apiError.message === 'string' ? apiError.message : fallback
}

function navigatorLocale(): string {
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

interface AmendDialogState {
  changedFields: PredictionClaimField[]
  payload: UpdatePredictionRequest
}

export function PredictionFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const apiClient = useContext(ApiClientContext)
  const navigate = useNavigate()
  const { predictionId } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = getSafeIntuitionLedgerReturnTo(searchParams.get('returnTo'))
  const today = getTodayInTimezone(getEnvironmentTimezone())

  const [securities, setSecurities] = useState<SecurityRecord[]>([])
  const [prediction, setPrediction] = useState<PredictionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [type, setType] = useState<PredictionType>('PERCENT_MOVE')
  const [subject, setSubject] = useState<PredictionSubjectValue>(emptyPredictionSubject)
  const [direction, setDirection] = useState<PredictionDirection | null>('RISES')
  const [claimText, setClaimText] = useState('')
  const [eventLabel, setEventLabel] = useState('')
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePresetChoice>('week')
  const [customDate, setCustomDate] = useState('')
  const [confidence, setConfidence] = useState(60)
  const [priceAtPredictionInput, setPriceAtPredictionInput] = useState('')
  const [priceCapturedAt, setPriceCapturedAt] = useState(() => new Date().toISOString())
  const [editingCapturedAt, setEditingCapturedAt] = useState(false)
  const [percentSource, setPercentSource] = useState<PercentSource>('percent')
  const [moveInput, setMoveInput] = useState('')
  const [targetPriceInput, setTargetPriceInput] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])

  const [fieldErrors, setFieldErrors] = useState<PredictionFormFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [amendDialog, setAmendDialog] = useState<AmendDialogState | null>(null)

  const [now, setNow] = useState(() => Date.now())
  const [hasAnnouncedGraceEnd, setHasAnnouncedGraceEnd] = useState(false)
  const wasWithinGraceRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    if (!apiClient) {
      setLoadError('The Intuition Ledger service is unavailable.')
      setLoading(false)
      return () => controller.abort()
    }
    setLoading(true)
    setLoadError(null)
    const load = async () => {
      try {
        const securitiesResponse = await apiClient.listSecurities({ status: 'active' }, controller.signal)
        if (controller.signal.aborted) return
        setSecurities(securitiesResponse.securities)

        if (mode === 'edit' && predictionId) {
          const detail = await apiClient.getPrediction(predictionId, controller.signal)
          if (controller.signal.aborted) return
          applyPredictionToForm(detail.prediction)
          setPrediction(detail.prediction)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(errorMessage(error, 'Unable to load the prediction form.'))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiClient, mode, predictionId])

  function applyPredictionToForm(record: PredictionRecord) {
    setType(record.type)
    setSubject({
      mode: record.securityId ? 'security' : record.otherSymbol ? 'other' : 'topic',
      securityId: record.securityId,
      otherSymbol: record.otherSymbol ?? '',
      topic: record.topic ?? '',
    })
    setDirection(record.direction)
    setClaimText(record.claimText)
    setEventLabel(record.eventLabel ?? '')
    setDeadlinePreset('custom')
    setCustomDate(record.deadline.slice(0, 10))
    setConfidence(record.confidence)
    setPriceAtPredictionInput(record.priceAtPrediction ?? '')
    setPriceCapturedAt(record.priceCapturedAt ?? new Date().toISOString())
    setPercentSource(record.type === 'TARGET_PRICE' ? 'percent' : record.predictedPrice && !record.predictedPercent ? 'price' : 'percent')
    setMoveInput(record.predictedPercent ?? '')
    setTargetPriceInput(record.type === 'TARGET_PRICE' ? record.predictedPrice ?? '' : '')
    setReasoning(record.reasoning ?? '')
    setTags(record.tags ?? [])
  }

  // Grace-window countdown ticker (edit mode only).
  useEffect(() => {
    if (mode !== 'edit' || !prediction) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [mode, prediction])

  const withinGrace = mode === 'edit' && prediction
    ? isWithinGracePeriod(prediction.createdAt, now)
    : false
  const graceRemainingMs = mode === 'edit' && prediction
    ? getGracePeriodRemainingMs(prediction.createdAt, now)
    : 0

  useEffect(() => {
    if (withinGrace) {
      wasWithinGraceRef.current = true
    } else if (wasWithinGraceRef.current && !hasAnnouncedGraceEnd) {
      setHasAnnouncedGraceEnd(true)
    }
  }, [withinGrace, hasAnnouncedGraceEnd])

  const currentInactiveSecurityLabel = useMemo(() => {
    if (!prediction?.securityId) return null
    if (securities.some((security) => security.id === prediction.securityId)) return null
    return `${prediction.symbolSnapshot ?? 'This security'} (inactive)`
  }, [prediction, securities])

  const priceAtPredictionNormalized = priceAtPredictionInput.trim()
    ? parseLocaleDecimal(priceAtPredictionInput, navigatorLocale()).value
    : null
  const parsedPriceAtPrediction = priceAtPredictionInput.trim()
    ? Number(parseLocaleDecimal(priceAtPredictionInput, navigatorLocale()).value ?? NaN)
    : null
  const parsedMoveValue = moveInput.trim()
    ? Number(parseLocaleDecimal(moveInput, navigatorLocale()).value ?? NaN)
    : null
  const parsedTargetValue = targetPriceInput.trim()
    ? Number(parseLocaleDecimal(targetPriceInput, navigatorLocale()).value ?? NaN)
    : null

  const magnitudeApplies = type === 'PERCENT_MOVE' || type === 'EVENT_REACTION'
  const priceIsSource = magnitudeApplies && percentSource === 'price'

  const effectiveDirection: PredictionDirection | null = (() => {
    if (type === 'TARGET_PRICE') return null
    if (priceIsSource && parsedPriceAtPrediction && parsedMoveValue && Number.isFinite(parsedPriceAtPrediction) && Number.isFinite(parsedMoveValue) && parsedPriceAtPrediction > 0 && parsedMoveValue > 0 && parsedPriceAtPrediction !== parsedMoveValue) {
      try {
        return deriveDirectionFromPrice(parsedPriceAtPrediction, parsedMoveValue)
      } catch {
        return direction
      }
    }
    return direction
  })()

  const deadlineResolution = resolveDeadlineChoice(deadlinePreset, customDate, today)

  const preview = computePricePreview({
    type,
    direction: effectiveDirection,
    priceAtPrediction: Number.isFinite(parsedPriceAtPrediction) ? parsedPriceAtPrediction : null,
    percentSource,
    percentValue: Number.isFinite(parsedMoveValue) ? parsedMoveValue : null,
    predictedPriceValue: percentSource === 'price' && Number.isFinite(parsedMoveValue) ? parsedMoveValue : null,
    targetPriceValue: Number.isFinite(parsedTargetValue) ? parsedTargetValue : null,
  })

  const subjectLabel = subject.mode === 'security'
    ? securities.find((security) => security.id === subject.securityId)?.symbol
      ?? currentInactiveSecurityLabel
      ?? 'This security'
    : subject.mode === 'other'
      ? subject.otherSymbol.trim().toUpperCase() || 'This symbol'
      : subject.topic.trim() || 'This topic'

  const fetchOtherSymbolSuggestions = async (query: string): Promise<string[]> => {
    if (!apiClient) return []
    const response = await apiClient.listPredictionOtherSymbolSuggestions({ q: query, limit: 8 })
    return response.symbols
  }

  useEffect(() => {
    if (!tagDraft.trim() || !apiClient) {
      setTagSuggestions([])
      return
    }
    const timer = setTimeout(() => {
      apiClient.listPredictionTagSuggestions({ q: tagDraft.trim(), limit: 8 })
        .then((response) => setTagSuggestions(response.tags))
        .catch(() => setTagSuggestions([]))
    }, 200)
    return () => clearTimeout(timer)
  }, [tagDraft, apiClient])

  function addTag(rawTag: string) {
    const tag = rawTag.trim()
    if (!tag || tags.includes(tag)) return
    setTags((current) => [...current, tag])
    setTagDraft('')
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((existing) => existing !== tag))
  }

  function focusField(id: string | null) {
    if (!id) return
    document.getElementById(id)?.focus()
  }

  function buildFields(): CreatePredictionRequest {
    const claimSummary = buildClaimSummary({
      type,
      subjectLabel,
      direction: effectiveDirection,
      deadline: deadlineResolution.deadline,
      eventLabel,
      preview,
      claimText,
    })

    const base: CreatePredictionRequest = {
      type,
      claimText: claimSummary,
      deadline: deadlineResolution.deadline ?? '',
      confidence,
      reasoning: reasoning.trim() ? reasoning : null,
      tags,
    }

    if (subject.mode === 'security' && subject.securityId) base.securityId = subject.securityId
    if (subject.mode === 'other' && subject.otherSymbol.trim()) base.otherSymbol = subject.otherSymbol.trim()
    if (subject.mode === 'topic' && subject.topic.trim()) base.topic = subject.topic.trim()

    if (type === 'EVENT_REACTION') base.eventLabel = eventLabel.trim() || null

    if (type !== 'FREEFORM') {
      base.priceAtPrediction = priceAtPredictionNormalized
      base.priceCapturedAt = priceCapturedAt
    }

    if (type === 'TARGET_PRICE') {
      base.predictedPrice = parseLocaleDecimal(targetPriceInput, navigatorLocale()).value
    } else if (type === 'DIRECTION') {
      base.direction = direction
    } else if (magnitudeApplies) {
      base.direction = effectiveDirection ?? direction
      if (percentSource === 'percent') {
        base.predictedPercent = parseLocaleDecimal(moveInput, navigatorLocale()).value
      } else if (moveInput.trim()) {
        base.predictedPrice = parseLocaleDecimal(moveInput, navigatorLocale()).value
      }
    }

    return base
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setFieldErrors({})

    const validationErrors = validateClaimForSubmit({
      type,
      subject,
      direction: effectiveDirection,
      claimText,
      eventLabel,
      deadline: deadlineResolution.deadline,
      confidence,
      priceAtPrediction: Number.isFinite(parsedPriceAtPrediction) ? parsedPriceAtPrediction : null,
      percentSource,
      percentValue: Number.isFinite(parsedMoveValue) ? parsedMoveValue : null,
      predictedPriceValue: percentSource === 'price' && Number.isFinite(parsedMoveValue) ? parsedMoveValue : null,
      targetPriceValue: Number.isFinite(parsedTargetValue) ? parsedTargetValue : null,
    })
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      focusField(getFirstInvalidFieldId(validationErrors))
      return
    }
    if (!apiClient) {
      setFormError('The Intuition Ledger service is unavailable.')
      return
    }

    setSaving(true)
    try {
      const fields = buildFields()
      if (mode === 'create') {
        const response = await apiClient.createPrediction(fields)
        navigate(`/workspace/intuition-ledger/predictions/${response.prediction.id}`, { replace: true })
        return
      }

      if (!predictionId) return
      await saveUpdate(predictionId, fields, false)
    } catch (error) {
      handleSaveError(error)
    } finally {
      setSaving(false)
    }
  }

  async function saveUpdate(id: string, fields: UpdatePredictionRequest, confirmAmend: boolean) {
    if (!apiClient) return
    const payload: UpdatePredictionRequest = confirmAmend ? { ...fields, confirmAmend: true } : fields
    try {
      const response = await apiClient.updatePrediction(id, payload)
      navigate(`/workspace/intuition-ledger/predictions/${response.prediction.id}`, { replace: true })
    } catch (error) {
      const apiError = error as ApiError & { changedFields?: PredictionClaimField[] }
      if (apiError.code === 'amend_confirmation_required') {
        setAmendDialog({ changedFields: apiError.changedFields ?? [], payload: fields })
        return
      }
      throw error
    }
  }

  function handleSaveError(error: unknown) {
    const errors = mapPredictionFieldErrors(error)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      focusField(getFirstInvalidFieldId(errors))
    } else {
      setFormError(errorMessage(error, 'Unable to save this prediction.'))
    }
  }

  async function confirmAmendSave() {
    if (!amendDialog || !predictionId) return
    setSaving(true)
    try {
      await saveUpdate(predictionId, amendDialog.payload, true)
      setAmendDialog(null)
    } catch (error) {
      setAmendDialog(null)
      handleSaveError(error)
    } finally {
      setSaving(false)
    }
  }

  const cancelPath = returnTo

  if (mode === 'edit' && loading) {
    return <p role="status" className="text-sm text-text-muted">Loading prediction for editing…</p>
  }
  if (mode === 'edit' && (loadError || !prediction)) {
    return (
      <div role="alert" className="rounded-md border border-border-subtle bg-surface-muted p-4 text-sm">
        <p>{loadError ?? 'Prediction not found.'}</p>
      </div>
    )
  }

  return (
    <form className="grid max-w-3xl gap-6" onSubmit={handleSubmit} noValidate>
      {formError ? <div role="alert" className="rounded-md border border-state-error/50 bg-surface-default p-3 text-sm text-state-error">{formError}</div> : null}

      {mode === 'edit' && withinGrace ? (
        <div role="timer" aria-live="off" className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm">
          Claim edits won&apos;t mark this Amended for {formatGraceCountdown(graceRemainingMs)}.
        </div>
      ) : null}
      {mode === 'edit' && !withinGrace ? (
        <div className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm">
          Changing the claim (type, security, direction, prices, deadline, confidence) will mark this prediction Amended. Reasoning and tags can be changed without marking it Amended; reasoning edits are kept in its history.
        </div>
      ) : null}
      {hasAnnouncedGraceEnd ? (
        <p role="status" aria-live="polite" className="sr-only">
          The grace period has ended. Claim changes will now mark this prediction Amended.
        </p>
      ) : null}

      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="text-sm font-semibold text-text-strong">Prediction type</legend>
        <RadioGroup
          value={type}
          onValueChange={(value) => setType(value as PredictionType)}
          className="flex flex-wrap gap-2"
          aria-label="Prediction type"
        >
          {predictionTypeOptions.map((option) => (
            <div key={option.value} className="flex items-center">
              <RadioGroupItem value={option.value} id={`prediction-type-${option.value}`} className="peer sr-only" />
              <label
                htmlFor={`prediction-type-${option.value}`}
                className="cursor-pointer rounded-md border border-border-subtle px-3 py-1.5 text-sm peer-data-[state=checked]:border-action-primary peer-data-[state=checked]:bg-action-primary peer-data-[state=checked]:text-white peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-action-primary"
              >
                {option.label}
              </label>
            </div>
          ))}
        </RadioGroup>
        <p className="text-sm text-text-muted">
          {predictionTypeOptions.find((option) => option.value === type)?.description}
        </p>
      </fieldset>

      <SubjectPicker
        value={subject}
        onChange={setSubject}
        securities={securities}
        allowTopic={type === 'FREEFORM'}
        fetchOtherSymbolSuggestions={fetchOtherSymbolSuggestions}
        currentInactiveSecurityLabel={currentInactiveSecurityLabel}
        error={fieldErrors.securityId}
      />

      {type === 'FREEFORM' ? (
        <div className="grid gap-1">
          <label htmlFor="prediction-claimText" className="text-sm font-medium text-text-strong">I predict…</label>
          <Textarea
            id="prediction-claimText"
            value={claimText}
            onChange={(event) => setClaimText(event.target.value)}
            rows={3}
            aria-invalid={Boolean(fieldErrors.claimText)}
            aria-describedby={fieldErrors.claimText ? 'prediction-claimText-error' : undefined}
          />
          {fieldErrors.claimText ? <p id="prediction-claimText-error" role="alert" className="text-sm text-state-error">{fieldErrors.claimText}</p> : null}
        </div>
      ) : null}

      {type === 'EVENT_REACTION' ? (
        <div className="grid gap-1">
          <label htmlFor="prediction-eventLabel" className="text-sm font-medium text-text-strong">Event</label>
          <Input
            id="prediction-eventLabel"
            value={eventLabel}
            onChange={(event) => setEventLabel(event.target.value)}
            placeholder="e.g. earnings"
            aria-invalid={Boolean(fieldErrors.eventLabel)}
            aria-describedby={fieldErrors.eventLabel ? 'prediction-eventLabel-error' : undefined}
          />
          {fieldErrors.eventLabel ? <p id="prediction-eventLabel-error" role="alert" className="text-sm text-state-error">{fieldErrors.eventLabel}</p> : null}
        </div>
      ) : null}

      {(type === 'DIRECTION' || type === 'PERCENT_MOVE' || type === 'EVENT_REACTION') ? (
        <fieldset className="grid gap-2 border-0 p-0">
          <legend className="text-sm font-medium text-text-strong">Direction</legend>
          {priceIsSource ? (
            <p aria-live="polite" className="text-sm">
              {effectiveDirection ? (effectiveDirection === 'RISES' ? '▲ Rises' : '▼ Falls') : 'Derived from the predicted price.'}
            </p>
          ) : (
            <RadioGroup
              value={direction ?? ''}
              onValueChange={(value) => setDirection(value as PredictionDirection)}
              className="flex gap-4"
              aria-label="Direction"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="RISES" id="prediction-direction-rises" />
                <label htmlFor="prediction-direction-rises">▲ Rises</label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="FALLS" id="prediction-direction-falls" />
                <label htmlFor="prediction-direction-falls">▼ Falls</label>
              </div>
            </RadioGroup>
          )}
          {fieldErrors.direction ? <p role="alert" className="text-sm text-state-error">{fieldErrors.direction}</p> : null}
        </fieldset>
      ) : null}

      {type === 'PERCENT_MOVE' || (type === 'EVENT_REACTION') ? (
        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor="prediction-move" className="text-sm font-medium text-text-strong">
              {percentSource === 'percent' ? 'Move size (%)' : 'Predicted price'}
            </label>
            <button
              type="button"
              className="text-sm text-action-primary underline"
              onClick={() => {
                setPercentSource((current) => (current === 'percent' ? 'price' : 'percent'))
                setMoveInput('')
              }}
            >
              {percentSource === 'percent' ? 'Enter predicted price instead' : 'Enter move size instead'}
            </button>
          </div>
          <Input
            id="prediction-move"
            inputMode="decimal"
            value={moveInput}
            onChange={(event) => setMoveInput(event.target.value)}
            aria-invalid={Boolean(fieldErrors.predictedPercent || fieldErrors.predictedPrice)}
            aria-describedby={fieldErrors.predictedPercent || fieldErrors.predictedPrice ? 'prediction-move-error' : undefined}
          />
          {fieldErrors.predictedPercent || fieldErrors.predictedPrice ? (
            <p id="prediction-move-error" role="alert" className="text-sm text-state-error">
              {fieldErrors.predictedPercent ?? fieldErrors.predictedPrice}
            </p>
          ) : null}
        </div>
      ) : null}

      {type === 'TARGET_PRICE' ? (
        <div className="grid gap-1">
          <label htmlFor="prediction-target" className="text-sm font-medium text-text-strong">Target price</label>
          <Input
            id="prediction-target"
            inputMode="decimal"
            value={targetPriceInput}
            onChange={(event) => setTargetPriceInput(event.target.value)}
            aria-invalid={Boolean(fieldErrors.predictedPrice)}
            aria-describedby={fieldErrors.predictedPrice ? 'prediction-target-error' : undefined}
          />
          {fieldErrors.predictedPrice ? <p id="prediction-target-error" role="alert" className="text-sm text-state-error">{fieldErrors.predictedPrice}</p> : null}
          {preview ? <p className="text-sm text-text-muted">Direction: {preview.direction === 'RISES' ? '▲ Rises' : '▼ Falls'}</p> : null}
        </div>
      ) : null}

      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="text-sm font-medium text-text-strong" id="prediction-deadline-legend">Deadline</legend>
        <RadioGroup
          value={deadlinePreset}
          onValueChange={(value) => setDeadlinePreset(value as DeadlinePresetChoice)}
          className="flex flex-wrap gap-2"
          aria-labelledby="prediction-deadline-legend"
        >
          {deadlinePresetOptions.map((option) => (
            <div key={option.value} className="flex items-center">
              <RadioGroupItem value={option.value} id={`prediction-deadline-${option.value}`} className="peer sr-only" />
              <label
                htmlFor={`prediction-deadline-${option.value}`}
                className="cursor-pointer rounded-md border border-border-subtle px-3 py-1.5 text-sm peer-data-[state=checked]:border-action-primary peer-data-[state=checked]:bg-action-primary peer-data-[state=checked]:text-white"
              >
                {option.label}
              </label>
            </div>
          ))}
        </RadioGroup>
        {deadlinePreset === 'custom' ? (
          <Input
            id="prediction-deadline"
            type="date"
            min={today}
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            aria-invalid={Boolean(fieldErrors.deadline)}
            aria-describedby={fieldErrors.deadline ? 'prediction-deadline-error' : 'prediction-deadline-hint'}
          />
        ) : null}
        <p id="prediction-deadline-hint" className="text-sm text-text-muted">
          {deadlinePresetOptions.find((option) => option.value === deadlinePreset)?.label}
          {' → '}
          {deadlineResolution.deadline ? <time dateTime={deadlineResolution.deadline}>{formatPredictionDate(deadlineResolution.deadline)}</time> : 'Choose a date'}
        </p>
        {deadlineResolution.hint ? <p className="text-sm text-text-muted">{deadlineResolution.hint}</p> : null}
        {fieldErrors.deadline ? <p id="prediction-deadline-error" role="alert" className="text-sm text-state-error">{fieldErrors.deadline}</p> : null}
      </fieldset>

      <div className="grid gap-1">
        <label htmlFor="prediction-confidence" className="text-sm font-medium text-text-strong">
          Confidence: <span>{confidence}%</span>
        </label>
        <div className="flex items-center gap-4">
          <Slider
            id="prediction-confidence-slider"
            min={50}
            max={100}
            step={1}
            value={[confidence]}
            onValueChange={([value]) => setConfidence(value ?? confidence)}
            aria-label="Confidence"
            aria-describedby="prediction-confidence-help"
            className="max-w-xs"
          />
          <Input
            id="prediction-confidence"
            type="number"
            min={50}
            max={100}
            step={1}
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
            className="w-20"
            aria-describedby="prediction-confidence-help"
          />
        </div>
        <p id="prediction-confidence-help" className="text-sm text-text-muted">How sure are you? 50% means a coin flip.</p>
        {fieldErrors.confidence ? <p role="alert" className="text-sm text-state-error">{fieldErrors.confidence}</p> : null}
      </div>

      {type !== 'FREEFORM' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="prediction-priceAtPrediction" className="text-sm font-medium text-text-strong">Price at prediction</label>
            <Input
              id="prediction-priceAtPrediction"
              inputMode="decimal"
              placeholder="Price now"
              value={priceAtPredictionInput}
              onChange={(event) => setPriceAtPredictionInput(event.target.value)}
              aria-invalid={Boolean(fieldErrors.priceAtPrediction)}
              aria-describedby={fieldErrors.priceAtPrediction ? 'prediction-priceAtPrediction-error' : undefined}
            />
            {fieldErrors.priceAtPrediction ? <p id="prediction-priceAtPrediction-error" role="alert" className="text-sm text-state-error">{fieldErrors.priceAtPrediction}</p> : null}
            <p className="text-sm text-text-muted">
              Captured at <time dateTime={priceCapturedAt}>{new Date(priceCapturedAt).toLocaleString()}</time>{' '}
              <button type="button" className="text-action-primary underline" onClick={() => setEditingCapturedAt(true)}>Change</button>
            </p>
            {editingCapturedAt ? (
              <Input
                type="datetime-local"
                value={toDatetimeLocalValue(priceCapturedAt)}
                onChange={(event) => {
                  const iso = fromDatetimeLocalValue(event.target.value)
                  if (iso) setPriceCapturedAt(iso)
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {type === 'PERCENT_MOVE' || type === 'TARGET_PRICE' || type === 'EVENT_REACTION' ? (
        <p aria-live="polite" role="status" className="text-sm font-medium text-text-strong">
          {preview ? preview.text : 'Enter prices to see the predicted price and move size.'}
        </p>
      ) : null}

      <div className="grid gap-1">
        <label htmlFor="prediction-reasoning" className="text-sm font-medium text-text-strong">
          Why do you think this will happen? <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <Textarea
          id="prediction-reasoning"
          rows={4}
          value={reasoning}
          onChange={(event) => setReasoning(event.target.value)}
          aria-describedby="prediction-reasoning-help"
        />
        <p id="prediction-reasoning-help" className="text-sm text-text-muted">Markdown formatting is supported.</p>
      </div>

      <details open={mode === 'edit' && tags.length > 0}>
        <summary className="cursor-pointer text-sm font-medium text-text-strong">Add tags</summary>
        <div className="mt-2 grid gap-2">
          <label htmlFor="prediction-tags" className="text-sm font-medium text-text-strong">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => removeTag(tag)}>×</button>
              </Badge>
            ))}
          </div>
          <Input
            id="prediction-tags"
            list="prediction-tag-suggestions"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addTag(tagDraft)
              }
            }}
            placeholder="Type a tag and press Enter"
          />
          <datalist id="prediction-tag-suggestions">
            {tagSuggestions.map((tag) => <option key={tag} value={tag} />)}
          </datalist>
        </div>
      </details>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save prediction'}</Button>
        <Button type="button" variant="outline" disabled={saving} onClick={() => navigate(cancelPath)}>Cancel</Button>
      </div>

      <AlertDialog open={Boolean(amendDialog)} onOpenChange={(open) => { if (!open) setAmendDialog(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Amended?</AlertDialogTitle>
            <AlertDialogDescription>
              You changed: {amendDialog ? describeChangedClaimFields(amendDialog.changedFields) : ''}. The original claim stays visible in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAmendDialog(null)}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmAmendSave()}>Save and mark Amended</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
