import { useState } from 'react'
import { curlCommand } from '../core/codegen/curl.ts'
import type { SendFailure } from '../core/execute/transport.ts'
import type { HttpResponse, PreparedRequest } from '../core/http/types.ts'
import { parseRawResponse } from '../core/import/rawResponse.ts'
import { useCopyFeedback } from '../hooks/useCopyFeedback.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { DESKTOP_RELEASED } from '../utils/desktopDownload.ts'
import { hostOf } from '../utils/format.ts'
import { DesktopDownload } from './DesktopDownload.tsx'
import './RequestFailure.css'

// Failures the browser causes, which a request sent from outside it avoids
const OUTSIDE_THE_BROWSER = new Set<SendFailure['kind']>(['blocked', 'mixedContent'])

/** Send the request with curl and paste its output: the response is then shown as if it had been received here. */
function CurlOption({ request, onPaste }: { request: PreparedRequest; onPaste: (response: HttpResponse) => void }) {
  const { t } = useI18n()
  const { copied, copy } = useCopyFeedback()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<'empty' | 'noStatus' | null>(null)

  function show() {
    const result = parseRawResponse(text, request.url)
    if (result.ok) onPaste(result.response)
    else setProblem(result.problem)
  }

  return (
    <section className="failure-option">
      <h4 className="failure-option__title">{t.curlOptionTitle}</h4>
      <p className="failure-option__text">{t.curlOptionText}</p>
      <div className="actions">
        <button type="button" className="button" onClick={() => copy(curlCommand(request, { include: true }))}>
          {copied ? t.copied : t.copyCurl}
        </button>
        <button type="button" className="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {t.pasteResponse}
        </button>
      </div>
      {open && (
        <div className="failure-option__paste">
          <label className="field">
            <span>{t.pasteLabel}</span>
            <textarea
              className="textarea failure-option__textarea"
              value={text}
              placeholder={t.pastePlaceholder}
              spellCheck={false}
              autoFocus
              onChange={(event) => {
                setText(event.target.value)
                setProblem(null)
              }}
            />
          </label>
          {problem && (
            <p className="failure-option__error" role="alert">
              {t.pasteProblem(problem)}
            </p>
          )}
          <div className="actions failure-option__actions">
            <button type="button" className="button" onClick={() => setOpen(false)}>
              {t.cancel}
            </button>
            <button type="button" className="button button--primary" disabled={!text.trim()} onClick={show}>
              {t.showResponse}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Why there is no response, in words (the browser only gives "Failed to fetch"), and how to get it anyway. */
export function RequestFailure({
  failure,
  request,
  onPaste,
}: {
  failure: SendFailure
  request: PreparedRequest
  onPaste: (response: HttpResponse) => void
}) {
  const { t } = useI18n()
  if (failure.kind === 'aborted') return <p className="request-failure__muted">{t.responseCancelled}</p>
  const message = t.failure(failure, hostOf(request.url))
  return (
    <div className="request-failure__wrap">
      <div className="request-failure" role="alert">
        <h3 className="request-failure__title">{message.title}</h3>
        <p>{message.text}</p>
        {message.causes && (
          <ul>
            {message.causes.map((cause) => (
              <li key={cause}>{cause}</li>
            ))}
          </ul>
        )}
        {message.tip && <p className="request-failure__tip">{message.tip}</p>}
      </div>

      {OUTSIDE_THE_BROWSER.has(failure.kind) && (
        <div className="request-failure__options">
          <h3 className="request-failure__options-title">{t.failureOptions}</h3>
          <CurlOption request={request} onPaste={onPaste} />
          {DESKTOP_RELEASED && (
            <section className="failure-option">
              <h4 className="failure-option__title">{t.desktopOptionTitle}</h4>
              <p className="failure-option__text">{t.desktopOptionText}</p>
              <DesktopDownload />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
