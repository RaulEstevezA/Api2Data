import { parseJson, type JsonErrorInfo } from '../json/parse.ts'
import { prettyJson } from '../json/pretty.ts'
import { prettyXml } from './xml.ts'

export type ViewKind = 'json' | 'xml' | 'html' | 'text'
export type ViewLanguage = 'json' | 'xml' | null

/** How a text body is shown. `pretty` is what the Body tab displays; `raw` is the text as received. */
export interface TextView {
  kind: ViewKind
  language: ViewLanguage
  raw: string
  pretty: string
  /** The content type says JSON but the text is not valid JSON */
  invalidJson?: JsonErrorInfo
}

interface Viewer {
  kind: ViewKind
  language: ViewLanguage
  /** Declared by the Content-Type */
  matchesType(mediaType: string): boolean
  /** Recognized from the text when the Content-Type is missing or generic */
  looksLike(text: string): boolean
  view(text: string): TextView
}

// Formatting is skipped above this size so the tab stays responsive; the text is shown as received
export const MAX_FORMAT_LENGTH = 8 * 1024 * 1024

const jsonViewer: Viewer = {
  kind: 'json',
  language: 'json',
  matchesType: (type) => type === 'application/json' || type.endsWith('+json') || type === 'text/json',
  looksLike: (text) => /^\s*[[{]/.test(text) && parseJson(text).ok,
  view: (text) => {
    const result = parseJson(text)
    if (!result.ok) return { kind: 'json', language: 'json', raw: text, pretty: text, invalidJson: result.error }
    return { kind: 'json', language: 'json', raw: text, pretty: text.length > MAX_FORMAT_LENGTH ? text : prettyJson(text) }
  },
}

const xmlViewer: Viewer = {
  kind: 'xml',
  language: 'xml',
  matchesType: (type) => type === 'application/xml' || type === 'text/xml' || type.endsWith('+xml'),
  looksLike: (text) => /^\s*<\?xml/.test(text),
  view: (text) => ({ kind: 'xml', language: 'xml', raw: text, pretty: (text.length <= MAX_FORMAT_LENGTH && prettyXml(text)) || text }),
}

const htmlViewer: Viewer = {
  kind: 'html',
  language: null,
  matchesType: (type) => type === 'text/html' || type === 'application/xhtml+xml',
  looksLike: (text) => /^\s*<!doctype html|^\s*<html[\s>]/i.test(text),
  view: (text) => ({ kind: 'html', language: null, raw: text, pretty: text }),
}

const textViewer: Viewer = {
  kind: 'text',
  language: null,
  matchesType: () => true,
  looksLike: () => true,
  view: (text) => ({ kind: 'text', language: null, raw: text, pretty: text }),
}

/** Specific viewers first; plain text accepts anything. A new format is one more viewer in this list. */
const VIEWERS: readonly Viewer[] = [jsonViewer, xmlViewer, htmlViewer, textViewer]

// Types that say nothing about the content, so the text decides
const GENERIC_TYPES = new Set(['text/plain', 'application/octet-stream', 'binary/octet-stream'])

export function viewText(text: string, mediaType: string | null): TextView {
  const declared = mediaType && !GENERIC_TYPES.has(mediaType) ? VIEWERS.find((viewer) => viewer.matchesType(mediaType)) : undefined
  const viewer = declared && declared !== textViewer ? declared : VIEWERS.find((candidate) => candidate.looksLike(text))!
  return viewer.view(text)
}

const BINARY_TYPES = /^(image|audio|video|font)\/|^application\/(pdf|zip|gzip|x-gzip|x-tar|x-7z-compressed|wasm|vnd\.ms-excel|vnd\.openxmlformats|msword|x-protobuf|protobuf)/

/** Whether the body cannot be shown as text: declared as a binary format, or full of control characters. */
export function isBinary(mediaType: string | null, bytes: Uint8Array): boolean {
  if (mediaType === 'image/svg+xml') return false
  if (mediaType && BINARY_TYPES.test(mediaType)) return true
  const sample = bytes.subarray(0, 1024)
  let control = 0
  for (const byte of sample) {
    if (byte === 0) return true
    if (byte < 9 || (byte > 13 && byte < 32)) control++
  }
  return sample.length > 0 && control / sample.length > 0.1
}
