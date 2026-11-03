import { parseHistory, serializeHistory, type HistoryEntry, type HistoryReadResult } from './history.ts'

export const HISTORY_KEY = 'api2data.history'

export interface HistoryStore {
  load(newId: () => string): HistoryReadResult
  /** False when the browser cannot keep it (storage blocked or full) */
  save(entries: readonly HistoryEntry[]): boolean
  clear(): void
}

/** Keeps the history in the given Web Storage (localStorage in the browser, a fake in the tests). Never throws:
 * without storage the history lasts as long as the tab. */
export function createHistoryStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, key = HISTORY_KEY): HistoryStore {
  return {
    load(newId) {
      try {
        return parseHistory(storage.getItem(key), newId)
      } catch {
        return { ok: true, entries: [] }
      }
    },
    save(entries) {
      try {
        if (entries.length === 0) storage.removeItem(key)
        else storage.setItem(key, serializeHistory(entries))
        return true
      } catch {
        return false
      }
    },
    clear() {
      try {
        storage.removeItem(key)
      } catch {
        // Nothing stored to clear
      }
    },
  }
}
