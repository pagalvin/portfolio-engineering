export function formatAttemptDate(value: string | null): string {
  if (!value) return 'Help content has not been refreshed yet.'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Help content has not been refreshed yet.'
  return `Last help refresh attempted: ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)}`
}

export function refreshAnnouncement(
  state: 'idle' | 'refreshing' | 'success' | 'failure',
): string {
  if (state === 'refreshing') return 'Refreshing help content.'
  if (state === 'success') return 'Help content refreshed.'
  if (state === 'failure') return 'Help content could not be refreshed. Existing help remains available.'
  return ''
}
