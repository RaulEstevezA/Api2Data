import type { SendFailure } from './transport.ts'

export interface FailureContext {
  /** The address requested */
  url: string
  /** Protocol of the page running Api2Data ("https:" once published) */
  pageProtocol: string
  online: boolean
  aborted: boolean
}

// Browsers let https pages call http on the local machine
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isMixedContent(url: string, pageProtocol: string): boolean {
  if (pageProtocol !== 'https:') return false
  try {
    const target = new URL(url)
    return target.protocol === 'http:' && !LOCAL_HOSTS.has(target.hostname) && !target.hostname.endsWith('.localhost')
  } catch {
    return false
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Gives the most precise explanation the browser allows for a request that produced no response. */
export function classifyFailure(error: unknown, context: FailureContext): SendFailure {
  if (context.aborted || (error instanceof Error && error.name === 'AbortError')) return { kind: 'aborted' }
  if (!context.online) return { kind: 'offline' }
  if (isMixedContent(context.url, context.pageProtocol)) return { kind: 'mixedContent' }
  return { kind: 'blocked', detail: describe(error) }
}
