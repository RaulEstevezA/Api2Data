import { useState } from 'react'
import { newRowId } from '../app/draft.ts'
import type { KeyValue } from '../core/http/types.ts'
import { useI18n } from '../i18n/useI18n.ts'
import './KeyValueEditor.css'

/** Key / value rows that can be added, removed and switched off. The last row is always empty: typing in it
 * creates a new row, so there is no "Add" button to look for. */
export function KeyValueEditor({
  rows,
  onChange,
  label,
}: {
  rows: readonly KeyValue[]
  onChange: (rows: KeyValue[]) => void
  label: string
}) {
  const { t } = useI18n()
  // The empty row already has the id it will keep once filled in, so the input keeps the focus
  const [blankId, setBlankId] = useState(newRowId)

  const update = (id: string, change: Partial<KeyValue>) => onChange(rows.map((row) => (row.id === id ? { ...row, ...change } : row)))
  const remove = (id: string) => onChange(rows.filter((row) => row.id !== id))
  const fillBlank = (change: Partial<KeyValue>) => {
    onChange([...rows, { id: blankId, key: '', value: '', enabled: true, ...change }])
    setBlankId(newRowId())
  }

  const all = [...rows, { id: blankId, key: '', value: '', enabled: true }]

  return (
    <div className="kv" role="group" aria-label={label}>
      {all.map((row, index) => {
        const blank = row.id === blankId
        const onEdit = blank ? fillBlank : (change: Partial<KeyValue>) => update(row.id, change)
        return (
          <div key={row.id} className={`kv__row${row.enabled ? '' : ' kv__row--off'}`}>
            {blank ? (
              <span className="kv__check" />
            ) : (
              <input
                type="checkbox"
                className="kv__check"
                checked={row.enabled}
                aria-label={t.enableRow(row.key)}
                onChange={(event) => update(row.id, { enabled: event.target.checked })}
              />
            )}
            <input
              className="input input--mono kv__key"
              value={row.key}
              placeholder={t.keyPlaceholder}
              aria-label={t.keyOf(index + 1)}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => onEdit({ key: event.target.value })}
            />
            <input
              className="input input--mono kv__value"
              value={row.value}
              placeholder={t.valuePlaceholder}
              aria-label={t.valueOf(index + 1)}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => onEdit({ value: event.target.value })}
            />
            {blank ? (
              <span className="kv__remove" />
            ) : (
              <button
                type="button"
                className="button button--small kv__remove"
                aria-label={t.removeRow(row.key)}
                onClick={() => remove(row.id)}
              >
                {t.remove}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
