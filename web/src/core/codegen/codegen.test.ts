import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import type { PreparedRequest } from '../http/types.ts'
import { curlTarget, shellQuote } from './curl.ts'
import { fetchTarget } from './javascript.ts'
import { requestsTarget } from './python.ts'
import { CODE_TARGETS, findCodeTarget } from './registry.ts'

function available(command: string): boolean {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Quotes, backslashes, template syntax, accents and line breaks: what usually breaks generated code
const TRICKY = '{\n  "name": "Raúl Estévez",\n  "quote": "it\'s `a` ${test} \\\\ \\"q\\"",\n  "end": "x"\n}'

const request: PreparedRequest = {
  method: 'POST',
  url: 'https://api.example.com/items?q=a%20b&x=1',
  headers: [
    { name: 'Content-Type', value: 'application/json', source: 'body' },
    { name: 'Authorization', value: "Bearer it's", source: 'auth' },
  ],
  body: TRICKY,
}

describe('code targets', () => {
  it('writes cURL', () => {
    expect(curlTarget.generate({ method: 'GET', url: 'https://a.example.com/x', headers: [], body: null })).toBe(
      "curl 'https://a.example.com/x'",
    )
    expect(curlTarget.generate({ method: 'HEAD', url: 'https://a.example.com', headers: [], body: null })).toBe(
      "curl --head 'https://a.example.com'",
    )
    expect(curlTarget.generate(request).split(' \\\n  ')).toEqual([
      "curl -X POST 'https://api.example.com/items?q=a%20b&x=1'",
      "-H 'Content-Type: application/json'",
      "-H 'Authorization: Bearer it'\\''s'",
      `--data-raw ${shellQuote(TRICKY)}`,
    ])
  })

  it('writes JavaScript and Python with the same parts', () => {
    const js = fetchTarget.generate(request)
    expect(js).toContain('const response = await fetch("https://api.example.com/items?q=a%20b&x=1", {')
    expect(js).toContain('"Authorization": "Bearer it\'s",')
    const python = requestsTarget.generate(request)
    expect(python).toContain('response = requests.post(')
    expect(python).toContain('.encode("utf-8"),')
  })

  it('falls back to the first target', () => {
    expect(findCodeTarget('nope')).toBe(CODE_TARGETS[0])
    expect(findCodeTarget('python')).toBe(requestsTarget)
  })

  it.skipIf(!available('bash'))('quotes the shell so the body arrives unchanged', () => {
    const echoed = execFileSync('bash', ['-c', `printf %s ${shellQuote(TRICKY)}`]).toString()
    expect(echoed).toBe(TRICKY)
  })

  it('writes JavaScript that parses and keeps the body', () => {
    const js = fetchTarget.generate(request)
    const calls: { url: string; init: { body: string; headers: Record<string, string> } }[] = []
    const fakeFetch = async (url: string, init: { body: string; headers: Record<string, string> }) => {
      calls.push({ url, init })
      return { status: 200, text: async () => '', headers: [] }
    }
    const run = new Function('fetch', 'console', `return (async () => {\n${js}\n})()`)
    return run(fakeFetch, { log: () => {} }).then(() => {
      expect(calls[0].url).toBe(request.url)
      expect(calls[0].init.body).toBe(TRICKY)
      expect(calls[0].init.headers.Authorization).toBe("Bearer it's")
    })
  })

  it.skipIf(!available('python3'))('writes Python whose body literal is the same text', () => {
    const python = requestsTarget.generate(request)
    // Replace the call by a stand-in that prints what it receives
    const program = python
      .replace(
        'import requests',
        'import json\nclass R:\n  status_code=200\n  text=""\nclass requests:\n  @staticmethod\n  def post(url, headers=None, data=None):\n    print(json.dumps({"url": url, "headers": headers, "data": data.decode("utf-8")}))\n    return R()',
      )
      .replace(/print\(response\.[a-z_]+\)/g, '')
    const output = JSON.parse(execFileSync('python3', ['-c', program]).toString())
    expect(output).toEqual({
      url: request.url,
      headers: { 'Content-Type': 'application/json', Authorization: "Bearer it's" },
      data: TRICKY,
    })
  })
})
