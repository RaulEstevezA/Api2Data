import { describe, expect, it } from 'vitest'
import { defaultAuth } from '../auth/registry.ts'
import { defaultBody } from '../body/registry.ts'
import type { RequestDraft } from '../http/types.ts'
import { looksLikeCurl, parseCurl, tokenize } from './curl.ts'
import { createRequestFile, readRequestFile, requestFileName } from './requestFile.ts'

let next = 0
const newId = () => `id-${++next}`
const rows = (draft: RequestDraft) => draft.headers.map((row) => `${row.key}: ${row.value}`)

describe('tokenize', () => {
  it('splits like bash', () => {
    expect(tokenize(`curl 'a b' "c \\"d\\" \\$e" f\\ g \\\n  $'h\\ni\\'j' x"y"'z'`)).toEqual([
      'curl',
      'a b',
      'c "d" $e',
      'f g',
      "h\ni'j",
      'xyz',
    ])
    expect(tokenize("curl 'open")).toBeNull()
  })
})

describe('parseCurl', () => {
  it('reads what browser devtools copy', () => {
    const command = `curl 'https://api.example.com/v1/users?page=2' \\
  -H 'accept: application/json' \\
  -H 'authorization: Bearer abc.def' \\
  -H 'content-type: application/json' \\
  --data-raw '{"name":"Raúl Estévez","active":true}' \\
  --compressed`
    const result = parseCurl(command, newId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { draft } = result
    expect(draft.method).toBe('POST')
    expect(draft.url).toBe('https://api.example.com/v1/users?page=2')
    expect(rows(draft)).toEqual(['accept: application/json'])
    expect(draft.auth.type).toBe('bearer')
    expect(draft.auth.settings.bearer.token).toBe('abc.def')
    expect(draft.body.mode).toBe('json')
    expect(draft.body.text.json).toBe('{"name":"Raúl Estévez","active":true}')
    expect(result.notices).toEqual([{ code: 'ignored', options: ['--compressed'] }])
  })

  it('handles methods, grouped flags, Basic auth and forms', () => {
    const result = parseCurl("curl -sSL -XPUT -u raul:pa:ss https://a.example.com/x -d 'name=Ra%C3%BAl+E&x=1'", newId)
    expect(result.ok && result.draft.method).toBe('PUT')
    if (!result.ok) return
    expect(result.draft.auth.settings.basic).toEqual({ username: 'raul', password: 'pa:ss' })
    expect(result.draft.body.mode).toBe('form')
    expect(result.draft.body.form.map(({ key, value }) => `${key}=${value}`)).toEqual(['name=Raúl E', 'x=1'])
    expect(result.notices).toEqual([{ code: 'ignored', options: ['-s', '-S', '-L'] }])
  })

  it('moves data to the query with -G and reads -I', () => {
    const get = parseCurl("curl -G https://a.example.com/search -d q=red --data-urlencode 'tag=a b'", newId)
    expect(get.ok && get.draft.url).toBe('https://a.example.com/search?q=red&tag=a%20b')
    expect(get.ok && get.draft.method).toBe('GET')
    const head = parseCurl('curl -I https://a.example.com', newId)
    expect(head.ok && head.draft.method).toBe('HEAD')
  })

  it('says what it could not bring over', () => {
    const result = parseCurl("curl https://a.example.com -d @body.json -F 'file=@a.png' -X FETCH", newId)
    expect(result.ok && result.notices).toEqual([
      { code: 'dataFile', option: '-d' },
      { code: 'multipart' },
      { code: 'unknownMethod', method: 'FETCH' },
    ])
    expect(parseCurl('curl -H "a: b"', newId)).toEqual({ ok: false, problem: 'noUrl' })
    expect(parseCurl('https://a.example.com', newId)).toEqual({ ok: false, problem: 'notCurl' })
    expect(looksLikeCurl('  curl https://x')).toBe(true)
  })

  it('keeps a Content-Type that the body mode would not add', () => {
    const result = parseCurl(`curl https://a.example.com -H 'Content-Type: application/vnd.api+json' -d '{}'`, newId)
    expect(result.ok && result.draft.body.mode).toBe('json')
    expect(result.ok && rows(result.draft)).toEqual(['Content-Type: application/vnd.api+json'])
  })
})

describe('request files', () => {
  const auth = defaultAuth()
  auth.type = 'bearer'
  auth.settings.bearer.token = 'secret'
  const draft: RequestDraft = {
    method: 'PATCH',
    url: 'https://api.example.com/users/7',
    params: [],
    headers: [{ id: 'h', key: 'X-Trace', value: '1', enabled: false }],
    auth,
    body: { ...defaultBody(), mode: 'json', text: { json: '{"a":1}', text: '', xml: '' } },
  }

  it('exports without credentials and reads it back', () => {
    const text = createRequestFile(draft, new Date('2026-11-03T10:00:00Z'))
    expect(text).not.toContain('secret')
    const read = readRequestFile(text, newId)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.draft.method).toBe('PATCH')
    expect(read.draft.auth.type).toBe('bearer')
    expect(read.draft.headers.map(({ key, enabled }) => ({ key, enabled }))).toEqual([{ key: 'X-Trace', enabled: false }])
    expect(read.draft.body.text.json).toBe('{"a":1}')
    expect(requestFileName(draft)).toBe('7.api2data.json')
    expect(requestFileName({ ...draft, url: 'not a url' })).toBe('request.api2data.json')
  })

  it('opens a cURL command saved as text and rejects other files', () => {
    expect(readRequestFile('curl https://a.example.com', newId)).toMatchObject({ ok: true, source: 'curl' })
    expect(readRequestFile('{"format":"api2data-request","version":9}', newId)).toEqual({ ok: false, problem: 'version' })
    expect(readRequestFile('{"other":true}', newId)).toEqual({ ok: false, problem: 'notRequest' })
    expect(readRequestFile('hello', newId)).toEqual({ ok: false, problem: 'notRequest' })
  })
})
