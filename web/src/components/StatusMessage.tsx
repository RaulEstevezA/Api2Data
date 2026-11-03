import './StatusMessage.css'

export interface Status {
  tone: 'success' | 'error'
  text: string
  /** What the user should know about the result (parts that could not be imported) */
  details?: string[]
}

/** Result of the last action (import, save), in the flow of the page: no floating notifications. */
export function StatusMessage({ status }: { status: Status | null }) {
  if (!status) return null
  if (status.tone === 'error')
    return (
      <p className="status-message status-message--error" role="alert">
        {status.text}
      </p>
    )
  return (
    <div className="status-message" role="status">
      <p className="status-message__text">{status.text}</p>
      {status.details && status.details.length > 0 && (
        <ul className="status-message__details">
          {status.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
