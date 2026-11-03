import type { KeyValue } from './types.ts'

/** Row ids only need to be unique inside one table; the counter is passed in so the core keeps no state. */
export function createRow(id: string, key = '', value = '', enabled = true): KeyValue {
  return { id, key, value, enabled }
}

/** Rows that will be sent: enabled and with a name. A row with only a value is an unfinished edit. */
export function activeRows(rows: readonly KeyValue[]): KeyValue[] {
  return rows.filter((row) => row.enabled && row.key.trim() !== '')
}
