/** The cases in shared/test-cases/, which the desktop version's tests read too (shared/README.md).
 *
 * calls/<module>.<function>.json: arguments of a core function and the result it must give.
 *
 * `UPDATE_SHARED=1 npx vitest run src/core/shared.test.ts` writes the results again from what the web version does
 * now; the desktop version then has to match them. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyAuth, isAuthComplete } from './auth/registry.ts'
import { base64Utf8 } from './auth/schemes.ts'
import { bodyKind } from './body/registry.ts'
import type { BodyConfig, BodyMode } from './body/types.ts'
import { curlCommand } from './codegen/curl.ts'
import { findCodeTarget } from './codegen/registry.ts'
import { addEntry, parseHistory, serializeHistory } from './history/history.ts'
import type { HttpResponse, PreparedRequest } from './http/types.ts'
import { looksLikeCurl, parseCurl, tokenize } from './import/curl.ts'
import { createRequestFile, readRequestFile, requestFileName } from './import/requestFile.ts'
import { prettyJson } from './json/pretty.ts'
import { prepareRequest } from './request/build.ts'
import { readDraft, toStoredDraft } from './request/draftFormat.ts'
import { isForbiddenHeader, isValidHeaderName, isValidHeaderValue } from './request/headers.ts'
import { hasCredentials, isSensitiveName, redactDraft } from './request/redact.ts'
import { appendQuery, encodeQueryPart, paramsFromUrl, parseQuery, resolveUrl, splitUrl, urlWithParams } from './request/url.ts'
import { parseContentType, sniffCharset } from './response/contentType.ts'
import { processResponse } from './response/process.ts'
import { reasonPhrase, statusClass } from './response/status.ts'
import { isBinary, viewText } from './response/viewers.ts'
import { prettyXml } from './response/xml.ts'

// Tests run from web/
const SHARED = resolve(process.cwd(), '../shared/test-cases')
const UPDATE = process.env.UPDATE_SHARED === '1'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => unknown

/** Row ids for functions that create rows: the same sequence in both versions, starting again on every call. */
const ids = () => {
  let next = 0
  return () => `id-${++next}`
}

/** A response as stored in the files: the body as text, or as a list of bytes when it is not UTF-8. */
type StoredResponse = Omit<HttpResponse, 'bytes'> & { body: string | number[] }
const toResponse = ({ body, ...rest }: StoredResponse): HttpResponse => ({
  ...rest,
  bytes: typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body),
})

const FUNCTIONS: Record<string, AnyFunction> = {
  'url.splitUrl': splitUrl,
  'url.parseQuery': parseQuery,
  'url.encodeQueryPart': encodeQueryPart,
  'url.urlWithParams': urlWithParams,
  'url.paramsFromUrl': (url, previous) => paramsFromUrl(url, previous, ids()),
  'url.appendQuery': appendQuery,
  'url.resolveUrl': resolveUrl,
  'headers.isForbiddenHeader': isForbiddenHeader,
  'headers.isValidHeaderName': isValidHeaderName,
  'headers.isValidHeaderValue': isValidHeaderValue,
  'auth.base64Utf8': base64Utf8,
  'auth.applyAuth': applyAuth,
  'auth.isAuthComplete': isAuthComplete,
  'body.serialize': (mode: BodyMode, config: BodyConfig) => bodyKind(mode).serialize(config),
  'body.validate': (mode: BodyMode, config: BodyConfig) => bodyKind(mode).validate(config),
  'build.prepareRequest': prepareRequest,
  'redact.redactDraft': redactDraft,
  'redact.hasCredentials': hasCredentials,
  'redact.isSensitiveName': isSensitiveName,
  'draftFormat.readDraft': (value) => readDraft(value, ids()),
  'draftFormat.toStoredDraft': toStoredDraft,
  'pretty.prettyJson': prettyJson,
  'xml.prettyXml': prettyXml,
  'contentType.parseContentType': parseContentType,
  'contentType.sniffCharset': (bytes: number[], mediaType: string | null) => sniffCharset(new Uint8Array(bytes), mediaType),
  'status.reasonPhrase': reasonPhrase,
  'status.statusClass': statusClass,
  'viewers.viewText': viewText,
  'viewers.isBinary': (mediaType: string | null, bytes: number[]) => isBinary(mediaType, new Uint8Array(bytes)),
  // The bytes are left out of the result: the body is already in the views and the raw text
  'process.processResponse': (response: StoredResponse) => ({ ...processResponse(toResponse(response)), bytes: undefined }),
  'curl.tokenize': tokenize,
  'curl.looksLikeCurl': looksLikeCurl,
  'curl.parseCurl': (command) => parseCurl(command, ids()),
  'curl.curlCommand': (request: PreparedRequest, options) => curlCommand(request, options),
  'requestFile.createRequestFile': (draft, date: string) => createRequestFile(draft, new Date(date)),
  'requestFile.readRequestFile': (text) => readRequestFile(text, ids()),
  'requestFile.requestFileName': requestFileName,
  'history.addEntry': addEntry,
  'history.serializeHistory': serializeHistory,
  'history.parseHistory': (text) => parseHistory(text, ids()),
  'codegen.generate': (id: string, request: PreparedRequest) => findCodeTarget(id).generate(request),
}

/** What JSON keeps of a value: the files hold JSON, so `undefined` keys disappear as they do there. */
const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value === undefined ? null : value))

const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`)

describe('shared calls', () => {
  const folder = join(SHARED, 'calls')
  for (const file of readdirSync(folder).filter((name) => name.endsWith('.json'))) {
    const name = file.slice(0, -'.json'.length)
    it(name, () => {
      const fn = FUNCTIONS[name]
      expect(fn, `no function for ${file}`).toBeDefined()
      const path = join(folder, file)
      const cases: { args: unknown[]; result: unknown }[] = JSON.parse(readFileSync(path, 'utf8'))
      const results = cases.map((item) => asJson(fn(...item.args)))
      if (UPDATE)
        return writeJson(
          path,
          cases.map((item, index) => ({ args: item.args, result: results[index] })),
        )
      cases.forEach((item, index) => expect(results[index], `${name} #${index}`).toEqual(item.result))
    })
  }
})
