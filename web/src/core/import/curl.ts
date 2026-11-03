import { defaultAuth } from '../auth/registry.ts'
import { defaultBody } from '../body/registry.ts'
import type { BodyMode } from '../body/types.ts'
import { isHttpMethod, type HttpMethod } from '../http/methods.ts'
import type { KeyValue, RequestDraft } from '../http/types.ts'
import { parseJson } from '../json/parse.ts'

/** What could not be brought over from the command, so the user knows the request is not identical. */
export type CurlNotice =
  | { code: 'dataFile'; option: string }
  | { code: 'multipart' }
  | { code: 'ignored'; options: string[] }
  | { code: 'unknownMethod'; method: string }

export type CurlResult =
  { ok: true; draft: RequestDraft; notices: CurlNotice[] } | { ok: false; problem: 'notCurl' | 'noUrl' | 'unclosedQuote' }

/** Whether a pasted text is a cURL command rather than an address. */
export function looksLikeCurl(text: string): boolean {
  return /^\s*curl(\.exe)?\s/i.test(text)
}

const ANSI_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '\\': '\\',
  "'": "'",
  '"': '"',
  a: '\x07',
  b: '\b',
  e: '\x1b',
  f: '\f',
  v: '\v',
}

/** Splits a shell command line as bash would: quotes, $'…' escapes, backslashes and line continuations. */
export function tokenize(command: string): string[] | null {
  const tokens: string[] = []
  let current = ''
  let started = false
  let index = 0
  const text = command.replace(/\\\r?\n/g, ' ')
  while (index < text.length) {
    const char = text[index]
    if (/\s/.test(char)) {
      if (started) tokens.push(current)
      current = ''
      started = false
      index++
      continue
    }
    started = true
    if (char === "'") {
      const end = text.indexOf("'", index + 1)
      if (end === -1) return null
      current += text.slice(index + 1, end)
      index = end + 1
    } else if (char === '$' && text[index + 1] === "'") {
      index += 2
      for (;;) {
        if (index >= text.length) return null
        const next = text[index]
        if (next === "'") break
        if (next === '\\') {
          const escape = text[index + 1] ?? ''
          const hex = /^x([0-9a-fA-F]{1,2})/.exec(text.slice(index + 1))
          const unicode = /^u([0-9a-fA-F]{4})/.exec(text.slice(index + 1))
          if (hex) {
            current += String.fromCharCode(parseInt(hex[1], 16))
            index += 1 + hex[0].length
          } else if (unicode) {
            current += String.fromCharCode(parseInt(unicode[1], 16))
            index += 1 + unicode[0].length
          } else {
            current += ANSI_ESCAPES[escape] ?? `\\${escape}`
            index += 2
          }
          continue
        }
        current += next
        index++
      }
      index++
    } else if (char === '"') {
      index++
      for (;;) {
        if (index >= text.length) return null
        const next = text[index]
        if (next === '"') break
        // Inside double quotes a backslash only escapes these
        if (next === '\\' && '"\\$`'.includes(text[index + 1] ?? '')) {
          current += text[index + 1]
          index += 2
          continue
        }
        current += next
        index++
      }
      index++
    } else if (char === '\\') {
      current += text[index + 1] ?? ''
      index += 2
    } else {
      current += char
      index++
    }
  }
  if (started) tokens.push(current)
  return tokens
}

// Options that take a value and are not used, so their value is not mistaken for the URL
const IGNORED_WITH_VALUE = new Set([
  '-o',
  '--output',
  '-m',
  '--max-time',
  '--connect-timeout',
  '--retry',
  '--retry-delay',
  '--max-redirs',
  '-w',
  '--write-out',
  '-x',
  '--proxy',
  '--cacert',
  '--cert',
  '--key',
  '-E',
  '-c',
  '--cookie-jar',
  '-r',
  '--range',
  '-T',
  '--upload-file',
  '--resolve',
])
// Options without value that do not change the request as Api2Data sends it
const IGNORED_FLAGS = new Set([
  '-L',
  '--location',
  '-k',
  '--insecure',
  '-s',
  '--silent',
  '-S',
  '--show-error',
  '-v',
  '--verbose',
  '-i',
  '--include',
  '--compressed',
  '-f',
  '--fail',
  '-N',
  '--no-buffer',
  '-#',
  '--progress-bar',
  '--http1.1',
  '--http2',
  '--globoff',
  '-g',
])
const SHORT_WITH_VALUE = new Set(['X', 'H', 'd', 'u', 'A', 'e', 'b', 'F', 'o', 'm', 'x', 'E', 'c', 'r', 'T', 'w'])
const SHORT_FLAGS = new Set(['L', 'k', 's', 'S', 'v', 'i', 'f', 'N', 'g', 'I', 'G'])

