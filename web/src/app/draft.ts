import { defaultAuth } from '../core/auth/registry.ts'
import type { AuthConfig } from '../core/auth/types.ts'
import { defaultBody } from '../core/body/registry.ts'
import type { BodyConfig } from '../core/body/types.ts'
import type { HttpMethod } from '../core/http/methods.ts'
import type { KeyValue, RequestDraft } from '../core/http/types.ts'
import { paramsFromUrl, urlWithParams } from '../core/request/url.ts'

let nextId = 0
/** Ids for table rows: only need to be unique while the page is open. */
export function newRowId(): string {
  return `row-${++nextId}`
}

export function emptyDraft(): RequestDraft {
  return { method: 'GET', url: '', params: [], headers: [], auth: defaultAuth(), body: defaultBody() }
}

export type DraftAction =
  | { type: 'method'; method: HttpMethod }
  | { type: 'url'; url: string }
  | { type: 'params'; params: KeyValue[] }
  | { type: 'headers'; headers: KeyValue[] }
  | { type: 'auth'; auth: AuthConfig }
  | { type: 'body'; body: BodyConfig }
  | { type: 'load'; draft: RequestDraft }

/** The URL bar and the Params table are two views of the same query string: editing one rewrites the other. */
export function draftReducer(draft: RequestDraft, action: DraftAction): RequestDraft {
  switch (action.type) {
    case 'method':
      return { ...draft, method: action.method }
    case 'url':
      return { ...draft, url: action.url, params: paramsFromUrl(action.url, draft.params, newRowId) }
    case 'params':
      return { ...draft, params: action.params, url: urlWithParams(draft.url, action.params) }
    case 'headers':
      return { ...draft, headers: action.headers }
    case 'auth':
      return { ...draft, auth: action.auth }
    case 'body':
      return { ...draft, body: action.body }
    case 'load':
      return { ...action.draft, params: paramsFromUrl(action.draft.url, [], newRowId) }
  }
}
