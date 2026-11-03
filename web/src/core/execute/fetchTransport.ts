import type { PreparedRequest } from '../http/types.ts'
import { classifyFailure } from './failure.ts'
import type { HttpTransport, SendResult } from './transport.ts'

export interface FetchEnvironment {
  fetch: typeof fetch
  now: () => number
  pageProtocol: string
  isOnline: () => boolean
}

/** Sends the request straight from the browser with fetch: no proxy and no server in between. The browser's
 * cookies and stored credentials are never added (`credentials: 'omit'`). */
export function createFetchTransport(environment: FetchEnvironment): HttpTransport {
  return {
    async send(request: PreparedRequest, signal: AbortSignal): Promise<SendResult> {
      const failure = (error: unknown) =>
        classifyFailure(error, {
          url: request.url,
          pageProtocol: environment.pageProtocol,
          online: environment.isOnline(),
          aborted: signal.aborted,
        })
      const started = environment.now()
      let response: Response
      try {
        response = await environment.fetch(request.url, {
          method: request.method,
          headers: request.headers.map((header): [string, string] => [header.name, header.value]),
          body: request.body,
          credentials: 'omit',
          redirect: 'follow',
          cache: 'no-store',
          signal,
        })
      } catch (error) {
        return { ok: false, failure: failure(error) }
      }

      let bytes: Uint8Array<ArrayBuffer>
      try {
        bytes = new Uint8Array(await response.arrayBuffer())
      } catch (error) {
        const reason = failure(error)
        return { ok: false, failure: reason.kind === 'aborted' ? reason : { kind: 'interrupted', detail: String(error) } }
      }

      return {
        ok: true,
        response: {
          status: response.status,
          statusText: response.statusText,
          url: response.url || request.url,
          redirected: response.redirected,
          headers: [...response.headers.entries()],
          bytes,
          durationMs: Math.max(0, Math.round(environment.now() - started)),
        },
      }
    },
  }
}
