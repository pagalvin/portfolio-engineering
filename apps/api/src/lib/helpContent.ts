import type { HelpContentPayload, HelpIndex, HelpIndexEntry } from '@portfolio-engineering/shared-types'
import {
  helpContentPayloadSchema,
  helpIndexSchema,
  type HelpIndexInput,
} from '@portfolio-engineering/validation'
import { bundledHelpContent, bundledHelpIndex } from './bundledHelp.js'

export const HELP_CHANNEL_ID = 'help'
export const DEFAULT_APP_VERSION = '1.0.0'
export const HELP_SOURCE_BASE_URL =
  'https://raw.githubusercontent.com/pagalvin/portfolio-engineering/main/'
const INDEX_PATH = 'content/help/index.json'
const MAX_INDEX_BYTES = 256 * 1024
const SAFE_MARKDOWN_LINK = /^\s*\]\((https?:\/\/[^)\s]+|\/[^)\s]+|#[-a-zA-Z0-9_]+)\s*\)$/
const SAFE_IMAGE = /^\s*!\[[^\]]*]\((https:\/\/raw\.githubusercontent\.com\/pagalvin\/portfolio-engineering\/main\/content\/help\/[^)\s]+)\)\s*$/

export interface HelpPayload {
  index: HelpIndex
  content: HelpContentPayload
}

export interface ResolvedHelpEntry {
  entry: HelpIndexEntry
  redirectTo?: string
  unavailable: boolean
}

export interface HelpContentSource {
  kind: 'remote' | 'bundled' | 'cache'
  fetchedAt?: Date
}

export interface LoadedHelpContent extends HelpPayload {
  source: HelpContentSource
}

export type HelpFetcher = (url: string) => Promise<string>

export class HelpContentValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'HelpContentValidationError'
  }
}

function compareSemver(left: string, right: string): number {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function isSafeMarkdown(markdown: string): boolean {
  if (/<\s*(script|iframe|object|embed|style|form)\b/i.test(markdown)) return false
  if (/\b(?:javascript|data|vbscript):/i.test(markdown)) return false
  const images = markdown.match(/!\[[^\]]*]\([^)]*\)/g) ?? []
  if (!images.every((image) => SAFE_IMAGE.test(image))) return false
  const links = markdown.match(/\]\([^)]*\)/g) ?? []
  return links.every((link) => SAFE_MARKDOWN_LINK.test(link) || SAFE_IMAGE.test(link))
}

function assertPayloadSize(index: unknown, content: HelpContentPayload): void {
  if (Buffer.byteLength(JSON.stringify(index), 'utf8') > MAX_INDEX_BYTES) {
    throw new Error('Help index exceeds the permitted size.')
  }
  if (Buffer.byteLength(JSON.stringify(content), 'utf8') > 5 * 1024 * 1024) {
    throw new Error('Help content exceeds the permitted size.')
  }
}

export function parseHelpIndex(input: unknown): HelpIndex {
  return helpIndexSchema.parse(input)
}

export function selectEligibleEntries(index: HelpIndex, appVersion = DEFAULT_APP_VERSION): HelpIndexEntry[] {
  const selected = new Map<string, HelpIndexEntry>()
  for (const entry of index.entries) {
    if (compareSemver(entry.minAppVersion, appVersion) > 0) continue
    const current = selected.get(entry.key)
    if (!current || compareSemver(entry.minAppVersion, current.minAppVersion) > 0) {
      selected.set(entry.key, entry)
    }
  }
  return [...selected.values()]
}

export function resolveHelpKey(
  index: HelpIndex,
  key: string,
  appVersion = DEFAULT_APP_VERSION,
): ResolvedHelpEntry | null {
  const entries = selectEligibleEntries(index, appVersion)
  const direct = entries.find((entry) => entry.key === key)
  const entry = direct ?? entries.find((candidate) => candidate.aliases.includes(key))
  if (!entry) return null
  if (entry.status === 'redirect') {
    return { entry, redirectTo: entry.replacementKey, unavailable: false }
  }
  return { entry, unavailable: entry.status === 'unavailable' }
}

