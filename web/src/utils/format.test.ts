import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, formatWhen, hostOf } from './format.ts'

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
  it('says when, briefly', () => {
    const now = new Date(2026, 10, 3, 18, 0)
    expect(formatWhen(new Date(2026, 10, 3, 10, 42).toISOString(), 'es', now)).toBe('10:42')
    expect(formatWhen(new Date(2026, 10, 1, 9, 5).toISOString(), 'es', now)).toBe('1 nov, 09:05')
    expect(formatWhen(new Date(2025, 0, 2, 9, 5).toISOString(), 'en', now)).toBe('Jan 2, 2025, 09:05 AM')
  })
})
