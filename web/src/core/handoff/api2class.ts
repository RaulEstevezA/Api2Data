import type { HttpMethod } from '../http/methods.ts'
import { splitUrl } from '../request/url.ts'

/** "Open in Api2Class": a JSON response passed to Api2Class through sessionStorage (same origin,
 * raulesteveza.github.io), following personal_web_style patterns/tool-continuity.md. Api2Class reads
 * `api2class.incoming` once, removes it and validates the content like pasted JSON. */

export const JSON_HANDOFF_FORMAT = 'json-handoff'
export const JSON_HANDOFF_VERSION = 1
export const API2CLASS_KEY = 'api2class.incoming'
export const API2CLASS_PATH = '/tools/Api2Class/'

// Far above any response worth turning into models, and small enough for sessionStorage
export const MAX_JSON_HANDOFF_SIZE = 4 * 1024 * 1024

export interface JsonHandoff {
  format: typeof JSON_HANDOFF_FORMAT
  version: typeof JSON_HANDOFF_VERSION
  from: 'api2data'
  /** The response body, as received */
  text: { format: 'json'; content: string }
  /** Where it came from, to show "Response received from Api2Data (GET /users)". Without the query string or
   * credentials: it may hold API keys. */
  source: { method: HttpMethod; url: string }
}

/** Address without query, fragment or user info, safe to pass along. */
export function publicUrl(url: string): string {
  const { base } = splitUrl(url)
  try {
    const parsed = new URL(base)
    parsed.username = ''
    parsed.password = ''
    return parsed.toString()
  } catch {
    return base
  }
}

export function createJsonHandoff(content: string, method: HttpMethod, url: string): JsonHandoff | null {
  if (content.length > MAX_JSON_HANDOFF_SIZE) return null
  return {
    format: JSON_HANDOFF_FORMAT,
    version: JSON_HANDOFF_VERSION,
    from: 'api2data',
    text: { format: 'json', content },
    source: { method, url: publicUrl(url) },
  }
}

/** Leaves the response for Api2Class and opens it in the same tab. Returns false when the browser cannot keep it
 * (storage blocked or full), so the user can be told and nothing is lost. */
export function openInApi2Class(handoff: JsonHandoff, storage: Pick<Storage, 'setItem'>, navigate: (url: string) => void): boolean {
  try {
    storage.setItem(API2CLASS_KEY, JSON.stringify(handoff))
  } catch {
    return false
  }
  navigate(API2CLASS_PATH)
  return true
}
