import { useState } from 'react'
import { activeRows } from '../core/http/keyValue.ts'
import { allowsBody } from '../core/http/methods.ts'
import type { KeyValue, RequestDraft } from '../core/http/types.ts'
import type { AuthConfig } from '../core/auth/types.ts'
import type { BodyConfig } from '../core/body/types.ts'
import type { Preparation, RequestIssue } from '../core/request/build.ts'
import { hasCredentials } from '../core/request/redact.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { AuthEditor } from './AuthEditor.tsx'
import { BodyEditor } from './BodyEditor.tsx'
import { CodeSnippet } from './CodeSnippet.tsx'
import { IssueList } from './IssueList.tsx'
import { KeyValueEditor } from './KeyValueEditor.tsx'
import { Pane } from './Pane.tsx'
import { SectionTabs, type SectionTab } from './SectionTabs.tsx'
import './RequestPane.css'

export type RequestSection = 'params' | 'headers' | 'auth' | 'body' | 'code'

const HEADER_ISSUES = new Set<RequestIssue['code']>(['headerName', 'headerValue', 'forbiddenHeader', 'authOverridden'])
const AUTH_ISSUES = new Set<RequestIssue['code']>(['authIncomplete', 'authOverridden'])

/** Params, headers, authorization and body, one section at a time: everything optional stays out of sight. */
export function RequestPane({
  draft,
  preparation,
  onParams,
  onHeaders,
  onAuth,
  onBody,
}: {
  draft: RequestDraft
  preparation: Preparation
  onParams: (params: KeyValue[]) => void
  onHeaders: (headers: KeyValue[]) => void
  onAuth: (auth: AuthConfig) => void
  onBody: (body: BodyConfig) => void
}) {
  const { t } = useI18n()
  const [section, setSection] = useState<RequestSection>('params')
  const headerIssues = preparation.issues.filter((issue) => HEADER_ISSUES.has(issue.code))
  const authIssues = preparation.issues.filter((issue) => AUTH_ISSUES.has(issue.code))
  const bodyError = preparation.issues.some((issue) => issue.code === 'body')
  const automatic = preparation.headers.filter((header) => header.source !== 'user')
  const count = (rows: readonly KeyValue[]) => (activeRows(rows).length ? String(activeRows(rows).length) : undefined)

  const tabs: SectionTab<RequestSection>[] = [
    { id: 'params', label: t.sections.params, badge: count(draft.params) },
    {
      id: 'headers',
      label: t.sections.headers,
      badge: count(draft.headers) ?? (headerIssues.length ? '!' : undefined),
      warning: headerIssues.some((issue) => issue.level === 'error'),
    },
    {
      id: 'auth',
      label: t.sections.auth,
      badge: draft.auth.type === 'none' ? undefined : t.authTypes[draft.auth.type],
      warning: authIssues.length > 0,
    },
    {
      id: 'body',
      label: t.sections.body,
      badge: allowsBody(draft.method) && draft.body.mode !== 'none' ? t.bodyModes[draft.body.mode] : undefined,
      warning: bodyError,
    },
    { id: 'code', label: t.sections.code },
  ]

  return (
    <Pane
      title={t.requestTitle}
      toolbar={<SectionTabs label={t.sectionsLabel} tabs={tabs} selected={section} onSelect={setSection} idPrefix="request" />}
    >
      <div id="request-panel" className="request-pane" role="tabpanel" aria-labelledby={`request-tab-${section}`}>
        {section === 'params' && (
          <>
            <KeyValueEditor rows={draft.params} label={t.sections.params} onChange={onParams} />
            <p className="request-pane__hint">{t.paramsHint}</p>
          </>
        )}

        {section === 'headers' && (
          <>
            <KeyValueEditor rows={draft.headers} label={t.sections.headers} onChange={onHeaders} />
            <p className="request-pane__hint">{t.headersHint}</p>
            <IssueList issues={headerIssues} />
            {automatic.length > 0 && (
              <div className="request-pane__automatic">
                <h3 className="request-pane__subtitle">{t.automaticHeaders}</h3>
                <ul>
                  {automatic.map((header) => (
                    <li key={header.name}>
                      <span className="mono">{header.name}</span>
                      <span className="mono request-pane__value">{header.source === 'auth' ? '••••••' : header.value}</span>
                      <span className="request-pane__source">{t.headerSource[header.source]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {section === 'auth' && (
          <>
            <AuthEditor auth={draft.auth} onChange={onAuth} />
            <IssueList issues={authIssues} />
          </>
        )}

        {section === 'body' &&
          (allowsBody(draft.method) ? (
            <BodyEditor body={draft.body} onChange={onBody} />
          ) : (
            <p className="request-pane__hint">{t.bodyNotAllowed(draft.method)}</p>
          ))}

        {section === 'code' && <CodeSnippet request={preparation.request} withCredentials={hasCredentials(draft)} />}
      </div>
    </Pane>
  )
}
