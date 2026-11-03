import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, hostOf } from './format.ts'

describe('format', () => {
  it('formats sizes and durations', () => {
    expect(formatBytes(512, 'en')).toBe('512 B')
    expect(formatBytes(2355, 'en')).toBe('2.3 KB')
    expect(formatBytes(2355, 'es')).toBe('2,3 KB')
    expect(formatBytes(150 * 1024 * 1024, 'en')).toBe('150 MB')
    expect(formatDuration(142, 'en')).toBe('142 ms')
    expect(formatDuration(1240, 'es')).toBe('1,24 s')
    expect(hostOf('https://api.example.com:8443/x')).toBe('api.example.com:8443')
  })
})
