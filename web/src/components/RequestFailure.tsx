import type { SendFailure } from '../core/execute/transport.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { hostOf } from '../utils/format.ts'
import './RequestFailure.css'

/** Why there is no response, in words: the browser only gives "Failed to fetch". */
export function RequestFailure({ failure, url }: { failure: SendFailure; url: string }) {
  const { t } = useI18n()
  if (failure.kind === 'aborted') return <p className="request-failure__muted">{t.responseCancelled}</p>
  const message = t.failure(failure, hostOf(url))
  return (
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
  )
}
