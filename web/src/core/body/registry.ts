import { formBody, jsonBody, noBody, textBody, xmlBody } from './kinds.ts'
import type { BodyConfig, BodyKind, BodyMode } from './types.ts'

/** Every body mode, in the order they are offered. The compiler checks that each mode has its kind. */
const KINDS: Record<BodyMode, BodyKind> = {
  none: noBody,
  json: jsonBody,
  text: textBody,
  xml: xmlBody,
  form: formBody,
}

export const BODY_MODES = Object.keys(KINDS) as BodyMode[]

export function bodyKind(mode: BodyMode): BodyKind {
  return KINDS[mode]
}

export function defaultBody(): BodyConfig {
  return { mode: 'none', text: { json: '', text: '', xml: '' }, form: [] }
}
