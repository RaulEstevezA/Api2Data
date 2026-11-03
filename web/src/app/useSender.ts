import { useCallback, useEffect, useRef, useState } from 'react'
import type { HttpTransport, SendFailure } from '../core/execute/transport.ts'
import type { PreparedRequest } from '../core/http/types.ts'
import { processResponse, type ProcessedResponse } from '../core/response/process.ts'

export type SendState =
  | { status: 'idle' }
  | { status: 'sending'; request: PreparedRequest }
  | { status: 'done'; request: PreparedRequest; response: ProcessedResponse }
  | { status: 'failed'; request: PreparedRequest; failure: SendFailure }

/** Sends one request at a time through the given transport. Sending again cancels the request in flight. */
export function useSender(transport: HttpTransport) {
  const [state, setState] = useState<SendState>({ status: 'idle' })
  const controller = useRef<AbortController | null>(null)

  const cancel = useCallback(() => controller.current?.abort(), [])

  const send = useCallback(
    async (request: PreparedRequest) => {
      controller.current?.abort()
      const current = new AbortController()
      controller.current = current
      setState({ status: 'sending', request })
      const result = await transport.send(request, current.signal)
      // A newer request replaced this one: its result is no longer wanted
      if (controller.current !== current) return
      controller.current = null
      setState(
        result.ok
          ? { status: 'done', request, response: processResponse(result.response) }
          : { status: 'failed', request, failure: result.failure },
      )
    },
    [transport],
  )

  useEffect(() => () => controller.current?.abort(), [])

  return { state, send, cancel }
}
