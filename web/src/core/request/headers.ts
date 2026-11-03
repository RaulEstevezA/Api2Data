// Headers the browser sets itself and silently drops from fetch (Fetch standard, "forbidden request-header")
const FORBIDDEN = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'set-cookie',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
])

export function isForbiddenHeader(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return FORBIDDEN.has(lower) || lower.startsWith('proxy-') || lower.startsWith('sec-')
}

// RFC 9110 token: what fetch accepts as a header name
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export function isValidHeaderName(name: string): boolean {
  return TOKEN.test(name.trim())
}

/** fetch only accepts Latin-1 header values without line breaks; anything else throws before sending. */
export function isValidHeaderValue(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0)!
    if (code > 0xff || char === '\r' || char === '\n' || char === '\0') return false
  }
  return true
}

export function sameHeader(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
