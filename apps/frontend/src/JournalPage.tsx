import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { ApiClientContext } from './App'
import type { AuthenticatedApiClient } from './apiClient'
import { getJournalEntries, getEnvironmentTimezone, createJournalEntry, updateJournalEntry } from './journalApi'
import {
  getTodayInTimezone,
  getCurrentMonth,
  getCurrentWeekStart,
  addDays,
  formatDateForDisplay,
  formatWeekRangeForDisplay,
  isValidDate,
  isValidWeekStart,
} from './journalDates'
import { serializeToMarkdown, generateFilename, copyToClipboard, downloadAsMarkdown } from './journalExport'
import type { JournalEntry } from '@portfolio-engineering/shared-types/journal'
import { NotYetImplemented } from '@portfolio-engineering/ui'
import { CopyButton } from './components/ui/copy-button'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { JournalReviewTable } from './components/JournalReviewTable'
import { JournalAnalysisPanel } from './components/JournalAnalysisPanel'
import { MarkdownViewer } from './components/MarkdownViewer'

type ViewMode = 'day' | 'week' | 'month' | 'all'
type SelectedSourceScope = 'week' | 'month' | 'all'
const ALL_PAGE_SIZE = 50
const ALL_EXPORT_PAGE_SIZE = 500
const JOURNAL_EDITOR_HEIGHT_STORAGE_KEY = 'portfolio-engineering.journal-editor-height'
const DEFAULT_JOURNAL_EDITOR_HEIGHT = 320
const MIN_JOURNAL_EDITOR_HEIGHT = 192
const MAX_JOURNAL_EDITOR_HEIGHT = 1200
type ExportFeedback = {
  message: string
  variant: 'success' | 'error'
}

function getScopeKey(
  mode: ViewMode,
  date: string,
  weekStart: string,
  month: string,
  allOffset: number,
  timezone: string,
): string {
  switch (mode) {
    case 'day':
      return `day:${date}:${timezone}`
    case 'week':
      return `week:${weekStart}:${timezone}`
    case 'month':
      return `month:${month}:${timezone}`
    case 'all':
      return `all:${allOffset}:${timezone}`
  }
}

function getAllOffset(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) {
    return 0
  }

  const offset = Number(value)
  return Number.isSafeInteger(offset) ? offset : 0
}

function getStoredJournalEditorHeight(): number {
  try {
    const value = Number(window.localStorage.getItem(JOURNAL_EDITOR_HEIGHT_STORAGE_KEY))
    return Number.isFinite(value) &&
      value >= MIN_JOURNAL_EDITOR_HEIGHT &&
      value <= MAX_JOURNAL_EDITOR_HEIGHT
      ? value
      : DEFAULT_JOURNAL_EDITOR_HEIGHT
  } catch (error) {
    console.warn('Unable to restore the Journal editor height.', error)
    return DEFAULT_JOURNAL_EDITOR_HEIGHT
  }
}

