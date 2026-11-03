import type { HttpResponse } from '../http/types.ts'

export type RawResponseResult = { ok: true; response: HttpResponse } | { ok: false; problem: 'empty' | 'noStatus' }

// "HTTP/1.1 200 OK", "HTTP/2 404", "HTTP/3 200"
const STATUS_LINE = /^HTTP\/[\d.]+\s+(\d{3})(?:[ \t]+([^\r\n]*))?$/

// Far above any response worth reading; stops a paste by mistake from freezing the page
export const MAX_RAW_RESPONSE_LENGTH = 20 * 1024 * 1024

/** Reads the output of `curl -i`, pasted by the user: status line, headers, blank line and body. With -L curl prints
 * one block per redirect (and proxies add their own), so the last block is the response. The body is kept as text. */
export function parseRawResponse(text: string, url: string): RawResponseResult {
  if (!text.trim()) return { ok: false, problem: 'empty' }
  const lines = text.slice(0, MAX_RAW_RESPONSE_LENGTH).replace(/^﻿/, '').split(/\r?\n/)
  let index = 0
  while (index < lines.length && lines[index].trim() === '') index++

  let status: { code: number; text: string } | null = null
  let headers: [string, string][] = []
  let redirected = false
  // Read status + headers blocks while the next non-empty line starts another one
  while (index < lines.length && STATUS_LINE.test(lines[index].trim())) {
    const match = STATUS_LINE.exec(lines[index].trim())!
    // A block before this one that was a redirect (not 100 Continue or a proxy's)
    if (status && status.code >= 300 && status.code < 400) redirected = true
    status = { code: Number(match[1]), text: (match[2] ?? '').trim() }
    headers = []
    index++
    while (index < lines.length && lines[index].trim() !== '') {
      const line = lines[index]
      const colon = line.indexOf(':')
      if (colon > 0) headers.push([line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()])
      index++
    }
    // The blank line after the headers
    index++
    let next = index
    while (next < lines.length && lines[next].trim() === '') next++
    if (next < lines.length && STATUS_LINE.test(lines[next].trim())) index = next
  }
  if (!status) return { ok: false, problem: 'noStatus' }

  const body = lines.slice(index).join('\n')
  return {
    ok: true,
    response: {
      status: status.code,
      statusText: status.text,
      url,
      redirected,
      headers,
      bytes: new TextEncoder().encode(body),
      durationMs: null,
      origin: 'pasted',
    },
  }
}
