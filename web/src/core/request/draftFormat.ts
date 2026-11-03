import { AUTH_TYPES, defaultAuth } from '../auth/registry.ts'
import type { AuthConfig, AuthType } from '../auth/types.ts'
import { BODY_MODES, defaultBody } from '../body/registry.ts'
import type { BodyConfig, BodyMode } from '../body/types.ts'
import { isHttpMethod } from '../http/methods.ts'
import type { KeyValue, RequestDraft } from '../http/types.ts'

/** A draft as stored or exported: the same fields without row ids, which only make sense while the page is open. */
export interface StoredRow {
  key: string
  value: string
  enabled: boolean
}

export interface StoredDraft extends Omit<RequestDraft, 'params' | 'headers' | 'body'> {
  params: StoredRow[]
  headers: StoredRow[]
  body: Omit<BodyConfig, 'form'> & { form: StoredRow[] }
}

const toStored = (rows: readonly KeyValue[]): StoredRow[] => rows.map(({ key, value, enabled }) => ({ key, value, enabled }))

export function toStoredDraft(draft: RequestDraft): StoredDraft {
  return {
    method: draft.method,
    url: draft.url,
    params: toStored(draft.params),
    headers: toStored(draft.headers),
    auth: draft.auth,
    body: { ...draft.body, form: toStored(draft.body.form) },
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)

// Generous limits: they only stop a damaged or hostile file from freezing the page
const MAX_ROWS = 500
const MAX_TEXT = 5 * 1024 * 1024

function readRows(value: unknown, newId: () => string): KeyValue[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_ROWS) return null
  const rows: KeyValue[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== 'string' || typeof item.value !== 'string') return null
    rows.push({ id: newId(), key: item.key, value: item.value, enabled: item.enabled !== false })
  }
  return rows
}

function readAuth(value: unknown): AuthConfig {
  const auth = defaultAuth()
  if (!isRecord(value)) return auth
  if (AUTH_TYPES.includes(value.type as AuthType)) auth.type = value.type as AuthType
  const settings = isRecord(value.settings) ? value.settings : {}
  const bearer = isRecord(settings.bearer) ? settings.bearer : {}
  const basic = isRecord(settings.basic) ? settings.basic : {}
  const apiKey = isRecord(settings.apiKey) ? settings.apiKey : {}
  auth.settings.bearer = { token: text(bearer.token) }
  auth.settings.basic = { username: text(basic.username), password: text(basic.password) }
  auth.settings.apiKey = {
    name: text(apiKey.name, auth.settings.apiKey.name),
    value: text(apiKey.value),
    location: apiKey.location === 'query' ? 'query' : 'header',
  }
  return auth
}

function readBody(value: unknown, newId: () => string): BodyConfig | null {
  const body = defaultBody()
  if (value === undefined) return body
  if (!isRecord(value)) return null
  if (BODY_MODES.includes(value.mode as BodyMode)) body.mode = value.mode as BodyMode
  const texts = isRecord(value.text) ? value.text : {}
  for (const mode of ['json', 'text', 'xml'] as const) {
    const content = text(texts[mode])
    if (content.length > MAX_TEXT) return null
    body.text[mode] = content
  }
  const form = readRows(value.form, newId)
  if (!form) return null
  body.form = form
  return body
}

/** Reads a stored or imported draft. Anything malformed gives null; missing optional parts take their defaults.
 * The caller loads it through the draft reducer, which reads the enabled params again from the URL. */
export function readDraft(value: unknown, newId: () => string): RequestDraft | null {
  if (!isRecord(value)) return null
  if (!isHttpMethod(value.method) || typeof value.url !== 'string' || value.url.length > 64 * 1024) return null
  const params = readRows(value.params, newId)
  const headers = readRows(value.headers, newId)
  const body = readBody(value.body, newId)
  if (!params || !headers || !body) return null
  return { method: value.method, url: value.url, params, headers, auth: readAuth(value.auth), body }
}
