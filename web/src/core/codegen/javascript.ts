import type { CodeTarget } from './types.ts'

const js = (text: string) =>
  JSON.stringify(text)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

/** Template literal, so a multi-line body stays readable. */
function template(text: string): string {
  return `\`${text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``
}

export const fetchTarget: CodeTarget = {
  id: 'fetch',
  label: 'JavaScript (fetch)',
  language: 'javascript',
  generate: (request) => {
    const options: string[] = [`  method: ${js(request.method)},`]
    if (request.headers.length > 0) {
      options.push('  headers: {')
      for (const header of request.headers) options.push(`    ${js(header.name)}: ${js(header.value)},`)
      options.push('  },')
    }
    if (request.body !== null) options.push(`  body: ${request.body.includes('\n') ? template(request.body) : js(request.body)},`)
    return [
      `const response = await fetch(${js(request.url)}, {`,
      ...options,
      '})',
      '',
      'console.log(response.status)',
      request.method === 'HEAD' ? 'console.log([...response.headers])' : 'console.log(await response.text())',
    ].join('\n')
  },
}
