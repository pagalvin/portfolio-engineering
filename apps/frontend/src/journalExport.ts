import type { JournalEntry } from '@portfolio-engineering/shared-types/journal'
import { formatWeekRangeForDisplay, getWeekBounds } from './journalDates'

/**
 * Journal Export Module
 * Serializes journal entries into canonical Markdown format for clipboard and file exports.
 */

export interface ExportOptions {
  scope: 'day' | 'week' | 'month' | 'all' | 'selected'
  date?: string // YYYY-MM-DD (for day scope)
  weekStart?: string // Sunday YYYY-MM-DD (for week scope)
  month?: string // YYYY-MM (for month scope)
  selectedDates?: string[] // YYYY-MM-DD dates for a selected review-table export
  selectedSourceScope?: 'week' | 'month' | 'all'
}

/**
 * Generate deterministic Markdown from entries
 * Entries are sorted chronologically (oldest first), with date headers and metadata.
 */
export function serializeToMarkdown(entries: JournalEntry[], options: ExportOptions): string {
  if (entries.length === 0) {
    return generateEmptyMessage(options)
  }

  // Sort entries by date (oldest first for chronological narrative)
  const sorted = [...entries].sort((a, b) => a.localDate.localeCompare(b.localDate))

  // Group by date for output
  const lines: string[] = []

  // Add header
  lines.push(generateHeader(options))
  lines.push('')

  // Add metadata
  lines.push(generateMetadata(options, sorted))
  lines.push('')

  // Add entries
  for (const entry of sorted) {
    lines.push(`## ${formatDateForMarkdown(entry.localDate)}`)
    lines.push('')
    lines.push(entry.content)
    lines.push('')
  }

  return lines.join('\n').trim() + '\n'
}

/**
 * Generate appropriate filename based on export scope and date range
 */
export function generateFilename(options: ExportOptions): string {
  switch (options.scope) {
    case 'day':
      return `journal-${options.date || 'today'}.md`
    case 'week':
      return getWeekFilename(options)
    case 'month':
      return `journal-${options.month || 'current'}.md`
    case 'all':
      return 'journal-all.md'
    case 'selected':
      return getSelectedFilename(options)
    default:
      return 'journal-export.md'
  }
}

/**
 * Copy Markdown to browser clipboard
 * Returns true on success, false on failure.
 */
export async function copyToClipboard(markdown: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(markdown)
      return true
    }
  } catch (err) {
    console.error('Clipboard write failed:', err)
  }

  // Fallback: try to use deprecated API or textarea
  try {
    const textarea = document.createElement('textarea')
    textarea.value = markdown
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err)
    return false
  }
}

/**
 * Trigger browser download of Markdown file
 */
export function downloadAsMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.position = 'fixed'
  link.style.opacity = '0'
  document.body.appendChild(link)

  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// --- Helpers ---

function generateHeader(options: ExportOptions): string {
  switch (options.scope) {
    case 'day':
      return `# Journal Entry — ${formatDateForMarkdown(options.date || '')}`
    case 'week':
      return `# Journal — ${options.weekStart ? formatWeekRangeForDisplay(options.weekStart) : 'Current Week'}`
    case 'month':
      return `# Journal — ${options.month || 'Current Month'}`
    case 'all':
      return '# Complete Journal'
    case 'selected':
      return getSelectedHeader(options)
    default:
      return '# Journal Export'
  }
}

function generateMetadata(options: ExportOptions, entries: JournalEntry[]): string {
  const lines: string[] = []
  const now = new Date().toISOString()

  lines.push('---')
  lines.push(`export_date: ${now}`)
  lines.push(`export_scope: ${options.scope}`)

  if (options.date) lines.push(`date: ${options.date}`)
  if (options.weekStart) {
    const { start, end } = getWeekBounds(options.weekStart)
    lines.push(`week_start: ${start}`)
    lines.push(`week_end: ${end}`)
    lines.push('week_semantics: sunday-through-saturday')
  }
  if (options.month) lines.push(`month: ${options.month}`)
  if (options.selectedDates?.length) {
    lines.push(`selected_dates: ${[...options.selectedDates].sort().join(', ')}`)
  }
  if (options.scope === 'selected' && options.selectedSourceScope) {
    lines.push(`selected_source_scope: ${options.selectedSourceScope}`)
  }

  lines.push(`entry_count: ${entries.length}`)

  if (entries.length > 0) {
    const dates = entries.map((e) => e.localDate).sort()
    lines.push(`date_range: ${dates[0]} to ${dates[dates.length - 1]}`)
  }

  lines.push('---')

  return lines.join('\n')
}

function generateEmptyMessage(options: ExportOptions): string {
  let message = 'No entries to export'

  switch (options.scope) {
    case 'day':
      message = `No entry recorded for ${options.date}.`
      break
    case 'week':
      message = options.weekStart
        ? `No entries recorded for ${formatWeekRangeForDisplay(options.weekStart)}.`
        : 'No entries recorded for the current week.'
      break
    case 'month':
      message = `No entries recorded for month ${options.month}.`
      break
    case 'all':
      message = 'No entries recorded in journal yet.'
      break
    case 'selected':
      message = 'No entries selected for export.'
      break
  }

  return `# Journal Export\n\n${message}\n`
}

function formatDateForMarkdown(dateStr: string): string {
  if (!dateStr) return 'Unknown Date'

  const date = new Date(`${dateStr}T00:00:00Z`)
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getWeekFilename(options: ExportOptions): string {
  if (!options.weekStart) {
    return 'journal-week-current.md'
  }

  const { start, end } = getWeekBounds(options.weekStart)
  return `journal-week-${start}-to-${end}.md`
}

function getSelectedFilename(options: ExportOptions): string {
  switch (options.selectedSourceScope) {
    case 'week':
      return `${getWeekFilename(options).replace(/\.md$/, '')}-selected.md`
    case 'month':
      return `journal-${options.month || 'current'}-selected.md`
    case 'all': {
      const dates = [...(options.selectedDates || [])].sort()
      const range = dates.length > 0
        ? `${dates[0]}-to-${dates[dates.length - 1]}`
        : 'unknown-range'
      return `journal-all-selected-${range}.md`
    }
    default:
      return 'journal-selected.md'
  }
}

function getSelectedHeader(options: ExportOptions): string {
  switch (options.selectedSourceScope) {
    case 'week':
      return options.weekStart
        ? `# Journal — Selected Entries from ${formatWeekRangeForDisplay(options.weekStart)}`
        : '# Journal — Selected Week Entries'
    case 'month':
      return `# Journal — Selected Entries from ${options.month || 'Current Month'}`
    case 'all':
      return '# Journal — Selected Entries from Complete Journal'
    default:
      return '# Journal — Selected Entries'
  }
}
