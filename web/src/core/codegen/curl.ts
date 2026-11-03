import type { CodeTarget } from './types.ts'

/** POSIX shell single quotes: everything is literal except the quote itself. */
export function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`
}

export const curlTarget: CodeTarget = {
  id: 'curl',
  label: 'cURL',
  language: 'shell',
  generate: (request) => {
    const lines = [
      `curl ${request.method === 'GET' ? '' : request.method === 'HEAD' ? '--head ' : `-X ${request.method} `}${shellQuote(request.url)}`,
    ]
    for (const header of request.headers) lines.push(`-H ${shellQuote(`${header.name}: ${header.value}`)}`)
    if (request.body !== null) lines.push(`--data-raw ${shellQuote(request.body)}`)
    return lines.join(' \\\n  ')
  },
}
