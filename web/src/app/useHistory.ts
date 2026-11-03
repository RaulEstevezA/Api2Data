import { useCallback, useState } from 'react'
import { addEntry, removeEntry, type HistoryEntry, type HistoryOutcome } from '../core/history/history.ts'
import type { HistoryStore } from '../core/history/store.ts'
import type { RequestDraft } from '../core/http/types.ts'
import { hasCredentials, redactDraft } from '../core/request/redact.ts'
import { useStoredState } from '../hooks/useStoredState.ts'
import { newRowId } from './draft.ts'

/** Something to tell about the saved history: it could not be read, or the browser does not keep it. */
export type HistoryNotice = 'version' | 'damaged' | 'unavailable' | null

/** The local history of sent requests. Saved in this browser only; tokens, passwords and keys are left out unless
 * the user chooses to keep them. */
export function useHistory(store: HistoryStore) {
  const [enabled, setEnabled] = useStoredState('api2data.history.enabled', () => true)
  const [keepCredentials, setKeepCredentials] = useStoredState('api2data.history.credentials', () => false)
  // Read once: a history that cannot be read is reported, and a new one starts
  const [initial] = useState(() => store.load(newRowId))
  const [notice, setNotice] = useState<HistoryNotice>(initial.ok ? null : initial.reason)
  const [entries, setEntries] = useState<HistoryEntry[]>(initial.ok ? initial.entries : [])

  const persist = useCallback(
    (next: HistoryEntry[]) => {
      setEntries(next)
      if (!store.save(next)) setNotice('unavailable')
    },
    [store],
  )

  const record = useCallback(
    (draft: RequestDraft, outcome: HistoryOutcome) => {
      if (!enabled) return
      const withCredentials = keepCredentials && hasCredentials(draft)
      const entry: HistoryEntry = {
        id: newRowId(),
        sentAt: new Date().toISOString(),
        draft: withCredentials ? draft : redactDraft(draft),
        outcome,
        withCredentials,
      }
      setEntries((current) => {
        const next = addEntry(current, entry)
        if (!store.save(next)) setNotice('unavailable')
        return next
      })
    },
    [enabled, keepCredentials, store],
  )

  /** Turning credentials off also removes them from the entries already saved. */
  const changeKeepCredentials = useCallback(
    (keep: boolean) => {
      setKeepCredentials(keep)
      if (!keep && entries.some((entry) => entry.withCredentials))
        persist(
          entries.map((entry) => (entry.withCredentials ? { ...entry, draft: redactDraft(entry.draft), withCredentials: false } : entry)),
        )
    },
    [entries, persist, setKeepCredentials],
  )

  return {
    entries,
    enabled,
    setEnabled,
    keepCredentials,
    setKeepCredentials: changeKeepCredentials,
    notice,
    dismissNotice: () => setNotice(null),
    record,
    remove: (id: string) => persist(removeEntry(entries, id)),
    clear: () => {
      store.clear()
      setEntries([])
    },
  }
}
