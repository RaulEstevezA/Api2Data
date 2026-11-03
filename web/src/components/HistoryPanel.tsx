import type { HistoryNotice } from '../app/useHistory.ts'
import type { HistoryEntry } from '../core/history/history.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { formatWhen } from '../utils/format.ts'
import { StatusBadge } from './StatusBadge.tsx'
import './HistoryPanel.css'

interface HistoryPanelProps {
  entries: readonly HistoryEntry[]
  enabled: boolean
  keepCredentials: boolean
  notice: HistoryNotice
  onEnabled: (enabled: boolean) => void
  onKeepCredentials: (keep: boolean) => void
  onDismissNotice: () => void
  onLoad: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}

/** Requests sent before, folded into one line until it is opened. Clicking one loads it into the request. */
export function HistoryPanel(props: HistoryPanelProps) {
  const { entries, enabled, keepCredentials, notice } = props
  const { t, language } = useI18n()

  return (
    <details className="history panel">
      <summary className="history__summary">{t.historyTitle(entries.length)}</summary>
      <div className="history__content">
        {notice && (
          <div className="alert alert--warning history__notice" role="status">
            <span>{t.historyNotice[notice]}</span>
            <button type="button" className="button button--small" onClick={props.onDismissNotice}>
              {t.dismiss}
            </button>
          </div>
        )}

        <div className="history__options">
          <label className="check">
            <input type="checkbox" checked={enabled} onChange={(event) => props.onEnabled(event.target.checked)} />
            {t.historySave}
          </label>
          <p className="field__hint">{t.historySaveHint}</p>
          <label className="check">
            <input
              type="checkbox"
              checked={keepCredentials}
              disabled={!enabled}
              onChange={(event) => props.onKeepCredentials(event.target.checked)}
            />
            {t.historyCredentials}
          </label>
          <p className="field__hint">{t.historyCredentialsHint}</p>
        </div>

        {entries.length === 0 ? (
          <p className="history__empty">{enabled ? t.historyEmpty : t.historyOff}</p>
        ) : (
          <ul className="history__list">
            {entries.map((entry) => (
              <li key={entry.id} className="history__item">
                <button
                  type="button"
                  className="history__load"
                  aria-label={t.historyLoad(entry.draft.method, entry.draft.url)}
                  onClick={() => props.onLoad(entry)}
                >
                  <span className="history__method">{entry.draft.method}</span>
                  <span className="history__url">{entry.draft.url}</span>
                  {'status' in entry.outcome ? (
                    <StatusBadge status={entry.outcome.status} reason="" />
                  ) : (
                    <span className="badge">{t.historyNoResponse}</span>
                  )}
                  {entry.withCredentials && <span className="badge badge--warning">{t.historyWithCredentials}</span>}
                  <time className="history__time" dateTime={entry.sentAt}>
                    {formatWhen(entry.sentAt, language)}
                  </time>
                </button>
                <button
                  type="button"
                  className="button button--small"
                  aria-label={t.historyRemove(entry.draft.method, entry.draft.url)}
                  onClick={() => props.onRemove(entry.id)}
                >
                  {t.remove}
                </button>
              </li>
            ))}
          </ul>
        )}

        {entries.length > 0 && (
          <div className="history__actions">
            <button type="button" className="button" onClick={() => window.confirm(t.historyClearConfirm) && props.onClear()}>
              {t.historyClear}
            </button>
          </div>
        )}
      </div>
    </details>
  )
}
