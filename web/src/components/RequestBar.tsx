import type { FormEvent } from 'react'
import { HTTP_METHODS, isHttpMethod, type HttpMethod } from '../core/http/methods.ts'
import { looksLikeCurl } from '../core/import/curl.ts'
import type { RequestIssue } from '../core/request/build.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { IssueList } from './IssueList.tsx'
import { StatusMessage, type Status } from './StatusMessage.tsx'
import './RequestBar.css'

/** Method, address and Send: the whole request for most uses. */
export function RequestBar({
  method,
  url,
  sending,
  issues,
  status,
  onMethod,
  onUrl,
  onSend,
  onCancel,
}: {
  method: HttpMethod
  url: string
  sending: boolean
  /** Problems to show under the bar */
  issues: readonly RequestIssue[]
  /** Result of the last import or save */
  status: Status | null
  onMethod: (method: HttpMethod) => void
  onUrl: (url: string) => void
  onSend: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!sending) onSend()
  }

  return (
    <form className="request-bar panel" aria-label={t.requestBarLabel} onSubmit={submit}>
      <div className="request-bar__row">
        <select
          className="select request-bar__method"
          aria-label={t.methodLabel}
          value={method}
          onChange={(event) => isHttpMethod(event.target.value) && onMethod(event.target.value)}
        >
          {HTTP_METHODS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          className="input input--mono request-bar__url"
          type="text"
          inputMode="url"
          aria-label={t.urlLabel}
          placeholder={t.urlPlaceholder}
          value={url}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onChange={(event) => onUrl(event.target.value)}
          onPaste={(event) => {
            // A text field drops line breaks, which multi-line cURL commands need: read what was copied instead
            const text = event.clipboardData.getData('text')
            if (!looksLikeCurl(text)) return
            event.preventDefault()
            onUrl(text)
          }}
        />
        <div className="request-bar__actions">
          {sending && (
            <button type="button" className="button" onClick={onCancel}>
              {t.cancel}
            </button>
          )}
          <button type="submit" className="button button--primary request-bar__send" disabled={sending} title={t.sendShortcut}>
            {sending ? t.sending : t.send}
          </button>
        </div>
      </div>
      <StatusMessage status={status} />
      <IssueList issues={issues} />
    </form>
  )
}
