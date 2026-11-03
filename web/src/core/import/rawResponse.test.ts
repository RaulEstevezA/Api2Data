import { describe, expect, it } from 'vitest'
import { curlCommand } from '../codegen/curl.ts'
import { processResponse } from '../response/process.ts'
import { parseRawResponse } from './rawResponse.ts'

const URL = 'https://www.aemet.es/xml/municipios/localidad_28079.xml'

describe('parseRawResponse', () => {
  it('reads the output of curl -i', () => {
    const text = 'HTTP/2 200 \ncontent-type: application/json\nx-total: 2\n\n{"items":[1,2]}'
    const result = parseRawResponse(text, URL)
    expect(result).toMatchObject({
      ok: true,
      response: {
        status: 200,
        statusText: '',
        redirected: false,
        durationMs: null,
        origin: 'pasted',
        headers: [
          ['content-type', 'application/json'],
          ['x-total', '2'],
        ],
      },
    })
    if (result.ok) expect(new TextDecoder().decode(result.response.bytes)).toBe('{"items":[1,2]}')
  })

  it('takes the last block after redirects, 100 Continue and CRLF line endings', () => {
    const text =
      'HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 301 Moved Permanently\r\nLocation: /b\r\n\r\nHTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nno\r\nsuch page'
    const result = parseRawResponse(text, URL)
    expect(result.ok && result.response.status).toBe(404)
    expect(result.ok && result.response.statusText).toBe('Not Found')
    expect(result.ok && result.response.redirected).toBe(true)
    if (result.ok) expect(new TextDecoder().decode(result.response.bytes)).toBe('no\nsuch page')
  })

  it('keeps the text the terminal decoded, whatever charset the server declared', () => {
    const text =
      "HTTP/2 200\ncontent-type: application/xml\n\n<?xml version='1.0' encoding='ISO-8859-15'?><root><nombre>Madrid</nombre><dia>miércoles</dia></root>"
    const result = parseRawResponse(text.replace('application/xml', 'application/xml; charset=ISO-8859-15'), URL)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const processed = processResponse(result.response)
    expect(processed.body.kind === 'text' && processed.body.view.pretty).toContain('<dia>miércoles</dia>')
    expect(processed.origin).toBe('pasted')
    expect(processed.durationMs).toBeNull()
  })

  it('says what is wrong with other text', () => {
    expect(parseRawResponse('   ', URL)).toEqual({ ok: false, problem: 'empty' })
    expect(parseRawResponse('{"a":1}', URL)).toEqual({ ok: false, problem: 'noStatus' })
  })
})

describe('curlCommand', () => {
  it('adds -i so the output can be pasted back', () => {
    const request = { method: 'GET' as const, url: URL, headers: [], body: null }
    expect(curlCommand(request, { include: true })).toBe(`curl -i '${URL}'`)
    expect(curlCommand({ ...request, method: 'HEAD' }, { include: true })).toBe(`curl --head '${URL}'`)
    expect(curlCommand(request)).toBe(`curl '${URL}'`)
  })
})
