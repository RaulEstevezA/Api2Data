import type { PreparedRequest } from '../http/types.ts'

export type CodeLanguage = 'shell' | 'javascript' | 'python'

/** Writes the code that sends the same request from somewhere else. */
export interface CodeTarget {
  id: string
  /** Name shown in the selector: "cURL", "JavaScript (fetch)" */
  label: string
  language: CodeLanguage
  generate(request: PreparedRequest): string
}
