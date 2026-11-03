import type { HttpResponse } from '../http/types.ts'
import { decodeBody, headerValue, parseContentType, type ContentType } from './contentType.ts'
import { reasonPhrase, statusClass, type StatusClass } from './status.ts'
import { isBinary, viewText, type TextView } from './viewers.ts'

export type ResponseBody = { kind: 'empty' } | { kind: 'binary' } | ({ kind: 'text' } & { view: TextView })

/** A response ready to be shown: status, metadata and the body in the most readable form. */
export interface ProcessedResponse {
  status: number
  reason: string
  statusClass: StatusClass
  url: string
  redirected: boolean
  headers: [string, string][]
  contentType: ContentType | null
  /** Bytes of the body received by the browser, after decompression */
  size: number
  /** The body as received, for downloading it */
  bytes: Uint8Array<ArrayBuffer>
  durationMs: number | null
  origin: HttpResponse['origin']
  body: ResponseBody
  /** Status line, headers and body as text, for the Raw tab */
  raw: string
}

function bodyOf(bytes: Uint8Array, contentType: ContentType | null, charset: string | null): ResponseBody {
  if (bytes.length === 0) return { kind: 'empty' }
  if (isBinary(contentType?.mediaType ?? null, bytes)) return { kind: 'binary' }
  return { kind: 'text', view: viewText(decodeBody(bytes, charset), contentType?.mediaType ?? null) }
}

export function processResponse(response: HttpResponse): ProcessedResponse {
  const contentType = parseContentType(headerValue(response.headers, 'content-type'))
  const reason = reasonPhrase(response.status, response.statusText)
  // Pasted text was decoded by the terminal and stored as UTF-8, whatever charset the server declared
  const body = bodyOf(response.bytes, contentType, response.origin === 'pasted' ? 'utf-8' : (contentType?.charset ?? null))
  const statusLine = `HTTP ${response.status}${reason ? ` ${reason}` : ''}`
  const headerLines = response.headers.map(([name, value]) => `${name}: ${value}`)
  const rawBody = body.kind === 'text' ? body.view.raw : ''
  return {
    status: response.status,
    reason,
    statusClass: statusClass(response.status),
    url: response.url,
    redirected: response.redirected,
    headers: response.headers,
    contentType,
    size: response.bytes.length,
    bytes: response.bytes,
    durationMs: response.durationMs,
    origin: response.origin,
    body,
    raw: [statusLine, ...headerLines, '', rawBody].join('\n'),
  }
}
