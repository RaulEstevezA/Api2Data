import { applyAuth, isAuthComplete } from '../auth/registry.ts'
import type { AuthType } from '../auth/types.ts'
import { bodyKind } from '../body/registry.ts'
import type { BodyIssue } from '../body/types.ts'
import { activeRows } from '../http/keyValue.ts'
import { allowsBody } from '../http/methods.ts'
import type { PreparedHeader, PreparedRequest, RequestDraft } from '../http/types.ts'
import { isForbiddenHeader, isValidHeaderName, isValidHeaderValue, sameHeader } from './headers.ts'
import { appendQuery, resolveUrl, type UrlProblem } from './url.ts'

/** Something the user should know before sending. Errors stop the request; notices only inform. */
export type RequestIssue =
  | { level: 'error'; code: 'url'; problem: UrlProblem }
  | { level: 'error'; code: 'body'; issue: BodyIssue }
  | { level: 'error'; code: 'headerName'; name: string }
  | { level: 'error'; code: 'headerValue'; name: string }
  | { level: 'notice'; code: 'schemeAdded'; url: string }
  | { level: 'notice'; code: 'forbiddenHeader'; name: string }
  | { level: 'notice'; code: 'authIncomplete'; type: AuthType }
  | { level: 'notice'; code: 'authOverridden'; name: string }

export interface Preparation {
  /** null when an error stops the request */
  request: PreparedRequest | null
  issues: RequestIssue[]
}

function headerIssues(headers: readonly PreparedHeader[]): RequestIssue[] {
  const issues: RequestIssue[] = []
  for (const { name, value } of headers) {
    if (!isValidHeaderName(name)) issues.push({ level: 'error', code: 'headerName', name })
    else if (!isValidHeaderValue(value)) issues.push({ level: 'error', code: 'headerValue', name })
    else if (isForbiddenHeader(name)) issues.push({ level: 'notice', code: 'forbiddenHeader', name })
  }
  return issues
}

/** Turns what the user typed into the request that will be sent, and says what is wrong with it. Pure: it can run
 * on every keystroke, and the same draft always gives the same result. */
export function prepareRequest(draft: RequestDraft): Preparation {
  const issues: RequestIssue[] = []
  const resolved = resolveUrl(draft.url)
  if (!resolved.ok) issues.push({ level: 'error', code: 'url', problem: resolved.problem })

  // Headers typed by the user come first and win over the automatic ones with the same name
  const headers: PreparedHeader[] = activeRows(draft.headers).map((row) => ({ name: row.key.trim(), value: row.value, source: 'user' }))
  const has = (name: string) => headers.some((header) => sameHeader(header.name, name))

  if (!isAuthComplete(draft.auth)) issues.push({ level: 'notice', code: 'authIncomplete', type: draft.auth.type })
  const auth = applyAuth(draft.auth)
  for (const header of auth.headers) {
    if (has(header.name)) issues.push({ level: 'notice', code: 'authOverridden', name: header.name })
    else headers.push({ ...header, source: 'auth' })
  }

  let body: string | null = null
  if (allowsBody(draft.method)) {
    const kind = bodyKind(draft.body.mode)
    const bodyIssue = kind.validate(draft.body)
    if (bodyIssue) issues.push({ level: 'error', code: 'body', issue: bodyIssue })
    body = kind.serialize(draft.body)
    if (body !== null && kind.contentType && !has('Content-Type')) headers.push({ name: 'Content-Type', value: kind.contentType, source: 'body' })
  }

  issues.push(...headerIssues(headers))
  if (!resolved.ok || issues.some((issue) => issue.level === 'error')) return { request: null, issues }

  const url = appendQuery(resolved.url, auth.query)
  if (resolved.schemeAdded) issues.unshift({ level: 'notice', code: 'schemeAdded', url: resolved.url })
  return { request: { method: draft.method, url, headers, body }, issues }
}
