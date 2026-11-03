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
  durationMs: number
  body: ResponseBody
  /** Status line, headers and body as text, for the Raw tab */
  raw: string
}

function bodyOf(bytes: Uint8Array, contentType: ContentType | null): ResponseBody {
  if (bytes.length === 0) return { kind: 'empty' }
  if (isBinary(contentType?.mediaType ?? null, bytes)) return { kind: 'binary' }
  return { kind: 'text', view: viewText(decodeBody(bytes, contentType?.charset ?? null), contentType?.mediaType ?? null) }
}

export function processResponse(response: HttpResponse): ProcessedResponse {
  const contentType = parseContentType(headerValue(response.headers, 'content-type'))
  const reason = reasonPhrase(response.status, response.statusText)
  const body = bodyOf(response.bytes, contentType)
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
    durationMs: response.durationMs,
    body,
    raw: [statusLine, ...headerLines, '', rawBody].join('\n'),
  }
}
