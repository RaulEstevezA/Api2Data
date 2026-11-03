import { describe, expect, it } from 'vitest'
import type { PreparedRequest } from '../http/types.ts'
import { classifyFailure } from './failure.ts'
import { createFetchTransport, type FetchEnvironment } from './fetchTransport.ts'

const request: PreparedRequest = {
  method: 'POST',
  url: 'https://api.example.com/items',
  headers: [{ name: 'Content-Type', value: 'application/json', source: 'body' }],
  body: '{"a":1}',
}

function environment(fetchImpl: FetchEnvironment['fetch'], online = true): FetchEnvironment {
  let time = 1000
  return { fetch: fetchImpl, now: () => (time += 25), pageProtocol: 'https:', isOnline: () => online }
}

describe('classifyFailure', () => {
  const base = { url: 'https://api.example.com', pageProtocol: 'https:', online: true, aborted: false }

  it('tells the likely cause', () => {
    expect(classifyFailure(new TypeError('Failed to fetch'), base)).toEqual({ kind: 'blocked', detail: 'Failed to fetch' })
    expect(classifyFailure(new TypeError('x'), { ...base, aborted: true })).toEqual({ kind: 'aborted' })
    expect(classifyFailure(new TypeError('x'), { ...base, online: false })).toEqual({ kind: 'offline' })
    expect(classifyFailure(new TypeError('x'), { ...base, url: 'http://api.example.com' })).toEqual({ kind: 'mixedContent' })
  })

  it('allows http on the local machine from an https page', () => {
    expect(classifyFailure(new TypeError('x'), { ...base, url: 'http://localhost:8080' }).kind).toBe('blocked')
    expect(classifyFailure(new TypeError('x'), { ...base, url: 'http://127.0.0.1:8080' }).kind).toBe('blocked')
  })
})

describe('fetch transport', () => {
  it('sends without browser credentials and reads the whole response', async () => {
    let init: RequestInit | undefined
    const transport = createFetchTransport(
      environment(async (_url, options) => {
        init = options
        return new Response('{"id":1}', { status: 201, headers: { 'Content-Type': 'application/json' } })
      }),
    )
    const result = await transport.send(request, new AbortController().signal)
    expect(init).toMatchObject({ method: 'POST', body: '{"a":1}', credentials: 'omit', headers: [['Content-Type', 'application/json']] })
    expect(result).toMatchObject({ ok: true, response: { status: 201, durationMs: 25, url: request.url } })
    if (result.ok) expect(new TextDecoder().decode(result.response.bytes)).toBe('{"id":1}')
  })

  it('reports a blocked request', async () => {
    const transport = createFetchTransport(
      environment(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(await transport.send(request, new AbortController().signal)).toEqual({
      ok: false,
      failure: { kind: 'blocked', detail: 'Failed to fetch' },
    })
  })

  it('reports a cancelled request', async () => {
    const controller = new AbortController()
    const transport = createFetchTransport(
      environment(async () => {
        controller.abort()
        throw new DOMException('aborted', 'AbortError')
      }),
    )
    expect(await transport.send(request, controller.signal)).toEqual({ ok: false, failure: { kind: 'aborted' } })
  })
})
