import { describe, expect, it } from 'vitest'
import { draftReducer, emptyDraft } from './draft.ts'

describe('draftReducer', () => {
  it('fills the params from the URL and the URL from the params', () => {
    const typed = draftReducer(emptyDraft(), { type: 'url', url: 'https://api.example.com/items?page=2&sort=name' })
    expect(typed.params.map(({ key, value, enabled }) => ({ key, value, enabled }))).toEqual([
      { key: 'page', value: '2', enabled: true },
      { key: 'sort', value: 'name', enabled: true },
    ])

    const disabled = typed.params.map((row) => (row.key === 'sort' ? { ...row, enabled: false } : row))
    const edited = draftReducer(typed, { type: 'params', params: disabled })
    expect(edited.url).toBe('https://api.example.com/items?page=2')
    expect(edited.params).toHaveLength(2)

    // Typing in the URL keeps the disabled row
    const retyped = draftReducer(edited, { type: 'url', url: 'https://api.example.com/items?page=3' })
    expect(retyped.params.map((row) => `${row.key}=${row.value}:${row.enabled}`)).toEqual(['page=3:true', 'sort=name:false'])
  })
})
