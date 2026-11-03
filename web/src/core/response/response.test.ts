import { describe, expect, it } from 'vitest'
import type { HttpResponse } from '../http/types.ts'
import { prettyJson } from '../json/pretty.ts'
import { decodeBody, parseContentType } from './contentType.ts'
import { processResponse } from './process.ts'
import { reasonPhrase, statusClass } from './status.ts'
import { isBinary, viewText } from './viewers.ts'
import { prettyXml } from './xml.ts'

const encode = (text: string) => new TextEncoder().encode(text)

function response(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    status: 200,
    statusText: '',
    url: 'https://api.example.com/users/1',
    redirected: false,
    headers: [['content-type', 'application/json; charset=utf-8']],
    bytes: encode('{"id":1}'),
    durationMs: 42,
    ...overrides,
  }
}

describe('prettyJson', () => {
  it('indents without touching values', () => {
    expect(prettyJson('{"id":12345678901234567890,"tags":[],"a":{"b":"x, y: {z}","c":[1,2.50]},"e":{}}')).toBe(
      [
        '{',
        '  "id": 12345678901234567890,',
        '  "tags": [],',
        '  "a": {',
        '    "b": "x, y: {z}",',
        '    "c": [',
        '      1,',
        '      2.50',
        '    ]',
        '  },',
        '  "e": {}',
        '}',
      ].join('\n'),
    )
  })

  it('keeps escaped quotes inside strings', () => {
    expect(prettyJson('{"q":"say \\"hi\\"","b":"\\\\"}')).toBe('{\n  "q": "say \\"hi\\"",\n  "b": "\\\\"\n}')
  })

  it('reformats already indented JSON the same way', () => {
    const pretty = prettyJson('[{"a":1},{"b":[true,null]}]')
    expect(prettyJson(pretty)).toBe(pretty)
  })
})

describe('prettyXml', () => {
  it('indents elements and keeps short text inline', () => {
    expect(prettyXml('<?xml version="1.0"?><user id="1"><name>Raúl Estévez</name><tags><tag/><empty></empty></tags></user>')).toBe(
      [
        '<?xml version="1.0"?>',
        '<user id="1">',
        '  <name>Raúl Estévez</name>',
        '  <tags>',
        '    <tag/>',
        '    <empty></empty>',
        '  </tags>',
        '</user>',
      ].join('\n'),
    )
  })

  it('gives up on mismatched tags', () => {
    expect(prettyXml('<a><b></a>')).toBeNull()
  })
})

describe('content type', () => {
  it('reads media type and charset', () => {
    expect(parseContentType('Application/JSON; charset="ISO-8859-1"')).toEqual({ mediaType: 'application/json', charset: 'ISO-8859-1' })
    expect(parseContentType('')).toBeNull()
  })

  it('decodes with the declared charset', () => {
    expect(decodeBody(new Uint8Array([0x63, 0x61, 0x66, 0xe9]), 'iso-8859-1')).toBe('café')
    expect(decodeBody(encode('café'), 'not-a-charset')).toBe('café')
  })
})

describe('viewers', () => {
  it('uses the declared type', () => {
    expect(viewText('{"a":1}', 'application/vnd.api+json').kind).toBe('json')
    expect(viewText('<a/>', 'application/atom+xml').kind).toBe('xml')
    expect(viewText('<p>hi</p>', 'text/html').kind).toBe('html')
  })

  it('recognizes JSON and XML sent as plain text or without type', () => {
    expect(viewText('[1, 2]', 'text/plain').pretty).toBe('[\n  1,\n  2\n]')
    expect(viewText('<?xml version="1.0"?><a/>', null).kind).toBe('xml')
    expect(viewText('hello', null).kind).toBe('text')
  })

  it('shows invalid JSON as received and says why', () => {
    const view = viewText('{"a":', 'application/json')
    expect(view.pretty).toBe('{"a":')
    expect(view.invalidJson?.code).toBe('unexpectedEnd')
  })

  it('detects binary bodies', () => {
    expect(isBinary('image/png', encode('x'))).toBe(true)
    expect(isBinary(null, new Uint8Array([0x89, 0x50, 0x00, 0x47]))).toBe(true)
    expect(isBinary('image/svg+xml', encode('<svg/>'))).toBe(false)
    expect(isBinary(null, encode('plain text\n'))).toBe(false)
  })
})

describe('status', () => {
  it('fills the reason phrase that HTTP/2 omits', () => {
    expect(reasonPhrase(404)).toBe('Not Found')
    expect(reasonPhrase(200, 'Fine')).toBe('Fine')
    expect(reasonPhrase(299)).toBe('')
    expect([101, 204, 304, 422, 503].map(statusClass)).toEqual(['informational', 'success', 'redirect', 'clientError', 'serverError'])
  })
})

describe('processResponse', () => {
  it('summarizes a JSON response', () => {
    const processed = processResponse(response())
    expect(processed).toMatchObject({ status: 200, reason: 'OK', statusClass: 'success', size: 8, durationMs: 42 })
    expect(processed.contentType?.mediaType).toBe('application/json')
    expect(processed.body).toMatchObject({ kind: 'text', view: { kind: 'json', pretty: '{\n  "id": 1\n}' } })
    expect(processed.raw).toBe('HTTP 200 OK\ncontent-type: application/json; charset=utf-8\n\n{"id":1}')
  })

  it('handles empty and binary bodies', () => {
    expect(processResponse(response({ status: 204, bytes: new Uint8Array() })).body).toEqual({ kind: 'empty' })
    expect(processResponse(response({ headers: [['content-type', 'image/png']] })).body).toEqual({ kind: 'binary' })
  })
})
