import { defaultAuth } from '../auth/registry.ts'
import type { AuthConfig } from '../auth/types.ts'
import type { KeyValue, RequestDraft } from '../http/types.ts'
import { splitUrl, urlWithParams } from './url.ts'

// Names that usually carry a secret, in headers and query strings
const SENSITIVE =
  /auth|token|secret|passw|pwd|api[-_]?key|apikey|^key$|access[-_]?key|session|cookie|signature|^sig$|credential|client[-_]?secret/i

export function isSensitiveName(name: string): boolean {
  return SENSITIVE.test(name.trim())
}

/** Settings without secrets: the chosen type, the API key name and where it goes, and the Basic user name. */
function redactAuth(auth: AuthConfig): AuthConfig {
  const empty = defaultAuth()
  return {
    type: auth.type,
    settings: {
      ...empty.settings,
      basic: { username: auth.settings.basic.username, password: '' },
      apiKey: { ...auth.settings.apiKey, value: '' },
    },
  }
}

const clearSensitive = (rows: readonly KeyValue[]) => rows.map((row) => (isSensitiveName(row.key) ? { ...row, value: '' } : row))

/** Whether the draft holds something that looks like a credential, so saving it can be offered as a choice. */
export function hasCredentials(draft: RequestDraft): boolean {
  const { bearer, basic, apiKey } = draft.auth.settings
  const authSecret =
    (draft.auth.type === 'bearer' && bearer.token !== '') ||
    (draft.auth.type === 'basic' && basic.password !== '') ||
    (draft.auth.type === 'apiKey' && apiKey.value !== '')
  const sensitiveRow = (rows: readonly KeyValue[]) => rows.some((row) => isSensitiveName(row.key) && row.value !== '')
  return authSecret || sensitiveRow(draft.headers) || sensitiveRow(draft.params) || /\/\/[^/@?#]*:[^/@?#]*@/.test(draft.url)
}

/** The draft without what usually is a secret: tokens, passwords, API key values, sensitive header and query values,
 * and user info in the URL. The body is kept as written: it is the request itself. */
export function redactDraft(draft: RequestDraft): RequestDraft {
  const params = clearSensitive(draft.params)
  const { base, hash } = splitUrl(draft.url)
  const cleanBase = base.replace(/^([a-z][a-z\d+.-]*:\/\/)[^/@?#]*@/i, '$1')
  // The params mirror the query string, so the URL is rebuilt from the cleaned rows
  const url = urlWithParams(`${cleanBase}${hash}`, params)
  return { ...draft, url, params, headers: clearSensitive(draft.headers), auth: redactAuth(draft.auth) }
}
