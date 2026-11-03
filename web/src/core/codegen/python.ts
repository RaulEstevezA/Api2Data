import type { CodeTarget } from './types.ts'

/** A JSON string is also a valid Python string literal (same escapes). */
const py = (text: string) => JSON.stringify(text)

/** Triple-quoted string for multi-line bodies; backslashes, inner triple quotes and a final quote are escaped. */
function triple(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"').replace(/"$/, '\\"')
  return `"""${escaped}"""`
}

export const requestsTarget: CodeTarget = {
  id: 'python',
  label: 'Python (requests)',
  language: 'python',
  generate: (request) => {
    const args: string[] = [`    ${py(request.url)},`]
    if (request.headers.length > 0) {
      args.push('    headers={')
      for (const header of request.headers) args.push(`        ${py(header.name)}: ${py(header.value)},`)
      args.push('    },')
    }
    // Encoded explicitly: a str body would be sent as Latin-1 and fail with other characters
    if (request.body !== null)
      args.push(`    data=${request.body.includes('\n') ? triple(request.body) : py(request.body)}.encode("utf-8"),`)
    return [
      'import requests',
      '',
      `response = requests.${request.method.toLowerCase()}(`,
      ...args,
      ')',
      '',
      'print(response.status_code)',
      request.method === 'HEAD' ? 'print(response.headers)' : 'print(response.text)',
    ].join('\n')
  },
}
