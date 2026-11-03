import type { RequestDraft } from '../http/types.ts'
import { readDraft, toStoredDraft } from '../request/draftFormat.ts'
import { redactDraft } from '../request/redact.ts'
import { looksLikeCurl, parseCurl, type CurlNotice } from './curl.ts'

export const REQUEST_FILE_FORMAT = 'api2data-request'
export const REQUEST_FILE_VERSION = 1
export const REQUEST_FILE_EXTENSION = '.api2data.json'
// Far above any request; stops a file opened by mistake from freezing the page
export const MAX_REQUEST_FILE_SIZE = 5 * 1024 * 1024

/** A request saved to share or reopen. Credentials are never written: the file may be passed around. */
export function createRequestFile(draft: RequestDraft, exportedAt: Date): string {
  const file = {
    format: REQUEST_FILE_FORMAT,
    version: REQUEST_FILE_VERSION,
    exportedAt: exportedAt.toISOString(),
    request: toStoredDraft(redactDraft(draft)),
  }
  return JSON.stringify(file, null, 2) + '\n'
}

/** File name from the last part of the address, decoded: "users.api2data.json", "ñandú.api2data.json". */
export function requestFileName(draft: RequestDraft): string {
  let name = ''
  try {
    const url = new URL(draft.url)
    name = url.pathname.split('/').filter(Boolean).at(-1) ?? url.hostname
    name = decodeURIComponent(name)
  } catch {
    // An address that cannot be read, or a segment with a broken escape: the name is not worth an error
  }
  const safe = name
    .replace(/[^\p{L}\p{N}_.-]+/gu, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60)
  return `${safe || 'request'}${REQUEST_FILE_EXTENSION}`
}

export type ImportResult =
  | { ok: true; draft: RequestDraft; source: 'file' | 'curl'; notices: CurlNotice[] }
  | { ok: false; problem: 'unreadable' | 'version' | 'notRequest' }

/** Reads an opened file: an Api2Data request, or a text file with a cURL command. */
export function readRequestFile(text: string, newId: () => string): ImportResult {
  if (looksLikeCurl(text)) {
    const curl = parseCurl(text, newId)
    return curl.ok ? { ok: true, draft: curl.draft, source: 'curl', notices: curl.notices } : { ok: false, problem: 'unreadable' }
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, problem: 'notRequest' }
  }
  if (typeof data !== 'object' || data === null) return { ok: false, problem: 'notRequest' }
  const file = data as Record<string, unknown>
  if (file.format !== REQUEST_FILE_FORMAT) return { ok: false, problem: 'notRequest' }
  if (file.version !== REQUEST_FILE_VERSION) return { ok: false, problem: 'version' }
  const draft = readDraft(file.request, newId)
  return draft ? { ok: true, draft, source: 'file', notices: [] } : { ok: false, problem: 'unreadable' }
}
