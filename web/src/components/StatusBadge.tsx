import { reasonPhrase, statusClass, type StatusClass } from '../core/response/status.ts'

const CLASSES: Record<StatusClass, string> = {
  informational: 'badge',
  success: 'badge badge--success',
  redirect: 'badge badge--accent',
  clientError: 'badge badge--warning',
  serverError: 'badge badge--danger',
}

/** HTTP status with its text, never only its color: "200 OK", "404 Not Found". */
export function StatusBadge({ status, reason, className = '' }: { status: number; reason?: string; className?: string }) {
  const text = reason ?? reasonPhrase(status)
  return (
    <span className={`${CLASSES[statusClass(status)]} status-badge ${className}`.trim()}>
      {status}
      {text && ` ${text}`}
    </span>
  )
}
