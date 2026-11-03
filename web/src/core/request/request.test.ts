import { describe, expect, it } from 'vitest'
import { defaultAuth } from '../auth/registry.ts'
import { base64Utf8 } from '../auth/schemes.ts'
import { defaultBody } from '../body/registry.ts'
import type { KeyValue, RequestDraft } from '../http/types.ts'
import { prepareRequest } from './build.ts'
import { isForbiddenHeader, isValidHeaderValue } from './headers.ts'
import { appendQuery, encodeQueryPart, paramsFromUrl, parseQuery, resolveUrl, splitUrl, urlWithParams } from './url.ts'

const row = (id: string, key: string, value: string, enabled = true): KeyValue => ({ id, key, value, enabled })

function draft(overrides: Partial<RequestDraft> = {}): RequestDraft {
  return { method: 'GET', url: 'https://api.example.com/users', params: [], headers: [], auth: defaultAuth(), body: defaultBody(), ...overrides }
}

describe('url', () => {
  it('splits base, query and fragment', () => {
    expect(splitUrl('https://a.example.com/x?q=1&b#top')).toEqual({ base: 'https://a.example.com/x', query: 'q=1&b', hash: '#top' })
    expect(splitUrl('https://a.example.com/x')).toEqual({ base: 'https://a.example.com/x', query: null, hash: '' })
  })

  it('reads query pairs as written', () => {
    expect(parseQuery('q=hello%20world&flag&&a=b=c')).toEqual([
      { key: 'q', value: 'hello%20world' },
      { key: 'flag', value: '' },
      { key: 'a', value: 'b=c' },
    ])
  })

  it('escapes only what breaks the query', () => {
    expect(encodeQueryPart('a b&c#d', false)).toBe('a%20b%26c%23d')
    expect(encodeQueryPart('50%', false)).toBe('50%25')
    expect(encodeQueryPart('already%20encoded', false)).toBe('already%20encoded')
    expect(encodeQueryPart('a=b', true)).toBe('a%3Db')
    expect(encodeQueryPart('a=b', false)).toBe('a=b')
  })

  it('rebuilds the URL from the enabled params, keeping the fragment', () => {
    const params = [row('1', 'page', '2'), row('2', 'q', 'red shoes'), row('3', 'debug', 'true', false), row('4', 'flag', '')]
    expect(urlWithParams('https://a.example.com/x?old=1#top', params)).toBe('https://a.example.com/x?page=2&q=red%20shoes&flag=#top')
    expect(urlWithParams('https://a.example.com/x?old=1', [])).toBe('https://a.example.com/x')
  })

  it('round-trips the URL through the table without changing it', () => {
    let next = 0
    const url = 'https://a.example.com/search?q=caf%C3%A9&tags=a,b&empty=&flag='
    expect(urlWithParams(url, paramsFromUrl(url, [], () => String(next++)))).toBe(url)
  })

  it('keeps disabled params and existing ids when the URL changes', () => {
    const previous = [row('a', 'page', '1'), row('b', 'debug', 'true', false)]
    const params = paramsFromUrl('https://x.example.com/?page=3&size=10', previous, () => 'new')
    expect(params).toEqual([row('a', 'page', '3'), row('new', 'size', '10'), row('b', 'debug', 'true', false)])
  })

  it('appends encoded query parameters', () => {
    expect(appendQuery('https://x.example.com/a?b=1#f', [{ key: 'api key', value: 'x&y' }])).toBe('https://x.example.com/a?b=1&api%20key=x%26y#f')
    expect(appendQuery('https://x.example.com/a', [{ key: 'k', value: 'v' }])).toBe('https://x.example.com/a?k=v')
  })

  it('resolves the address to request', () => {
    expect(resolveUrl('  ')).toEqual({ ok: false, problem: 'empty' })
    expect(resolveUrl('api.example.com/users')).toEqual({ ok: true, url: 'https://api.example.com/users', schemeAdded: true })
    expect(resolveUrl('localhost:3000/api')).toEqual({ ok: true, url: 'https://localhost:3000/api', schemeAdded: true })
    expect(resolveUrl('http://localhost:3000/api#x')).toEqual({ ok: true, url: 'http://localhost:3000/api', schemeAdded: false })
    expect(resolveUrl('ftp://files.example.com')).toEqual({ ok: false, problem: 'unsupportedScheme' })
    expect(resolveUrl('https://exa mple.com')).toEqual({ ok: false, problem: 'invalid' })
  })
})

describe('headers', () => {
  it('knows the headers the browser does not let pages set', () => {
    expect(isForbiddenHeader('Cookie')).toBe(true)
    expect(isForbiddenHeader('sec-fetch-mode')).toBe(true)
    expect(isForbiddenHeader('Accept')).toBe(false)
  })

  it('rejects values fetch cannot send', () => {
    expect(isValidHeaderValue('café')).toBe(true)
    expect(isValidHeaderValue('token €')).toBe(false)
    expect(isValidHeaderValue('a\nb')).toBe(false)
  })
})

