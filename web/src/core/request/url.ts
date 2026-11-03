import type { KeyValue } from '../http/types.ts'

/** The parts of an address as typed: everything before "?", the query without "?", and the fragment with its "#". */
export function splitUrl(url: string): { base: string; query: string | null; hash: string } {
  const hashIndex = url.indexOf('#')
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const queryIndex = withoutHash.indexOf('?')
  if (queryIndex === -1) return { base: withoutHash, query: null, hash }
  return { base: withoutHash.slice(0, queryIndex), query: withoutHash.slice(queryIndex + 1), hash }
}

/** Query pairs exactly as written (not decoded), so the URL and the table always show the same text. */
export function parseQuery(query: string): { key: string; value: string }[] {
  return query
    .split('&')
    .filter((part) => part !== '')
    .map((part) => {
      const equals = part.indexOf('=')
      return equals === -1 ? { key: part, value: '' } : { key: part.slice(0, equals), value: part.slice(equals + 1) }
    })
}

/** Escapes only what would break the query (separators, spaces, a lone "%"); the rest stays as the user wrote it,
 * so values already encoded ("hello%20world") are not encoded twice. */
export function encodeQueryPart(text: string, isKey: boolean): string {
  let result = text
    .replace(/%(?![0-9A-Fa-f]{2})/g, '%25')
    .replace(/ /g, '%20')
    .replace(/#/g, '%23')
    .replace(/&/g, '%26')
  if (isKey) result = result.replace(/=/g, '%3D')
  return result
}

function serializeQuery(params: readonly KeyValue[]): string {
  return (
    params
      .filter((row) => row.enabled && (row.key !== '' || row.value !== ''))
      // "key=" also when the value is empty: the usual form, and what URLSearchParams writes
      .map((row) => `${encodeQueryPart(row.key, true)}=${encodeQueryPart(row.value, false)}`)
      .join('&')
  )
}

/** The URL with its query string rebuilt from the enabled params. Used when the table is edited. */
export function urlWithParams(url: string, params: readonly KeyValue[]): string {
  const { base, hash } = splitUrl(url)
  const query = serializeQuery(params)
  return `${base}${query ? `?${query}` : ''}${hash}`
}

/** The params after the URL bar is edited: the pairs of its query string, enabled, then the disabled rows,
 * which are not in the URL and must not be lost. Existing ids are reused so rows keep their focus. */
export function paramsFromUrl(url: string, previous: readonly KeyValue[], newId: () => string): KeyValue[] {
  const { query } = splitUrl(url)
  const pairs = query === null ? [] : parseQuery(query)
  const enabledIds = previous.filter((row) => row.enabled).map((row) => row.id)
  const parsed = pairs.map((pair, index) => ({ id: enabledIds[index] ?? newId(), key: pair.key, value: pair.value, enabled: true }))
  return [...parsed, ...previous.filter((row) => !row.enabled)]
}

/** Adds query parameters to an absolute URL (API key in the query), keeping the existing ones as written. */
export function appendQuery(url: string, pairs: readonly { key: string; value: string }[]): string {
  if (pairs.length === 0) return url
  const { base, query, hash } = splitUrl(url)
  const extra = pairs.map((pair) => `${encodeURIComponent(pair.key)}=${encodeURIComponent(pair.value)}`).join('&')
  return `${base}?${query ? `${query}&` : ''}${extra}${hash}`
}

export type UrlProblem = 'empty' | 'invalid' | 'unsupportedScheme'

export type ResolvedUrl = { ok: true; url: string; schemeAdded: boolean } | { ok: false; problem: UrlProblem }

const SCHEME = /^[a-z][a-z\d+.-]*:/i

/** The absolute address that will be requested. Without a scheme, https:// is assumed, and the caller says so. */
export function resolveUrl(input: string): ResolvedUrl {
  const text = input.trim()
  if (!text) return { ok: false, problem: 'empty' }
  // "localhost:3000" looks like a scheme followed by a port
  const schemeAdded = !SCHEME.test(text) || /^[^/:]+:\d+(?:[/?#]|$)/.test(text)
  const candidate = schemeAdded ? `https://${text.replace(/^\/\//, '')}` : text
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return { ok: false, problem: 'invalid' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, problem: 'unsupportedScheme' }
  if (!parsed.hostname) return { ok: false, problem: 'invalid' }
  // The fragment is never sent to the server
  return { ok: true, url: candidate.split('#')[0], schemeAdded }
}