export function JournalPage() {
  const apiClient = useContext(ApiClientContext)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [allTotal, setAllTotal] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadErrorScopeKey, setLoadErrorScopeKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null)
  const [unsavedDraft, setUnsavedDraft] = useState<string | null>(null)
  const [selectedEditorMode, setSelectedEditorMode] = useState<
    'focus' | 'live-preview' | 'reading'
  >('focus')
  const [isSaving, setIsSaving] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<ExportFeedback | null>(null)
  const [chosenDate, setChosenDate] = useState('')
  const [chosenDateError, setChosenDateError] = useState<string | null>(null)
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [isExportingSelection, setIsExportingSelection] = useState(false)
  
  const tz = getEnvironmentTimezone()
  const modeValues = searchParams.getAll('mode')
  const requestedMode = modeValues.length === 1 ? modeValues[0] : null
  const weekStartValues = searchParams.getAll('weekStart')
  const hasWeekMode = modeValues.includes('week')
  const hasWeekQuery = hasWeekMode || weekStartValues.length > 0 || searchParams.has('week')
  const hasOnlyWeekMode = requestedMode === 'week'
  const hasUnexpectedWeekQueryParameter = (() => {
    let hasUnexpectedParameter = false
    searchParams.forEach((_value, key) => {
      if (key !== 'mode' && key !== 'weekStart') {
        hasUnexpectedParameter = true
      }
    })
    return hasUnexpectedParameter
  })()
  const isMissingWeekStart =
    hasOnlyWeekMode &&
    weekStartValues.length === 0 &&
    !hasUnexpectedWeekQueryParameter
  const hasValidWeekLocation =
    hasOnlyWeekMode &&
    weekStartValues.length === 1 &&
    isValidWeekStart(weekStartValues[0]) &&
    !hasUnexpectedWeekQueryParameter
  const hasInvalidWeekLocation =
    hasWeekQuery && !hasValidWeekLocation && !isMissingWeekStart
  const mode: ViewMode =
    hasWeekQuery
      ? 'week'
      : requestedMode === 'day' ||
    requestedMode === 'week' ||
    requestedMode === 'month' ||
    requestedMode === 'all'
      ? requestedMode
      : 'month'
  const today = getTodayInTimezone(tz)
  const date = searchParams.get('date') || today
  const contentMode = searchParams.get('contentMode')
  const currentWeekStart = getCurrentWeekStart(tz)
  const weekStart = hasValidWeekLocation ? weekStartValues[0] : currentWeekStart
  const month = searchParams.get('month') || getCurrentMonth(tz)
  const allOffset = getAllOffset(searchParams.get('offset'))
  const scopeKey = getScopeKey(mode, date, weekStart, month, allOffset, tz)
  const currentScopeKeyRef = useRef(scopeKey)
  const requestIdRef = useRef(0)
  const selectedExportRequestIdRef = useRef(0)
  const exportFeedbackTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const showExportFeedback = useCallback((
    message: string,
    variant: ExportFeedback['variant'],
    duration = 3000,
  ) => {
    if (exportFeedbackTimerRef.current !== null) {
      window.clearTimeout(exportFeedbackTimerRef.current)
    }

    setExportFeedback({ message, variant })
    exportFeedbackTimerRef.current = window.setTimeout(() => {
      setExportFeedback(null)
      exportFeedbackTimerRef.current = null
    }, duration)
  }, [])

  useEffect(() => {
    return () => {
      if (exportFeedbackTimerRef.current !== null) {
        window.clearTimeout(exportFeedbackTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    currentScopeKeyRef.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    if (hasInvalidWeekLocation) {
      return
    }

    if (isMissingWeekStart) {
      navigate(`/workspace/journal?mode=week&weekStart=${currentWeekStart}`, { replace: true })
    } else if (!requestedMode || requestedMode !== mode) {
      navigate(`/workspace/journal?mode=month&month=${month}`, { replace: true })
    } else if (mode === 'day' && !searchParams.get('date')) {
      navigate(`/workspace/journal?mode=day&date=${date}`, { replace: true })
    } else if (mode === 'month' && !searchParams.get('month')) {
      navigate(`/workspace/journal?mode=month&month=${month}`, { replace: true })
    } else if (
      mode === 'all' &&
      searchParams.get('offset') !== null &&
      getAllOffset(searchParams.get('offset')) === 0 &&
      searchParams.get('offset') !== '0'
    ) {
      navigate('/workspace/journal?mode=all', { replace: true })
    }
  }, [
    currentWeekStart,
    date,
    hasInvalidWeekLocation,
    isMissingWeekStart,
    mode,
    month,
    navigate,
    requestedMode,
    searchParams,
  ])

  useEffect(() => {
    setUnsavedDraft(null)
    setSaveError(null)
    setSelectedDates([])
  }, [scopeKey])

  useEffect(() => {
    if (mode === 'day') {
      setSelectedEditorMode(contentMode === 'reading' ? 'reading' : 'focus')
    }
  }, [contentMode, date, mode])

  useEffect(() => {
    if (hasInvalidWeekLocation || isMissingWeekStart) {
      setLoading(false)
      return
    }

    if (!apiClient) {
      setLoading(false)
      return
    }

    const requestScopeKey = scopeKey
    const requestId = ++requestIdRef.current
    let cancelled = false

    setLoading(true)
    setLoadError(null)
    setLoadErrorScopeKey(null)

    const loadEntries = async () => {
      try {
        const response = await getJournalEntries(apiClient, {
          mode,
          date: mode === 'day' ? date : undefined,
          weekStart: mode === 'week' ? weekStart : undefined,
          month: mode === 'month' ? month : undefined,
          limit: mode === 'all' ? ALL_PAGE_SIZE : undefined,
          offset: mode === 'all' ? allOffset : undefined,
          tz,
        })

        if (cancelled || currentScopeKeyRef.current !== requestScopeKey || requestIdRef.current !== requestId) {
          return
        }

        setEntries(response.entries || [])
        setAllTotal(
          mode === 'all' &&
            typeof response.total === 'number' &&
            Number.isSafeInteger(response.total) &&
            response.total >= 0
            ? response.total
            : undefined,
        )
        setLoadedScopeKey(requestScopeKey)
      } catch (err) {
        if (cancelled || currentScopeKeyRef.current !== requestScopeKey || requestIdRef.current !== requestId) {
          return
        }

        setLoadError(err instanceof Error ? err.message : 'Failed to load entries')
        setLoadErrorScopeKey(requestScopeKey)
      } finally {
        if (!cancelled && currentScopeKeyRef.current === requestScopeKey && requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    }

    void loadEntries()

    return () => {
      cancelled = true
    }
  }, [
    allOffset,
    apiClient,
    date,
    hasInvalidWeekLocation,
    isMissingWeekStart,
    mode,
    month,
    scopeKey,
    tz,
    weekStart,
  ])
  
  const handleSaveEntry = async (content: string) => {
    if (!apiClient || !content.trim()) {
      setSaveError('Entry content cannot be empty')
      return
    }

    const saveScopeKey = scopeKey
    const saveRequestId = ++requestIdRef.current
    setIsSaving(true)
    setSaveError(null)

    try {
      const entry = entries[0]
      if (entry) {
        await updateJournalEntry(apiClient, entry.id, content, tz)
      } else {
        await createJournalEntry(apiClient, date, content, tz)
      }

      if (currentScopeKeyRef.current !== saveScopeKey || requestIdRef.current !== saveRequestId) {
        return
      }

      setUnsavedDraft(null)

      // Reload entries
      const response = await getJournalEntries(apiClient, {
        mode: 'day',
        date,
        tz,
      })

      if (currentScopeKeyRef.current !== saveScopeKey || requestIdRef.current !== saveRequestId) {
        return
      }

      setEntries(response.entries || [])
      setLoadedScopeKey(saveScopeKey)
    } catch (err) {
      if (currentScopeKeyRef.current === saveScopeKey && requestIdRef.current === saveRequestId) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save entry')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleChosenDateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const selectedDate = chosenDate.trim()

    if (!isValidDate(selectedDate)) {
      setChosenDateError('Enter a valid calendar date in YYYY-MM-DD format.')
      return
    }

    setChosenDateError(null)
    navigate(`/workspace/journal?mode=day&date=${selectedDate}`)
  }
  
  const loadAllEntriesForExport = useCallback(async (): Promise<JournalEntry[] | null> => {
    if (!apiClient) {
      showExportFeedback('Unable to retrieve every journal entry. Refresh and try again.', 'error')
      return null
    }

    const exportScopeKey = scopeKey
    const exportRequestId = ++selectedExportRequestIdRef.current
    const allEntries: JournalEntry[] = []
    const retrievedDates = new Set<string>()
    let offset = 0
    let expectedTotal: number | null = null

    try {
      do {
        const response = await getJournalEntries(apiClient, {
          mode: 'all',
          limit: ALL_EXPORT_PAGE_SIZE,
          offset,
          tz,
        })

        if (
          currentScopeKeyRef.current !== exportScopeKey ||
          selectedExportRequestIdRef.current !== exportRequestId
        ) {
          return null
        }

        if (
          typeof response.total !== 'number' ||
          !Number.isSafeInteger(response.total) ||
          response.total < 0 ||
          (expectedTotal !== null && response.total !== expectedTotal)
        ) {
          showExportFeedback('Unable to retrieve every journal entry. Refresh and try again.', 'error')
          return null
        }

        expectedTotal = response.total
        if (response.entries.length === 0 && allEntries.length < expectedTotal) {
          showExportFeedback('Unable to retrieve every journal entry. Refresh and try again.', 'error')
          return null
        }

        for (const entry of response.entries) {
          if (retrievedDates.has(entry.localDate)) {
            showExportFeedback('Unable to retrieve every journal entry. Refresh and try again.', 'error')
            return null
          }
          retrievedDates.add(entry.localDate)
          allEntries.push(entry)
        }

        offset += response.entries.length
      } while (expectedTotal === null || allEntries.length < expectedTotal)

      if (allEntries.length !== expectedTotal) {
        showExportFeedback('Unable to retrieve every journal entry. Refresh and try again.', 'error')
        return null
      }

      return allEntries
    } catch (err) {
      if (currentScopeKeyRef.current === exportScopeKey) {
        showExportFeedback(
          `Unable to retrieve every journal entry: ${err instanceof Error ? err.message : 'Unknown error'}`,
          'error',
        )
      }
      return null
    }
  }, [apiClient, scopeKey, showExportFeedback, tz])

  const getEntriesForFullExport = async (): Promise<JournalEntry[] | null> => {
    if (mode === 'all') {
      const allEntries = await loadAllEntriesForExport()
      if (allEntries && allEntries.length === 0) {
        showExportFeedback('No entries to export.', 'error')
        return null
      }
      return allEntries
    }

    if (entries.length === 0) {
      showExportFeedback('No entries to export.', 'error')
      return null
    }

    return entries
  }

  const handleCopy = async (): Promise<boolean> => {
    const entriesToExport = await getEntriesForFullExport()
    if (!entriesToExport) {
      return false
    }

    const exportScopeKey = scopeKey

    try {
      const markdown = serializeToMarkdown(entriesToExport, {
        scope: mode,
        date: mode === 'day' ? date : undefined,
        weekStart: mode === 'week' ? weekStart : undefined,
        month: mode === 'month' ? month : undefined,
      })

      const success = await copyToClipboard(markdown)
      if (currentScopeKeyRef.current !== exportScopeKey) {
       return false
      }

      if (!success) {
       showExportFeedback(
         'Unable to copy to clipboard. Check your browser permissions and try again.',
         'error',
       )
      }

      return success
    } catch (err) {
      if (currentScopeKeyRef.current === exportScopeKey) {
       showExportFeedback(
         `Unable to copy to clipboard: ${err instanceof Error ? err.message : 'Unknown error'}`,
         'error',
       )
      }

      return false
    }
  }

  const handleDownload = async (): Promise<void> => {
    const entriesToExport = await getEntriesForFullExport()
    if (!entriesToExport) {
      return
    }

    const exportScopeKey = scopeKey

    try {
      const markdown = serializeToMarkdown(entriesToExport, {
        scope: mode,
        date: mode === 'day' ? date : undefined,
        weekStart: mode === 'week' ? weekStart : undefined,
        month: mode === 'month' ? month : undefined,
      })
      const filename = generateFilename({
        scope: mode,
        date: mode === 'day' ? date : undefined,
        weekStart: mode === 'week' ? weekStart : undefined,
        month: mode === 'month' ? month : undefined,
      })

      if (currentScopeKeyRef.current !== exportScopeKey) {
        return
      }

      downloadAsMarkdown(markdown, filename)
      showExportFeedback(`Downloaded ${filename}`, 'success', 2000)
    } catch (err) {
      showExportFeedback(
       `Unable to download export: ${err instanceof Error ? err.message : 'Unknown error'}`,
       'error',
      )
    }
  }

  const loadSelectedEntriesForExport = useCallback(async (
    selectedDates: string[],
  ): Promise<JournalEntry[] | null> => {
    const selectedDateSet = new Set(selectedDates)
    const visibleDateSet = new Set(entries.map((entry) => entry.localDate))

    if (!apiClient || selectedDateSet.size === 0) {
      showExportFeedback('Select at least one entry to export', 'error')
      return null
    }

    if (
      selectedDateSet.size !== selectedDates.length ||
      [...selectedDateSet].some((date) => !visibleDateSet.has(date))
    ) {
      showExportFeedback(
        'One or more selected entries are no longer available. Refresh and try again.',
        'error',
      )
      return null
    }

    const exportScopeKey = scopeKey
    const exportRequestId = ++selectedExportRequestIdRef.current

    try {
      const response = await getJournalEntries(apiClient, {
        mode: 'selected',
        dates: [...selectedDateSet].sort(),
        tz,
      })

      if (
        currentScopeKeyRef.current !== exportScopeKey ||
        selectedExportRequestIdRef.current !== exportRequestId
      ) {
        return null
      }

      const returnedDates = new Set(response.entries.map((entry) => entry.localDate))
      const responseHasOnlyRequestedDates = response.entries.every((entry) =>
        selectedDateSet.has(entry.localDate),
      )

      if (
        !responseHasOnlyRequestedDates ||
        returnedDates.size !== response.entries.length ||
        returnedDates.size !== selectedDateSet.size ||
        [...selectedDateSet].some((date) => !returnedDates.has(date))
      ) {
        showExportFeedback(
          'One or more selected entries are no longer available. Refresh and try again.',
          'error',
        )
        return null
      }

      return response.entries
    } catch (err) {
      if (currentScopeKeyRef.current === exportScopeKey) {
        showExportFeedback(
          `Unable to load selected entries: ${err instanceof Error ? err.message : 'Unknown error'}`,
          'error',
        )
      }
      return null
    }
  }, [apiClient, entries, scopeKey, showExportFeedback, tz])

  const handleCopySelected = async (
    selectedSourceScope: SelectedSourceScope,
    selectedDates: string[],
  ): Promise<boolean> => {
    const selectedEntries = await loadSelectedEntriesForExport(selectedDates)
    if (!selectedEntries) {
      return false
    }

    const exportScopeKey = scopeKey
    try {
      const markdown = serializeToMarkdown(selectedEntries, {
        scope: 'selected',
        weekStart: selectedSourceScope === 'week' ? weekStart : undefined,
        month: selectedSourceScope === 'month' ? month : undefined,
        selectedDates,
        selectedSourceScope,
      })
      const success = await copyToClipboard(markdown)

      if (currentScopeKeyRef.current !== exportScopeKey) {
        return false
      }

      if (!success) {
        showExportFeedback(
          'Unable to copy to clipboard. Check your browser permissions and try again.',
          'error',
        )
      }

      return success
    } catch (err) {
      if (currentScopeKeyRef.current === exportScopeKey) {
        showExportFeedback(
          `Unable to copy to clipboard: ${err instanceof Error ? err.message : 'Unknown error'}`,
          'error',
        )
      }
      return false
    }
  }

  const handleDownloadSelected = async (
    selectedSourceScope: SelectedSourceScope,
    selectedDates: string[],
  ): Promise<void> => {
    const selectedEntries = await loadSelectedEntriesForExport(selectedDates)
    if (!selectedEntries) {
      return
    }

    const exportScopeKey = scopeKey
    try {
      const exportOptions = {
        scope: 'selected' as const,
        weekStart: selectedSourceScope === 'week' ? weekStart : undefined,
        month: selectedSourceScope === 'month' ? month : undefined,
        selectedDates,
        selectedSourceScope,
      }
      const markdown = serializeToMarkdown(selectedEntries, exportOptions)
      const filename = generateFilename(exportOptions)

      if (currentScopeKeyRef.current !== exportScopeKey) {
        return
      }

      downloadAsMarkdown(markdown, filename)
      showExportFeedback(`Downloaded ${filename}`, 'success', 2000)
    } catch (err) {
      if (currentScopeKeyRef.current === exportScopeKey) {
        showExportFeedback(
          `Unable to download export: ${err instanceof Error ? err.message : 'Unknown error'}`,
          'error',
        )
      }
    }
  }

  const selectedSourceScope: SelectedSourceScope | null =
    mode === 'week' || mode === 'month' || mode === 'all' ? mode : null
  const selectedEntryCount = selectedDates.length

  const handleCopyCurrentSelection = async (): Promise<boolean> => {
    if (!selectedSourceScope) {
      return false
    }

    setIsExportingSelection(true)
    try {
      return await handleCopySelected(selectedSourceScope, selectedDates)
    } finally {
      setIsExportingSelection(false)
    }
  }

  const handleDownloadCurrentSelection = async (): Promise<void> => {
    if (!selectedSourceScope) {
      return
    }

    setIsExportingSelection(true)
    try {
      await handleDownloadSelected(selectedSourceScope, selectedDates)
    } finally {
      setIsExportingSelection(false)
    }
  }

  const handleCopyEntry = async (entry: JournalEntry): Promise<boolean> => {
    const markdown = serializeToMarkdown([entry], {
      scope: 'day',
      date: entry.localDate,
    })
    const success = await copyToClipboard(markdown)
    if (!success) {
      showExportFeedback(
        'Unable to copy to clipboard. Check your browser permissions and try again.',
        'error',
      )
    }
    return success
  }

  const handleDownloadEntry = (entry: JournalEntry) => {
    const markdown = serializeToMarkdown([entry], {
      scope: 'day',
      date: entry.localDate,
    })
    const filename = generateFilename({ scope: 'day', date: entry.localDate })
    downloadAsMarkdown(markdown, filename)
    showExportFeedback(`Downloaded ${filename}`, 'success', 2000)
  }
  
  const isContentCurrent = loadedScopeKey === scopeKey
  const currentLoadError =
    loadErrorScopeKey === scopeKey ? loadError : null

  return (
    <div className="p-4 space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-text-strong mb-4">Journal</h2>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Journal time scope">
          <button
            onClick={() => navigate('/workspace/journal?mode=day&date=' + today)}
            aria-pressed={mode === 'day' && date === today}
            disabled={!apiClient}
            className={`px-4 py-2 rounded font-medium transition-colors ${mode === 'day' && date === today ? 'bg-action-primary text-white' : 'bg-surface-muted text-text-primary hover:bg-surface-emphasis'}`}
          >
            Today
          </button>
          <button
            onClick={() => navigate('/workspace/journal?mode=week&weekStart=' + currentWeekStart)}
            aria-pressed={mode === 'week'}
            disabled={!apiClient}
            className={`px-4 py-2 rounded font-medium transition-colors ${mode === 'week' ? 'bg-action-primary text-white' : 'bg-surface-muted text-text-primary hover:bg-surface-emphasis'}`}
          >
            Week
          </button>
          <button
            onClick={() => navigate('/workspace/journal?mode=month&month=' + month)}
            aria-pressed={mode === 'month'}
            disabled={!apiClient}
            className={`px-4 py-2 rounded font-medium transition-colors ${mode === 'month' ? 'bg-action-primary text-white' : 'bg-surface-muted text-text-primary hover:bg-surface-emphasis'}`}
          >
            Month
          </button>
          <button
            onClick={() => navigate('/workspace/journal?mode=all')}
            aria-pressed={mode === 'all'}
            disabled={!apiClient}
            className={`px-4 py-2 rounded font-medium transition-colors ${mode === 'all' ? 'bg-action-primary text-white' : 'bg-surface-muted text-text-primary hover:bg-surface-emphasis'}`}
          >
            All
          </button>
          {selectedSourceScope && selectedEntryCount > 0 ? (
            <>
              <CopyButton
                onCopyAction={handleCopyCurrentSelection}
                disabled={isExportingSelection}
                variant="secondary"
                label={`Copy ${selectedEntryCount} selected ${selectedEntryCount === 1 ? 'entry' : 'entries'}`}
                icon={<CopyIcon />}
              />
              <Button
                type="button"
                onClick={() => void handleDownloadCurrentSelection()}
                disabled={isExportingSelection}
                variant="secondary"
              >
                <DownloadIcon />
                {isExportingSelection
                  ? 'Preparing export...'
                  : `Download ${selectedEntryCount} selected ${selectedEntryCount === 1 ? 'entry' : 'entries'}`}
              </Button>
            </>
          ) : null}
        </div>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={handleChosenDateSubmit}
          noValidate
        >
          <div className="min-w-52">
            <label
              className="mb-1 block text-sm font-medium text-text-strong"
              htmlFor="journal-chosen-date"
            >
              Choose a date
            </label>
            <Input
              id="journal-chosen-date"
              type="date"
              value={chosenDate}
              onChange={(event) => {
                setChosenDate(event.target.value)
                setChosenDateError(null)
              }}
              onInvalid={() => setChosenDateError('Enter a valid calendar date in YYYY-MM-DD format.')}
              aria-describedby={chosenDateError ? 'journal-chosen-date-error' : undefined}
              aria-invalid={chosenDateError ? true : undefined}
              disabled={!apiClient}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!apiClient}>
            Open date
          </Button>
          {chosenDateError ? (
            <p
              id="journal-chosen-date-error"
              className="basis-full text-sm text-state-error"
              role="alert"
            >
              {chosenDateError}
            </p>
          ) : null}
        </form>
      </header>

      <section aria-label="Journal content" aria-busy={loading}>
        {loading ? (
          <p className="mb-4 text-sm text-text-muted" role="status" aria-live="polite">
            {isContentCurrent ? 'Refreshing journal content...' : 'Loading journal content...'}
          </p>
        ) : null}

        {hasInvalidWeekLocation ? (
          <div className="rounded-lg border-2 border-state-error bg-surface-default p-6" role="alert">
            <h3 className="text-lg font-semibold text-state-error">This Week link is invalid</h3>
            <p className="mt-2 text-text-muted">
              Use one Sunday start date in the form YYYY-MM-DD. Open the current Week to continue.
            </p>
            <Button
              type="button"
              className="mt-4"
              onClick={() => navigate(`/workspace/journal?mode=week&weekStart=${currentWeekStart}`)}
            >
              Open current Week
            </Button>
          </div>
        ) : !apiClient ? (
          <div className="rounded-lg border border-border-subtle bg-surface-default p-6">
            <h3 className="text-lg font-semibold text-text-strong">Not authenticated</h3>
            <p className="text-text-muted mt-2">Please sign in to use the journal.</p>
          </div>
        ) : currentLoadError && !isContentCurrent ? (
          <div className="rounded-lg border-2 border-state-error bg-surface-default p-6" role="alert">
            <h3 className="text-lg font-semibold text-state-error">Error loading journal</h3>
            <p className="text-text-muted mt-2">{currentLoadError}</p>
          </div>
        ) : !isContentCurrent ? (
          <div className="rounded-lg border border-border-subtle bg-surface-default p-6">
            <p className="text-text-muted">Loading journal content...</p>
          </div>
        ) : (
          <>
            {currentLoadError ? (
              <div className="mb-4 rounded-lg border border-state-error bg-surface-default p-4" role="alert">
                <p className="font-medium text-state-error">Unable to refresh journal content.</p>
                <p className="mt-1 text-sm text-text-muted">{currentLoadError}</p>
              </div>
            ) : null}

            {mode === 'day' && (
              <JournalDayView
                date={date}
                entries={entries}
                unsavedDraft={unsavedDraft}
                setUnsavedDraft={setUnsavedDraft}
                editorMode={selectedEditorMode}
                setEditorMode={setSelectedEditorMode}
                onSave={handleSaveEntry}
                isSaving={isSaving}
                error={saveError}
                onCopy={handleCopy}
                onDownload={handleDownload}
                exportFeedback={exportFeedback}
                apiClient={apiClient}
                onOpenAiSettings={() => navigate('/workspace/settings/your-ai/connections')}
              />
            )}

            {mode === 'week' && (
              <JournalWeekView
                weekStart={weekStart}
                entries={entries}
                onNavigate={navigate}
                onCopyEntry={handleCopyEntry}
                onDownloadEntry={handleDownloadEntry}
                selectedDates={selectedDates}
                onSelectedDatesChange={setSelectedDates}
                isExportingSelection={isExportingSelection}
                exportFeedback={exportFeedback}
              />
            )}

            {mode === 'month' && (
              <JournalMonthView
                entries={entries}
                onNavigate={navigate}
                onCopyEntry={handleCopyEntry}
                onDownloadEntry={handleDownloadEntry}
                selectedDates={selectedDates}
                onSelectedDatesChange={setSelectedDates}
                isExportingSelection={isExportingSelection}
                exportFeedback={exportFeedback}
              />
            )}

            {mode === 'all' && (
              <JournalAllView
                entries={entries}
                onNavigate={navigate}
                onCopyEntry={handleCopyEntry}
                onDownloadEntry={handleDownloadEntry}
                selectedDates={selectedDates}
                onSelectedDatesChange={setSelectedDates}
                isExportingSelection={isExportingSelection}
                exportFeedback={exportFeedback}
                offset={allOffset}
                total={allTotal}
                pageSize={ALL_PAGE_SIZE}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}

interface JournalDayViewProps {
  date: string
  entries: JournalEntry[]
  unsavedDraft: string | null
  setUnsavedDraft: (text: string) => void
  editorMode: 'focus' | 'live-preview' | 'reading'
  setEditorMode: (mode: 'focus' | 'live-preview' | 'reading') => void
  onSave: (content: string) => Promise<void>
  isSaving: boolean
  error: string | null
  onCopy: () => Promise<boolean>
  onDownload: () => void
  exportFeedback: ExportFeedback | null
  apiClient: AuthenticatedApiClient
  onOpenAiSettings: () => void
}

function JournalDayView({
  date,
  entries,
  unsavedDraft,
  setUnsavedDraft,
  editorMode,
  setEditorMode,
  onSave,
  isSaving,
  error,
  onCopy,
  onDownload,
  exportFeedback,
  apiClient,
  onOpenAiSettings,
}: JournalDayViewProps) {
  const entry = entries[0] || null
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const analysisHeadingRef = useRef<HTMLHeadingElement>(null)
  const [editorHeight, setEditorHeight] = useState(getStoredJournalEditorHeight)
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false)
  const displayDate = formatDateForDisplay(date)
  const persistedContent = entry?.content || ''
  const content = unsavedDraft ?? persistedContent
  const hasUnsavedChanges = unsavedDraft !== null && unsavedDraft !== persistedContent
  const canSave = hasUnsavedChanges && content.trim().length > 0
  const showsEditor = editorMode !== 'reading'
  const showsViewer = editorMode !== 'focus'

  useEffect(() => {
    setIsAnalysisPanelOpen(false)
  }, [date, entry?.id])

  const focusEditor = () => {
    setEditorMode('focus')
    window.requestAnimationFrame(() => editorRef.current?.focus())
  }

  const openAnalysisPanel = () => {
    if (!entry) {
      return
    }

    setIsAnalysisPanelOpen(true)
    window.requestAnimationFrame(() => analysisHeadingRef.current?.focus())
  }

  const saveEditorHeight = () => {
    const height = editorRef.current?.offsetHeight
    if (
      height === undefined ||
      height < MIN_JOURNAL_EDITOR_HEIGHT ||
      height > MAX_JOURNAL_EDITOR_HEIGHT
    ) {
      return
    }

    setEditorHeight(height)
    try {
      window.localStorage.setItem(JOURNAL_EDITOR_HEIGHT_STORAGE_KEY, String(height))
    } catch (error) {
      console.warn('Unable to save the Journal editor height.', error)
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border-subtle bg-surface-default p-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-text-strong">{displayDate}</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Journal content mode">
            <button
              onClick={() => setEditorMode('focus')}
              aria-pressed={editorMode === 'focus'}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${editorMode === 'focus' ? 'bg-action-primary text-white' : 'bg-surface-muted text-text-primary'}`}
            >
              Focus
            </button>
            <button
              onClick={() => setEditorMode('live-preview')}
              aria-pressed={editorMode === 'live-preview'}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${editorMode === 'live-preview' ? 'bg-action-primary text-white' : 'bg-surface-muted text-text-primary'}`}
            >
              Live preview
            </button>
            <button
              onClick={() => setEditorMode('reading')}
              aria-pressed={editorMode === 'reading'}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${editorMode === 'reading' ? 'bg-action-primary text-white' : 'bg-surface-muted text-text-primary'}`}
            >
              Reading view
            </button>
          </div>
        </div>
        
        {!entry && !content && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-text-muted">No entry for this date.</p>
            <Button
              type="button"
              variant="secondary"
              onClick={focusEditor}
            >
              Create entry
            </Button>
          </div>
        )}
        
        <div className={editorMode === 'live-preview' ? 'grid gap-4 lg:grid-cols-2' : undefined}>
          {showsEditor ? (
            <div>
            <label className="mb-2 block text-sm font-medium text-text-strong" htmlFor="journal-entry-content">
              Journal entry (Markdown)
            </label>
            <textarea
              ref={editorRef}
              id="journal-entry-content"
              value={content}
              onChange={(event) => setUnsavedDraft(event.target.value)}
              onPointerUp={saveEditorHeight}
              placeholder="Write your journal entry here in Markdown..."
              className="w-full min-h-48 resize-y rounded border border-border-subtle bg-surface-default p-4 font-mono text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action-primary"
              disabled={isSaving}
              style={{ height: `${editorHeight}px` }}
            />
            </div>
          ) : null}
          {showsViewer ? (
            <div>
              {editorMode === 'live-preview' ? (
                <p className="mb-2 text-sm font-medium text-text-strong">Live preview</p>
              ) : null}
              <MarkdownViewer
                value={content}
                label={editorMode === 'live-preview' ? 'Journal entry live preview' : 'Journal entry reading view'}
              />
            </div>
          ) : null}
        </div>
        
        {error && (
          <div className="mt-4 p-3 rounded bg-state-error bg-opacity-10 border border-state-error text-state-error">
            {error}
          </div>
        )}
        
        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            onClick={() => onSave(content)}
            disabled={isSaving || !canSave}
            className={`px-4 py-2 rounded font-medium transition-colors ${canSave && !isSaving ? 'bg-action-primary text-white hover:opacity-90 cursor-pointer' : 'bg-surface-muted text-text-muted cursor-not-allowed opacity-50'}`}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <CopyButton
            onCopyAction={onCopy}
            disabled={entries.length === 0}
            variant="secondary"
          />
          <button
            onClick={onDownload}
            disabled={entries.length === 0}
            className={`px-4 py-2 rounded font-medium transition-colors ${entries.length > 0 ? 'bg-surface-muted text-text-primary hover:bg-surface-emphasis cursor-pointer' : 'bg-surface-muted text-text-muted cursor-not-allowed opacity-50'}`}
          >
            Download as Markdown
          </button>
          <Button
            type="button"
            variant="secondary"
            onClick={openAnalysisPanel}
            disabled={!entry}
            aria-controls={isAnalysisPanelOpen ? 'journal-analysis-title' : undefined}
          >
            Analyze with AI
          </Button>
        </div>
        
        <ExportFeedback feedback={exportFeedback} className="mt-4" />
      </div>

      {isAnalysisPanelOpen ? (
        <JournalAnalysisPanel
          ref={analysisHeadingRef}
          apiClient={apiClient}
          entryId={entry?.id ?? null}
          hasUnsavedChanges={hasUnsavedChanges}
          onOpenAiSettings={onOpenAiSettings}
        />
      ) : null}
       
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NotYetImplemented
          featureName="WYSIWYG Editing"
          description="Rich-text journal editing is planned. Use Markdown editing and Preview while this capability is in development."
        />
        <NotYetImplemented
          featureName="New Experiments"
          description="Track experimental trade ideas and outcomes associated with your journal entries."
        />
        <NotYetImplemented
          featureName="Rules Adherence"
          description="Review compliance with your personal trading rules based on journal patterns and decisions."
        />
        <NotYetImplemented
          featureName="Add Context"
          description="Inject current portfolio state, positions, and market data into AI analysis for richer insights."
        />
      </div>
    </div>
  )
}

interface JournalWeekViewProps {
  weekStart: string
  entries: JournalEntry[]
  onNavigate: (path: string) => void
  onCopyEntry: (entry: JournalEntry) => Promise<boolean>
  onDownloadEntry: (entry: JournalEntry) => void
  selectedDates: string[]
  onSelectedDatesChange: (dates: string[]) => void
  isExportingSelection: boolean
  exportFeedback: ExportFeedback | null
}

function JournalWeekView({
  weekStart,
  entries,
  onNavigate,
  onCopyEntry,
  onDownloadEntry,
  selectedDates,
  onSelectedDatesChange,
  isExportingSelection,
  exportFeedback,
}: JournalWeekViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-text-strong">
          {formatWeekRangeForDisplay(weekStart)}
        </h3>
        <div className="flex flex-wrap gap-2" aria-label="Week navigation">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate(`/workspace/journal?mode=week&weekStart=${addDays(weekStart, -7)}`)}
          >
            Previous Week
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate(`/workspace/journal?mode=week&weekStart=${addDays(weekStart, 7)}`)}
          >
            Next Week
          </Button>
        </div>
      </div>
      <JournalReviewTable
        entries={entries}
        scope="week"
        emptyMessage="No entries this week."
        onNavigate={onNavigate}
        onCopyEntry={onCopyEntry}
        onDownloadEntry={onDownloadEntry}
        selectedDates={selectedDates}
        onSelectedDatesChange={onSelectedDatesChange}
        isExportingSelection={isExportingSelection}
      />
      
      <ExportFeedback feedback={exportFeedback} />
    </div>
  )
}

interface JournalMonthViewProps {
  entries: JournalEntry[]
  onNavigate: (path: string) => void
  onCopyEntry: (entry: JournalEntry) => Promise<boolean>
  onDownloadEntry: (entry: JournalEntry) => void
  selectedDates: string[]
  onSelectedDatesChange: (dates: string[]) => void
  isExportingSelection: boolean
  exportFeedback: ExportFeedback | null
}

function JournalMonthView({
  entries,
  onNavigate,
  onCopyEntry,
  onDownloadEntry,
  selectedDates,
  onSelectedDatesChange,
  isExportingSelection,
  exportFeedback,
}: JournalMonthViewProps) {
  return (
    <div className="space-y-4">
      <JournalReviewTable
        entries={entries}
        scope="month"
        emptyMessage="No entries this month."
        onNavigate={onNavigate}
        onCopyEntry={onCopyEntry}
        onDownloadEntry={onDownloadEntry}
        selectedDates={selectedDates}
        onSelectedDatesChange={onSelectedDatesChange}
        isExportingSelection={isExportingSelection}
      />
      
      <ExportFeedback feedback={exportFeedback} />
    </div>
  )
}

interface JournalAllViewProps {
  entries: JournalEntry[]
  onNavigate: (path: string) => void
  onCopyEntry: (entry: JournalEntry) => Promise<boolean>
  onDownloadEntry: (entry: JournalEntry) => void
  selectedDates: string[]
  onSelectedDatesChange: (dates: string[]) => void
  isExportingSelection: boolean
  exportFeedback: ExportFeedback | null
  offset: number
  total: number | undefined
  pageSize: number
}

function JournalAllView({
  entries,
  onNavigate,
  onCopyEntry,
  onDownloadEntry,
  selectedDates,
  onSelectedDatesChange,
  isExportingSelection,
  exportFeedback,
  offset,
  total,
  pageSize,
}: JournalAllViewProps) {
  const currentPage = Math.floor(offset / pageSize) + 1
  const totalPages = total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize))
  const hasPreviousPage = offset > 0
  const hasNextPage = total !== undefined && offset + entries.length < total
  const showPagination = hasPreviousPage || (total !== undefined && total > entries.length)

  return (
    <div className="space-y-4">
      <JournalReviewTable
        entries={entries}
        scope="all"
        emptyMessage={total && total > 0 ? 'No entries on this results page.' : 'No entries yet.'}
        onNavigate={onNavigate}
        onCopyEntry={onCopyEntry}
        onDownloadEntry={onDownloadEntry}
        selectedDates={selectedDates}
        onSelectedDatesChange={onSelectedDatesChange}
        isExportingSelection={isExportingSelection}
      />

      {showPagination ? (
        <nav className="flex flex-wrap items-center gap-3" aria-label="All journal entries pagination">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate(`/workspace/journal?mode=all&offset=${Math.max(0, offset - pageSize)}`)}
            disabled={!hasPreviousPage}
          >
            Previous page
          </Button>
          <p className="text-sm text-text-muted" role="status" aria-live="polite">
            {totalPages === undefined
              ? `Page ${currentPage}`
              : `Page ${currentPage} of ${totalPages}`}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate(`/workspace/journal?mode=all&offset=${offset + pageSize}`)}
            disabled={!hasNextPage}
          >
            Next page
          </Button>
        </nav>
      ) : null}
      
      <ExportFeedback feedback={exportFeedback} />
    </div>
  )
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 8h10v12H8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
    </svg>
  )
}

function ExportFeedback({
  feedback,
  className = '',
}: {
  feedback: ExportFeedback | null
  className?: string
}) {
  if (!feedback) {
    return null
  }

  const isError = feedback.variant === 'error'

  return (
    <div
      className={`${className} p-3 rounded border text-sm ${
        isError
          ? 'border-state-error bg-state-error bg-opacity-10 text-state-error'
          : 'border-state-success bg-state-success bg-opacity-10 text-state-success'
      }`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {feedback.message}
    </div>
  )
}
