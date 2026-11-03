import { describe, expect, it } from 'vitest'
import { defaultAuth } from '../auth/registry.ts'
import { defaultBody } from '../body/registry.ts'
import type { RequestDraft } from '../http/types.ts'
import { hasCredentials, redactDraft } from '../request/redact.ts'
import { readDraft } from '../request/draftFormat.ts'
import { addEntry, MAX_HISTORY_ENTRIES, parseHistory, removeEntry, serializeHistory, type HistoryEntry } from './history.ts'
import { createHistoryStore, HISTORY_KEY } from './store.ts'

let next = 0
const newId = () => `id-${++next}`

function draft(overrides: Partial<RequestDraft> = {}): RequestDraft {
  return {
    method: 'GET',
    url: 'https://api.example.com/users',
    params: [],
    headers: [],
    auth: defaultAuth(),
    body: defaultBody(),
    ...overrides,
  }
}

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id: newId(), sentAt: '2026-11-03T10:00:00.000Z', draft: draft(), outcome: { status: 200 }, withCredentials: false, ...overrides }
}

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

describe('redactDraft', () => {
  it('removes tokens, passwords, keys and sensitive values', () => {
    const auth = defaultAuth()
    auth.type = 'basic'
    auth.settings.basic = { username: 'raul', password: 'secret' }
    auth.settings.bearer.token = 'abc'
    auth.settings.apiKey = { name: 'X-API-Key', value: 'k', location: 'header' }
    const original = draft({
      url: 'https://user:pass@api.example.com/items?page=2&api_key=123#top',
      params: [
        { id: '1', key: 'page', value: '2', enabled: true },
        { id: '2', key: 'api_key', value: '123', enabled: true },
        { id: '3', key: 'token', value: 'off', enabled: false },
      ],
      headers: [
        { id: '4', key: 'Accept', value: 'application/json', enabled: true },
        { id: '5', key: 'Authorization', value: 'Bearer abc', enabled: true },
        { id: '6', key: 'X-Session-Id', value: 's1', enabled: true },
      ],
      auth,
    })
    expect(hasCredentials(original)).toBe(true)

    const clean = redactDraft(original)
    expect(clean.url).toBe('https://api.example.com/items?page=2&api_key=#top')
    expect(clean.params.map((row) => row.value)).toEqual(['2', '', ''])
    expect(clean.headers.map((row) => row.value)).toEqual(['application/json', '', ''])
    expect(clean.auth.type).toBe('basic')
    expect(clean.auth.settings).toMatchObject({
      basic: { username: 'raul', password: '' },
      bearer: { token: '' },
      apiKey: { name: 'X-API-Key', value: '' },
    })
    expect(hasCredentials(clean)).toBe(false)
  })

  it('keeps a request without credentials as it is', () => {
    const plain = draft({ headers: [{ id: '1', key: 'Accept', value: 'text/xml', enabled: true }] })
    expect(hasCredentials(plain)).toBe(false)
    expect(redactDraft(plain)).toEqual(plain)
  })
})

describe('readDraft', () => {
  it('rejects malformed drafts and fills defaults', () => {
    expect(readDraft(null, newId)).toBeNull()
    expect(readDraft({ method: 'FETCH', url: 'x' }, newId)).toBeNull()
    expect(readDraft({ method: 'GET', url: 'x', headers: 'nope' }, newId)).toBeNull()
    const read = readDraft(
      { method: 'POST', url: 'https://a.example.com', body: { mode: 'json', text: { json: '{}' } }, auth: { type: 'weird' } },
      newId,
    )
    expect(read?.body.mode).toBe('json')
    expect(read?.body.text.json).toBe('{}')
    expect(read?.auth.type).toBe('none')
  })
})

describe('history', () => {
  it('adds the newest first, replaces a repeated request and keeps the limit', () => {
    const first = entry()
    const other = entry({ draft: draft({ url: 'https://api.example.com/other' }) })
    let entries = addEntry([], first)
    entries = addEntry(entries, other)
    const again = entry({ draft: draft({ url: 'https://api.example.com/other' }), outcome: { status: 404 } })
    entries = addEntry(entries, again)
    expect(entries.map((item) => item.id)).toEqual([again.id, first.id])

    for (let index = 0; index < MAX_HISTORY_ENTRIES + 5; index++)
      entries = addEntry(entries, entry({ draft: draft({ url: `https://a.example.com/${index}` }) }))
    expect(entries).toHaveLength(MAX_HISTORY_ENTRIES)
    expect(removeEntry(entries, entries[0].id)).toHaveLength(MAX_HISTORY_ENTRIES - 1)
  })

  it('round-trips through its stored form', () => {
    const body = defaultBody()
    body.mode = 'form'
    body.form = [{ id: 'f', key: 'name', value: 'Raúl Estévez', enabled: true }]
    const saved = [
      entry({
        draft: draft({ method: 'POST', body, params: [{ id: 'p', key: 'debug', value: '1', enabled: false }] }),
        outcome: { status: 201 },
      }),
      entry({ outcome: { failure: 'blocked' } }),
    ]
    const read = parseHistory(serializeHistory(saved), newId)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.entries.map((item) => item.outcome)).toEqual([{ status: 201 }, { failure: 'blocked' }])
    expect(read.entries[0].draft.body.form.map(({ key, value }) => ({ key, value }))).toEqual([{ key: 'name', value: 'Raúl Estévez' }])
    expect(read.entries[0].draft.params.map(({ key, enabled }) => ({ key, enabled }))).toEqual([{ key: 'debug', enabled: false }])
  })

  it('reports another version or damaged data instead of losing it silently', () => {
    expect(parseHistory(null, newId)).toEqual({ ok: true, entries: [] })
    expect(parseHistory('{', newId)).toEqual({ ok: false, reason: 'damaged' })
    expect(parseHistory('{"version":2,"entries":[]}', newId)).toEqual({ ok: false, reason: 'version' })
    const stored = JSON.parse(serializeHistory([entry()]))
    const partial = parseHistory(JSON.stringify({ version: 1, entries: [{ bad: true }, ...stored.entries] }), newId)
    expect(partial.ok && partial.entries).toHaveLength(1)
  })
})

describe('history store', () => {
  it('saves, loads and clears', () => {
    const storage = memoryStorage()
    const store = createHistoryStore(storage)
    expect(store.save([entry()])).toBe(true)
    expect(storage.items.has(HISTORY_KEY)).toBe(true)
    const loaded = store.load(newId)
    expect(loaded.ok && loaded.entries).toHaveLength(1)
    store.save([])
    expect(storage.items.has(HISTORY_KEY)).toBe(false)
  })

  it('never throws when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    const store = createHistoryStore(blocked)
    expect(store.load(newId)).toEqual({ ok: true, entries: [] })
    expect(store.save([entry()])).toBe(false)
    expect(() => store.clear()).not.toThrow()
  })
})
