import type { ProcessedResponse } from '../core/response/process.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { formatBytes, formatDuration } from '../utils/format.ts'
import { StatusBadge } from './StatusBadge.tsx'
import './ResponseSummary.css'

/** Status, time, size and type at a glance. The status always carries its text, not only its color. */
export function ResponseSummary({ response }: { response: ProcessedResponse }) {
  const { t, language } = useI18n()
  return (
    <div className="response-summary">
      <dl className="response-summary__list">
        <div>
          <dt>{t.statusLabel}</dt>
          <dd>
            <StatusBadge status={response.status} reason={response.reason} className="response-summary__status" />
          </dd>
        </div>
        <div>
          <dt>{t.timeLabel}</dt>
          <dd className="mono">{formatDuration(response.durationMs, language)}</dd>
        </div>
        <div>
          <dt>{t.sizeLabel}</dt>
          <dd className="mono" title={t.sizeHint}>
            {formatBytes(response.size, language)}
          </dd>
        </div>
        <div>
          <dt>{t.typeLabel}</dt>
          <dd className="mono">{response.contentType?.mediaType ?? t.noContentType}</dd>
        </div>
      </dl>
      {response.redirected && (
        <p className="response-summary__redirect">
          {t.redirectedTo} <span className="mono">{response.url}</span>
        </p>
      )}
    </div>
  )
}
