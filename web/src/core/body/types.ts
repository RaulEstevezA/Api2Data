import type { KeyValue } from '../http/types.ts'
import type { JsonErrorInfo } from '../json/parse.ts'

export type TextBodyMode = 'json' | 'text' | 'xml'
export type BodyMode = 'none' | TextBodyMode | 'form'

/** The chosen mode plus the content of every mode, so switching does not lose what was typed. */
export interface BodyConfig {
  mode: BodyMode
  text: Record<TextBodyMode, string>
  form: KeyValue[]
}

export type BodyIssue = { code: 'invalidJson'; error: JsonErrorInfo }

export interface BodyKind {
  mode: BodyMode
  /** Content-Type added when the user has not set one */
  contentType: string | null
  /** The text sent, or null when there is no body */
  serialize(config: BodyConfig): string | null
  /** A problem that should stop the request from being sent */
  validate(config: BodyConfig): BodyIssue | null
}
