import { useEffect, useRef } from 'react'
import type { JournalEntry } from '@portfolio-engineering/shared-types/journal'

import { formatDateForDisplay } from '@/journalDates'
import { Button } from './ui/button'
import { CopyButton } from './ui/copy-button'

type ReviewScope = 'week' | 'month' | 'all'

interface JournalReviewTableProps {
  entries: JournalEntry[]
  scope: ReviewScope
  emptyMessage: string
  onNavigate: (path: string) => void
  onCopyEntry: (entry: JournalEntry) => Promise<boolean>
  onDownloadEntry: (entry: JournalEntry) => void
  selectedDates: string[]
  onSelectedDatesChange: (dates: string[]) => void
  isExportingSelection: boolean
}

/**
 * Shared current-table selection behavior for all Journal review scopes.
 * Selection is owned by the Journal page so export actions can live beside the
 * scope controls. It remains transient and is reset by its URL-derived key.
 */
export function JournalReviewTable({
  entries,
  scope,
  emptyMessage,
  onNavigate,
  onCopyEntry,
  onDownloadEntry,
  selectedDates,
  onSelectedDatesChange,
  isExportingSelection,
}: JournalReviewTableProps) {
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const availableDates = new Set(entries.map((entry) => entry.localDate))
    const availableSelectedDates = selectedDates.filter((date) => availableDates.has(date))
    if (availableSelectedDates.length !== selectedDates.length) {
      onSelectedDatesChange(availableSelectedDates)
    }
  }, [entries, onSelectedDatesChange, selectedDates])

  const selectedDateSet = new Set(selectedDates)
  const selectedCount = selectedDateSet.size
  const allVisibleEntriesSelected =
    entries.length > 0 && selectedCount === entries.length

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate =
        selectedCount > 0 && !allVisibleEntriesSelected
    }
  }, [allVisibleEntriesSelected, selectedCount])

  const toggleEntry = (localDate: string) => {
    onSelectedDatesChange(
      selectedDates.includes(localDate)
        ? selectedDates.filter((date) => date !== localDate)
        : [...selectedDates, localDate],
    )
  }

  const toggleAllEntries = () => {
    onSelectedDatesChange(
      allVisibleEntriesSelected ? [] : entries.map((entry) => entry.localDate),
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-muted">
              <th className="w-12 px-4 py-3 text-left font-semibold text-text-strong">
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  checked={allVisibleEntriesSelected}
                  onChange={toggleAllEntries}
                  disabled={entries.length === 0 || isExportingSelection}
                  aria-checked={
                    selectedCount > 0 && !allVisibleEntriesSelected
                      ? 'mixed'
                      : allVisibleEntriesSelected
                  }
                  aria-label={`Select all entries in this ${scope}`}
                  className="h-4 w-4 accent-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-strong">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-text-strong">Entry Preview</th>
              <th className="px-4 py-3 text-left font-semibold text-text-strong">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length > 0 ? (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border-subtle transition-colors hover:bg-surface-emphasis"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedDateSet.has(entry.localDate)}
                      onChange={() => toggleEntry(entry.localDate)}
                      disabled={isExportingSelection}
                      aria-label={`Select entry for ${formatDateForDisplay(entry.localDate)}`}
                      className="h-4 w-4 accent-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2"
                    />
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {formatDateForDisplay(entry.localDate)}
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-text-muted">
                    {entry.content.slice(0, 100)}...
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => onNavigate(`/workspace/journal?mode=day&date=${entry.localDate}&contentMode=reading`)}
                      aria-label={`View entry for ${formatDateForDisplay(entry.localDate)}`}
                    >
                      <ViewIcon />
                      View
                    </Button>
                    <CopyButton
                      onCopyAction={() => onCopyEntry(entry)}
                      variant="link"
                      size="sm"
                      label="Copy"
                      icon={<CopyIcon />}
                    />
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => onDownloadEntry(entry)}
                      aria-label={`Download entry for ${formatDateForDisplay(entry.localDate)}`}
                    >
                      <DownloadIcon />
                      Download
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </>
  )
}

function ViewIcon() {
  return (
    <svg aria-hidden="true" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 8h10v12H8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
    </svg>
  )
}
