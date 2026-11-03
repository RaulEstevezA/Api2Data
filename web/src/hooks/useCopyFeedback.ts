import { useCallback, useEffect, useRef, useState } from 'react'
import { copyText } from '../utils/clipboard.ts'

/** Copies text and says "Copied" for 2 seconds. If the browser refuses, nothing is shown: the text stays selectable. */
export function useCopyFeedback() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(async (text: string) => {
    if (!(await copyText(text))) return
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }, [])

  return { copied, copy }
}
