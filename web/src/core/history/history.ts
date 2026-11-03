import type { SendFailure } from '../execute/transport.ts'
import type { RequestDraft } from '../http/types.ts'
import { readDraft, toStoredDraft, type StoredDraft } from '../request/draftFormat.ts'

/** What happened to the request: the status code, or why there was no response. */
export type HistoryOutcome = { status: number } | { failure: SendFailure['kind'] }

export interface HistoryEntry {
  id: string
  /** ISO date and time of the request */
  sentAt: string
  draft: RequestDraft
  outcome: HistoryOutcome
  /** Saved with tokens, passwords and keys because the user chose to */
  withCredentials: boolean
}

export const HISTORY_FORMAT_VERSION = 1
export const MAX_HISTORY_ENTRIES = 50

/** Same request, ignoring row ids: sending it again replaces the entry instead of repeating it. */
function sameRequest(a: RequestDraft, b: RequestDraft): boolean {
  return JSON.stringify(toStoredDraft(a)) === JSON.stringify(toStoredDraft(b))
}

/** The newest entry first. Repeating the latest request updates it; the oldest entries go beyond the limit. */
export function addEntry(entries: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const rest =
    entries[0] && sameRequest(entries[0].draft, entry.draft) && entries[0].withCredentials === entry.withCredentials
      ? entries.slice(1)
      : entries
  return [entry, ...rest].slice(0, MAX_HISTORY_ENTRIES)
}

export function removeEntry(entries: readonly HistoryEntry[], id: string): HistoryEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

interface StoredEntry {
  sentAt: string
  draft: StoredDraft
  outcome: HistoryOutcome
  withCredentials: boolean
}

export function serializeHistory(entries: readonly HistoryEntry[]): string {
  const stored: StoredEntry[] = entries.map(({ sentAt, draft, outcome, withCredentials }) => ({
    sentAt,
    draft: toStoredDraft(draft),
    outcome,
    withCredentials,
  }))
  return JSON.stringify({ version: HISTORY_FORMAT_VERSION, entries: stored })
}

function readOutcome(value: unknown): HistoryOutcome | null {
  if (typeof value !== 'object' || value === null) return null
  const outcome = value as Record<string, unknown>
  if (typeof outcome.status === 'number' && Number.isInteger(outcome.status)) return { status: outcome.status }
  if (['aborted', 'offline', 'mixedContent', 'blocked', 'interrupted'].includes(outcome.failure as string))
    return { failure: outcome.failure as SendFailure['kind'] }
  return null
}

export type HistoryReadResult = { ok: true; entries: HistoryEntry[] } | { ok: false; reason: 'version' | 'damaged' }

/** Reads the saved history. A different format version or damaged data is reported, never silently dropped:
 * the interface tells the user before starting a new history. Entries that cannot be read are skipped. */
export function parseHistory(text: string | null, newId: () => string): HistoryReadResult {
  if (text === null) return { ok: true, entries: [] }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'damaged' }
  }
  if (typeof data !== 'object' || data === null) return { ok: false, reason: 'damaged' }
  const { version, entries } = data as Record<string, unknown>
  if (version !== HISTORY_FORMAT_VERSION) return { ok: false, reason: 'version' }
  if (!Array.isArray(entries)) return { ok: false, reason: 'damaged' }
  const result: HistoryEntry[] = []
  for (const item of entries.slice(0, MAX_HISTORY_ENTRIES)) {
    if (typeof item !== 'object' || item === null) continue
    const stored = item as Record<string, unknown>
    const draft = readDraft(stored.draft, newId)
    const outcome = readOutcome(stored.outcome)
    if (!draft || !outcome || typeof stored.sentAt !== 'string' || Number.isNaN(Date.parse(stored.sentAt))) continue
    result.push({ id: newId(), sentAt: stored.sentAt, draft, outcome, withCredentials: stored.withCredentials === true })
  }
  return { ok: true, entries: result }
}