describe('prepareRequest', () => {
  it('sends the enabled headers with a name', () => {
    const { request } = prepareRequest(draft({ headers: [row('1', 'Accept', 'application/json'), row('2', 'X-Off', '1', false), row('3', '', 'x')] }))
    expect(request?.headers).toEqual([{ name: 'Accept', value: 'application/json', source: 'user' }])
  })

  it('stops on an invalid URL', () => {
    const { request, issues } = prepareRequest(draft({ url: '' }))
    expect(request).toBeNull()
    expect(issues).toContainEqual({ level: 'error', code: 'url', problem: 'empty' })
  })

  it('tells when https:// was assumed', () => {
    const { request, issues } = prepareRequest(draft({ url: 'api.example.com' }))
    expect(request?.url).toBe('https://api.example.com')
    expect(issues[0]).toEqual({ level: 'notice', code: 'schemeAdded', url: 'https://api.example.com' })
  })

  it('adds the authorization of each type', () => {
    const auth = defaultAuth()
    auth.type = 'bearer'
    auth.settings.bearer.token = ' abc '
    expect(prepareRequest(draft({ auth })).request?.headers).toEqual([{ name: 'Authorization', value: 'Bearer abc', source: 'auth' }])

    auth.type = 'basic'
    auth.settings.basic = { username: 'raúl', password: 'pa:ss' }
    expect(prepareRequest(draft({ auth })).request?.headers[0].value).toBe(`Basic ${base64Utf8('raúl:pa:ss')}`)
    expect(base64Utf8('raúl:pa:ss')).toBe(Buffer.from('raúl:pa:ss', 'utf8').toString('base64'))

    auth.type = 'apiKey'
    auth.settings.apiKey = { name: 'api_key', value: 'k 1', location: 'query' }
    const query = prepareRequest(draft({ auth })).request
    expect(query?.url).toBe('https://api.example.com/users?api_key=k%201')
    expect(query?.headers).toEqual([])

    auth.settings.apiKey.location = 'header'
    expect(prepareRequest(draft({ auth })).request?.headers).toEqual([{ name: 'api_key', value: 'k 1', source: 'auth' }])
  })

  it('warns about incomplete authorization and lets the user header win', () => {
    const auth = defaultAuth()
    auth.type = 'bearer'
    expect(prepareRequest(draft({ auth })).issues).toContainEqual({ level: 'notice', code: 'authIncomplete', type: 'bearer' })

    auth.settings.bearer.token = 'abc'
    const { request, issues } = prepareRequest(draft({ auth, headers: [row('1', 'authorization', 'Token mine')] }))
    expect(request?.headers).toEqual([{ name: 'authorization', value: 'Token mine', source: 'user' }])
    expect(issues).toContainEqual({ level: 'notice', code: 'authOverridden', name: 'Authorization' })
  })

  it('serializes the body and adds its Content-Type', () => {
    const body = defaultBody()
    body.mode = 'json'
    body.text.json = '{"id": 12345678901234567890}'
    const { request } = prepareRequest(draft({ method: 'POST', body }))
    expect(request?.body).toBe('{"id": 12345678901234567890}')
    expect(request?.headers).toEqual([{ name: 'Content-Type', value: 'application/json', source: 'body' }])

    body.mode = 'form'
    body.form = [row('1', 'name', 'Raúl Estévez'), row('2', 'skip', 'x', false)]
    expect(prepareRequest(draft({ method: 'POST', body })).request?.body).toBe('name=Ra%C3%BAl+Est%C3%A9vez')
  })

  it('keeps a Content-Type typed by the user', () => {
    const body = defaultBody()
    body.mode = 'json'
    body.text.json = '{}'
    const { request } = prepareRequest(draft({ method: 'PUT', body, headers: [row('1', 'content-type', 'application/vnd.api+json')] }))
    expect(request?.headers).toEqual([{ name: 'content-type', value: 'application/vnd.api+json', source: 'user' }])
  })

  it('does not send a body with GET', () => {
    const body = defaultBody()
    body.mode = 'json'
    body.text.json = '{"a": 1}'
    expect(prepareRequest(draft({ body })).request).toEqual({ method: 'GET', url: 'https://api.example.com/users', headers: [], body: null })
  })

  it('stops on invalid JSON and says where', () => {
    const body = defaultBody()
    body.mode = 'json'
    body.text.json = '{"a": 1,}'
    const { request, issues } = prepareRequest(draft({ method: 'POST', body }))
    expect(request).toBeNull()
    expect(issues).toContainEqual(expect.objectContaining({ code: 'body', issue: expect.objectContaining({ code: 'invalidJson' }) }))
  })

  it('stops on headers fetch would reject, and warns about forbidden ones', () => {
    expect(prepareRequest(draft({ headers: [row('1', 'Bad Name', 'x')] })).issues).toContainEqual({ level: 'error', code: 'headerName', name: 'Bad Name' })
    expect(prepareRequest(draft({ headers: [row('1', 'X-Price', '5 €')] })).request).toBeNull()
    const { request, issues } = prepareRequest(draft({ headers: [row('1', 'Cookie', 'a=1')] }))
    expect(request).not.toBeNull()
    expect(issues).toContainEqual({ level: 'notice', code: 'forbiddenHeader', name: 'Cookie' })
  })
})
