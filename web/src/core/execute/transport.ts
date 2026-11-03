import type { HttpResponse, PreparedRequest } from '../http/types.ts'

/** Why no response could be read. The browser gives the same opaque error for CORS, DNS and refused connections,
 * so `blocked` covers all of them and the interface explains the likely causes. */
export type SendFailure =
  | { kind: 'aborted' }
  | { kind: 'offline' }
  | { kind: 'mixedContent' }
  | { kind: 'blocked'; detail: string }
  | { kind: 'interrupted'; detail: string }

export type SendResult = { ok: true; response: HttpResponse } | { ok: false; failure: SendFailure }

/** Sends a prepared request. The interface depends on this contract, not on fetch, so the desktop app or the tests
 * can provide another implementation. */
export interface HttpTransport {
  send(request: PreparedRequest, signal: AbortSignal): Promise<SendResult>
}
