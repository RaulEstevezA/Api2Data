import { describe, expect, it } from 'vitest'
import { API2CLASS_KEY, API2CLASS_PATH, createJsonHandoff, MAX_JSON_HANDOFF_SIZE, openInApi2Class, publicUrl } from './api2class.ts'

describe('Api2Class handoff', () => {
  it('never passes query strings or user info along', () => {
    expect(publicUrl('https://user:secret@api.example.com/users?api_key=abc#x')).toBe('https://api.example.com/users')
  })

  it('creates the handoff and leaves it for Api2Class', () => {
    const handoff = createJsonHandoff('{"id":1}', 'GET', 'https://api.example.com/users/1?token=abc')!
    expect(handoff).toEqual({
      format: 'json-handoff',
      version: 1,
      from: 'api2data',
      text: { format: 'json', content: '{"id":1}' },
      source: { method: 'GET', url: 'https://api.example.com/users/1' },
    })

    const stored = new Map<string, string>()
    let opened = ''
    expect(openInApi2Class(handoff, { setItem: (key, value) => stored.set(key, value) }, (url) => (opened = url))).toBe(true)
    expect(JSON.parse(stored.get(API2CLASS_KEY)!)).toEqual(handoff)
    expect(opened).toBe(API2CLASS_PATH)
  })

  it('refuses what does not fit and reports blocked storage', () => {
    expect(createJsonHandoff('x'.repeat(MAX_JSON_HANDOFF_SIZE + 1), 'GET', 'https://a.example.com')).toBeNull()
    const blocked = {
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(openInApi2Class(createJsonHandoff('{}', 'GET', 'https://a.example.com')!, blocked, () => {})).toBe(false)
  })
})
