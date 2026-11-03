import { activeRows } from '../http/keyValue.ts'
import { parseJson } from '../json/parse.ts'
import type { BodyKind } from './types.ts'

export const noBody: BodyKind = {
  mode: 'none',
  contentType: null,
  serialize: () => null,
  validate: () => null,
}

export const jsonBody: BodyKind = {
  mode: 'json',
  contentType: 'application/json',
  // Sent exactly as written: re-serializing could change numbers too large for JavaScript
  serialize: (config) => (config.text.json.trim() ? config.text.json : null),
  validate: (config) => {
    if (!config.text.json.trim()) return null
    const result = parseJson(config.text.json)
    return result.ok ? null : { code: 'invalidJson', error: result.error }
  },
}

export const textBody: BodyKind = {
  mode: 'text',
  contentType: 'text/plain;charset=UTF-8',
  serialize: (config) => (config.text.text === '' ? null : config.text.text),
  validate: () => null,
}

export const xmlBody: BodyKind = {
  mode: 'xml',
  contentType: 'application/xml',
  serialize: (config) => (config.text.xml.trim() ? config.text.xml : null),
  validate: () => null,
}

export const formBody: BodyKind = {
  mode: 'form',
  contentType: 'application/x-www-form-urlencoded',
  serialize: (config) => {
    const rows = activeRows(config.form)
    if (rows.length === 0) return null
    return new URLSearchParams(rows.map((row) => [row.key, row.value])).toString()
  },
  validate: () => null,
}
