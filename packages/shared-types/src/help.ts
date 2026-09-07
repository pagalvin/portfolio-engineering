export type HelpEntryType = 'page' | 'tooltip'
export type HelpEntryStatus = 'active' | 'redirect' | 'unavailable'

export interface HelpIndexEntry {
  key: string
  title?: string
  type: HelpEntryType
  path?: string
  group?: string
  parentKey?: string
  order?: number
  minAppVersion: string
  aliases: string[]
  status: HelpEntryStatus
  replacementKey?: string
  relatedPageKey?: string
}

export interface HelpIndex {
  schemaVersion: number
  contentVersion: string
  entries: HelpIndexEntry[]
}

export interface HelpContentPayload {
  pages: Record<string, { markdown: string }>
  tooltips: Record<string, { text: string }>
}

