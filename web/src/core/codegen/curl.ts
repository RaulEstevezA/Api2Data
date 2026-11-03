import type { PreparedRequest } from '../http/types.ts'
import type { CodeTarget } from './types.ts'

/** POSIX shell single quotes: everything is literal except the quote itself. */
export function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`
}

/** The command; with `include`, curl also prints the status line and the headers (-i), so its output can be pasted
 * back into Api2Data as a response. */
export function curlCommand(request: PreparedRequest, { include = false } = {}): string {
  const method = request.method === 'GET' ? '' : request.method === 'HEAD' ? '--head ' : `-X ${request.method} `
  const lines = [`curl ${include && request.method !== 'HEAD' ? '-i ' : ''}${method}${shellQuote(request.url)}`]
  for (const header of request.headers) lines.push(`-H ${shellQuote(`${header.name}: ${header.value}`)}`)
  if (request.body !== null) lines.push(`--data-raw ${shellQuote(request.body)}`)
  return lines.join(' \\\n  ')
}

export const curlTarget: CodeTarget = {
  id: 'curl',
  label: 'cURL',
  language: 'shell',
  generate: (request) => curlCommand(request),
}
