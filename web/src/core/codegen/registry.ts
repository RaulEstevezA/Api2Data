import { curlTarget } from './curl.ts'
import { fetchTarget } from './javascript.ts'
import { requestsTarget } from './python.ts'
import type { CodeTarget } from './types.ts'

/** Every code target, in the order they are offered. A new one is a file and a line here. */
export const CODE_TARGETS: readonly CodeTarget[] = [curlTarget, fetchTarget, requestsTarget]

export function findCodeTarget(id: string): CodeTarget {
  return CODE_TARGETS.find((target) => target.id === id) ?? CODE_TARGETS[0]
}