/** Expands grouped short options ("-sSL", "-XPOST") into separate tokens. */
function expandShort(token: string): string[] {
  if (!/^-[A-Za-z#]{2,}/.test(token) || token.startsWith('--')) return [token]
  const letters = token.slice(1)
  const result: string[] = []
  for (let index = 0; index < letters.length; index++) {
    const letter = letters[index]
    if (SHORT_WITH_VALUE.has(letter)) {
      result.push(`-${letter}`)
      if (index + 1 < letters.length) result.push(letters.slice(index + 1))
      return result
    }
    if (!SHORT_FLAGS.has(letter)) return [token]
    result.push(`-${letter}`)
  }
  return result
}

function formRows(data: string, newId: () => string): KeyValue[] {
  const decode = (text: string) => {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '))
    } catch {
      return text
    }
  }
  return data
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const equals = pair.indexOf('=')
      const key = equals === -1 ? pair : pair.slice(0, equals)
      const value = equals === -1 ? '' : pair.slice(equals + 1)
      return { id: newId(), key: decode(key), value: decode(value), enabled: true }
    })
}

function bodyModeFor(contentType: string | null, data: string): BodyMode {
  const type = contentType?.toLowerCase() ?? ''
  if (type.includes('json')) return 'json'
  if (type.includes('xml')) return 'xml'
  if (type.includes('x-www-form-urlencoded')) return 'form'
  if (contentType) return 'text'
  // curl sends -d as a form unless told otherwise; JSON sent that way is almost always meant as JSON
  if (/^\s*[[{]/.test(data) && parseJson(data).ok) return 'json'
  return /^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(data) ? 'form' : 'text'
}

const DEFAULT_TYPES: Partial<Record<BodyMode, RegExp>> = {
  json: /^application\/json\s*(;\s*charset=utf-8)?$/i,
  xml: /^application\/xml$/i,
  form: /^application\/x-www-form-urlencoded\s*(;\s*charset=utf-8)?$/i,
}

/** Turns a cURL command into a request draft. Only reads the text: nothing is run and no file is opened. */
export function parseCurl(command: string, newId: () => string): CurlResult {
  if (!looksLikeCurl(command)) return { ok: false, problem: 'notCurl' }
  const tokens = tokenize(command.trim())
  if (!tokens) return { ok: false, problem: 'unclosedQuote' }
  const args = tokens.slice(1).flatMap(expandShort)

  let method: string | null = null
  let url: string | null = null
  let head = false
  let get = false
  const headers: { name: string; value: string }[] = []
  const data: string[] = []
  let user: string | null = null
  const notices: CurlNotice[] = []
  const ignored: string[] = []

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    const value = () => args[++index] ?? ''
    switch (arg) {
      case '-X':
      case '--request':
        method = value().toUpperCase()
        break
      case '-H':
      case '--header': {
        const header = value()
        const colon = header.indexOf(':')
        if (colon > 0) headers.push({ name: header.slice(0, colon).trim(), value: header.slice(colon + 1).trim() })
        break
      }
      case '-d':
      case '--data':
      case '--data-ascii':
      case '--data-binary':
      case '--data-raw': {
        const text = value()
        if (arg !== '--data-raw' && text.startsWith('@')) notices.push({ code: 'dataFile', option: arg })
        else data.push(arg === '--data-binary' || arg === '--data-raw' ? text : text.replace(/\r?\n/g, ''))
        break
      }
      case '--data-urlencode': {
        const text = value()
        const equals = text.indexOf('=')
        data.push(equals === -1 ? encodeURIComponent(text) : `${text.slice(0, equals)}=${encodeURIComponent(text.slice(equals + 1))}`)
        break
      }
      case '--json':
        data.push(value())
        if (!headers.some((header) => header.name.toLowerCase() === 'content-type'))
          headers.push({ name: 'Content-Type', value: 'application/json' })
        if (!headers.some((header) => header.name.toLowerCase() === 'accept')) headers.push({ name: 'Accept', value: 'application/json' })
        break
      case '-u':
      case '--user':
        user = value()
        break
      case '-A':
      case '--user-agent':
        headers.push({ name: 'User-Agent', value: value() })
        break
      case '-e':
      case '--referer':
        headers.push({ name: 'Referer', value: value() })
        break
      case '-b':
      case '--cookie':
        headers.push({ name: 'Cookie', value: value() })
        break
      case '-I':
      case '--head':
        head = true
        break
      case '-G':
      case '--get':
        get = true
        break
      case '--url':
        url = value()
        break
      case '-F':
      case '--form':
        value()
        if (!notices.some((notice) => notice.code === 'multipart')) notices.push({ code: 'multipart' })
        break
      default:
        if (IGNORED_WITH_VALUE.has(arg)) {
          ignored.push(arg)
          value()
        } else if (IGNORED_FLAGS.has(arg)) {
          ignored.push(arg)
        } else if (arg.startsWith('-') && arg.length > 1) {
          ignored.push(arg)
        } else if (url === null) {
          url = arg
        }
    }
  }

  if (!url) return { ok: false, problem: 'noUrl' }
  if (ignored.length > 0) notices.push({ code: 'ignored', options: [...new Set(ignored)] })

  const body = defaultBody()
  const joined = data.join('&')
  if (get && data.length > 0) url = appendQueryRaw(url, joined)

  let resolvedMethod: HttpMethod = head ? 'HEAD' : data.length > 0 && !get ? 'POST' : 'GET'
  if (method) {
    if (isHttpMethod(method)) resolvedMethod = method
    else notices.push({ code: 'unknownMethod', method })
  }

  const auth = defaultAuth()
  if (user !== null) {
    const colon = user.indexOf(':')
    auth.type = 'basic'
    auth.settings.basic =
      colon === -1 ? { username: user, password: '' } : { username: user.slice(0, colon), password: user.slice(colon + 1) }
  }
  // A bearer token is easier to see and change in Authorization than as a header
  const authorization = headers.findIndex((header) => header.name.toLowerCase() === 'authorization' && /^Bearer\s+\S/i.test(header.value))
  if (authorization !== -1 && auth.type === 'none') {
    auth.type = 'bearer'
    auth.settings.bearer.token = headers[authorization].value.replace(/^Bearer\s+/i, '')
    headers.splice(authorization, 1)
  }

  if (data.length > 0 && !get) {
    const contentTypeIndex = headers.findIndex((header) => header.name.toLowerCase() === 'content-type')
    const contentType = contentTypeIndex === -1 ? null : headers[contentTypeIndex].value
    body.mode = bodyModeFor(contentType, joined)
    if (body.mode === 'form') body.form = formRows(joined, newId)
    else body.text[body.mode as 'json' | 'text' | 'xml'] = joined
    // The body mode adds this Content-Type itself
    if (contentType && DEFAULT_TYPES[body.mode]?.test(contentType)) headers.splice(contentTypeIndex, 1)
  }

  return {
    ok: true,
    draft: {
      method: resolvedMethod,
      url,
      params: [],
      headers: headers.map((header) => ({ id: newId(), key: header.name, value: header.value, enabled: true })),
      auth,
      body,
    },
    notices,
  }
}

/** -G moves the data to the query string as it is written (it is already encoded). */
function appendQueryRaw(url: string, query: string): string {
  const hashIndex = url.indexOf('#')
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
  return `${base}${base.includes('?') ? '&' : '?'}${query}${hash}`
}
