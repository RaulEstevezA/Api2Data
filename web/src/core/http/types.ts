import type { AuthConfig } from '../auth/types.ts'
import type { BodyConfig } from '../body/types.ts'
import type { HttpMethod } from './methods.ts'

/** One row of the Params, Headers or form body tables. Disabled rows are kept but not sent. */
export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
}

/** Everything the user has set up, exactly as typed. Nothing here has been validated or encoded yet. */
export interface RequestDraft {
  method: HttpMethod
  /** The address as shown in the URL bar, query string included */
  url: string
  /** Mirrors the query string of `url`, plus the disabled rows that are not in it */
  params: KeyValue[]
  headers: KeyValue[]
  auth: AuthConfig
  body: BodyConfig
}

/** Where a header of the prepared request comes from, so the interface can say why it is there. */
export type HeaderSource = 'user' | 'auth' | 'body'

export interface PreparedHeader {
  name: string
  value: string
  source: HeaderSource
}

/** A request ready to be sent: absolute URL, final headers and serialized body. */
export interface PreparedRequest {
  method: HttpMethod
  url: string
  headers: PreparedHeader[]
  body: string | null
}

/** A received response, independent of how it was obtained (fetch today, the desktop app later). */
export interface HttpResponse {
  status: number
  statusText: string
  /** Final address after redirects */
  url: string
  redirected: boolean
  headers: [string, string][]
  /** The body as received, after decompression */
  bytes: Uint8Array<ArrayBuffer>
  /** Milliseconds from sending to the end of the body; null when Api2Data did not measure it */
  durationMs: number | null
  /** Sent by Api2Data, or pasted from the output of curl (text already decoded by the terminal) */
  origin: 'sent' | 'pasted'
}