export function validateHelpPayload(indexInput: unknown, contentInput: unknown): HelpPayload {
  const index = helpIndexSchema.parse(indexInput)
  const content = helpContentPayloadSchema.parse(contentInput)
  assertPayloadSize(index, content)
  const seenPaths = new Set<string>()
  for (const entry of index.entries) {
    if (entry.status !== 'active') continue
    if (!entry.path || seenPaths.has(entry.path)) {
      throw new Error(`Invalid or duplicate help content path for ${entry.key}.`)
    }
    seenPaths.add(entry.path)
    if (entry.type === 'page') {
      const value = content.pages[entry.key]
      if (!value) throw new Error(`Missing content for ${entry.key}.`)
      if (!isSafeMarkdown(value.markdown)) throw new Error(`Unsafe Markdown content for ${entry.key}.`)
    } else {
      const value = content.tooltips[entry.key]
      if (!value) throw new Error(`Missing content for ${entry.key}.`)
      if ([...value.text].some((character) => {
        const code = character.charCodeAt(0)
        return code < 32 && code !== 9 && code !== 10 && code !== 13
      })) {
        throw new Error(`Invalid plain-text tooltip for ${entry.key}.`)
      }
    }
  }
  return { index, content }
}

async function defaultFetch(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Help source returned HTTP ${response.status}.`)
  return response.text()
}

function sourceUrl(path: string): string {
  // The path has already been schema validated; this second boundary prevents
  // future callers from turning repository content into an arbitrary URL.
  if (!/^content\/help\/(?:pages|tooltips)\/[a-z0-9][a-z0-9/_.-]*\.(?:md|txt)$/.test(path)) {
    throw new Error('Help source path is not allowlisted.')
  }
  return `${HELP_SOURCE_BASE_URL}${path}`
}

export async function loadHelpContent(
  appVersion = DEFAULT_APP_VERSION,
  fetcher: HelpFetcher = defaultFetch,
): Promise<LoadedHelpContent> {
  try {
    return await loadRemoteHelpContent(appVersion, fetcher)
  } catch {
    const bundled = validateHelpPayload(bundledHelpIndex, bundledHelpContent)
    return { ...bundled, source: { kind: 'bundled' } }
  }
}

/**
 * Loads only the remote source. Refresh callers use this boundary so a
 * network or validation failure cannot accidentally be written as a bundled
 * replacement for a valid cache.
 */
export async function loadRemoteHelpContent(
  appVersion = DEFAULT_APP_VERSION,
  fetcher: HelpFetcher = defaultFetch,
): Promise<LoadedHelpContent> {
  const rawIndex = await fetcher(`${HELP_SOURCE_BASE_URL}${INDEX_PATH}`)
  let index: HelpIndex
  try {
    index = parseHelpIndex(JSON.parse(rawIndex) as HelpIndexInput)
  } catch (error) {
    throw new HelpContentValidationError('Help index failed validation.', { cause: error })
  }
  const selected = selectEligibleEntries(index, appVersion).filter((entry) => entry.status === 'active')
  const pages: HelpContentPayload['pages'] = {}
  const tooltips: HelpContentPayload['tooltips'] = {}
  for (const entry of selected) {
    if (!entry.path) throw new Error(`Missing path for ${entry.key}.`)
    const value = await fetcher(sourceUrl(entry.path))
    if (entry.type === 'page') pages[entry.key] = { markdown: value }
    else tooltips[entry.key] = { text: value }
  }
  const selectedIndex: HelpIndex = {
    ...index,
    entries: [...selected, ...index.entries.filter((entry) => entry.status !== 'active')],
  }
  let validated: HelpPayload
  try {
    validated = validateHelpPayload(selectedIndex, { pages, tooltips })
  } catch (error) {
    throw new HelpContentValidationError('Help content failed validation.', { cause: error })
  }
  return { ...validated, source: { kind: 'remote', fetchedAt: new Date() } }
}
