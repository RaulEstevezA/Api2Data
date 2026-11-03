import type { ProcessedResponse } from '../core/response/process.ts'
import type { StatusClass } from '../core/response/status.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { formatBytes, formatDuration } from '../utils/format.ts'
import './ResponseSummary.css'

const STATUS_BADGE: Record<StatusClass, string> = {
  informational: 'badge',
  success: 'badge badge--success',
  redirect: 'badge badge--accent',
  clientError: 'badge badge--warning',
  serverError: 'badge badge--danger',
}

/** Status, time, size and type at a glance. The status always carries its text, not only its color. */
export function ResponseSummary({ response }: { response: ProcessedResponse }) {
  const { t, language } = useI18n()
  return (
    <div className="response-summary">
      <dl className="response-summary__list">
        <div>
          <dt>{t.statusLabel}</dt>
          <dd>
            <span className={`${STATUS_BADGE[response.statusClass]} response-summary__status`}>
              {response.status}
              {response.reason && ` ${response.reason}`}
            </span>
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
