import type { RequestIssue } from '../core/request/build.ts'
import { useI18n } from '../i18n/useI18n.ts'
import './IssueList.css'

/** Problems found in the request: errors in red (they stop it), notices in yellow (they only inform). */
export function IssueList({ issues }: { issues: readonly RequestIssue[] }) {
  const { t } = useI18n()
  if (issues.length === 0) return null
  const errors = issues.filter((issue) => issue.level === 'error')
  const notices = issues.filter((issue) => issue.level === 'notice')
  return (
    <>
      {errors.length > 0 && (
        <ul className="issues issues--error" role="alert">
          {errors.map((issue, index) => (
            <li key={index}>{t.issue(issue)}</li>
          ))}
        </ul>
      )}
      {notices.length > 0 && (
        <ul className="issues issues--notice">
          {notices.map((issue, index) => (
            <li key={index}>{t.issue(issue)}</li>
          ))}
        </ul>
      )}
    </>
  )
}
