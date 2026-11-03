import type { AuthContribution, AuthScheme } from './types.ts'

const NOTHING: AuthContribution = { headers: [], query: [] }

export const noAuth: AuthScheme<'none'> = {
  type: 'none',
  apply: () => NOTHING,
  isComplete: () => true,
}

export const bearerAuth: AuthScheme<'bearer'> = {
  type: 'bearer',
  apply: ({ token }) => (token.trim() ? { headers: [{ name: 'Authorization', value: `Bearer ${token.trim()}` }], query: [] } : NOTHING),
  isComplete: ({ token }) => token.trim() !== '',
}

/** Base64 of the UTF-8 bytes, so user names and passwords with accents are encoded as servers expect. */
export function base64Utf8(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export const basicAuth: AuthScheme<'basic'> = {
  type: 'basic',
  apply: ({ username, password }) =>
    username || password
      ? { headers: [{ name: 'Authorization', value: `Basic ${base64Utf8(`${username}:${password}`)}` }], query: [] }
      : NOTHING,
  isComplete: ({ username }) => username !== '',
}

export const apiKeyAuth: AuthScheme<'apiKey'> = {
  type: 'apiKey',
  apply: ({ name, value, location }) => {
    if (!name.trim()) return NOTHING
    return location === 'header'
      ? { headers: [{ name: name.trim(), value }], query: [] }
      : { headers: [], query: [{ key: name.trim(), value }] }
  },
  isComplete: ({ name, value }) => name.trim() !== '' && value !== '',
}
