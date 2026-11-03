import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { draftReducer, emptyDraft } from './app/draft.ts'
import { useSender } from './app/useSender.ts'
import { AppFooter } from './components/AppFooter.tsx'
import { AppHeader } from './components/AppHeader.tsx'
import { IntroPanel } from './components/IntroPanel.tsx'
import { LinksPanel } from './components/LinksPanel.tsx'
import { RequestBar } from './components/RequestBar.tsx'
import { RequestPane } from './components/RequestPane.tsx'
import { ResponsePane } from './components/ResponsePane.tsx'
import { createFetchTransport } from './core/execute/fetchTransport.ts'
import { prepareRequest } from './core/request/build.ts'
import { EXAMPLES, type ExampleId } from './examples/index.ts'
import { useI18n } from './i18n/useI18n.ts'
import './App.css'

// Requests go straight from this page to the API; the desktop app will provide its own transport
const transport = createFetchTransport({
  fetch: (input, init) => fetch(input, init),
  now: () => performance.now(),
  pageProtocol: window.location.protocol,
  isOnline: () => navigator.onLine,
})

type WorkspaceTab = 'request' | 'response'

export default function App() {
  const { t } = useI18n()
  const [draft, dispatch] = useReducer(draftReducer, undefined, emptyDraft)
  const { state, send, cancel } = useSender(transport)
  const preparation = useMemo(() => prepareRequest(draft), [draft])
  // Errors under the bar only after trying to send: an address being typed is not yet a mistake
  const [attempted, setAttempted] = useState(false)
  const [tab, setTab] = useState<WorkspaceTab>('request')
  const sending = state.status === 'sending'

  const submit = useCallback(() => {
    if (!preparation.request) {
      setAttempted(true)
      return
    }
    setAttempted(false)
    // On narrow screens the answer is what the user wants to see next
    setTab('response')
    void send(preparation.request)
  }, [preparation.request, send])

  // Ctrl/Cmd+Enter sends from anywhere, also from the body editor
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !sending) {
        event.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [submit, sending])

  function loadExample(id: ExampleId) {
    const example = EXAMPLES.find((candidate) => candidate.id === id)
    if (!example) return
    dispatch({ type: 'load', draft: example.draft() })
    setAttempted(false)
    setTab('request')
  }

  const barIssues = preparation.issues.filter((issue) => (attempted && issue.level === 'error') || issue.code === 'schemeAdded')
  const workspaceTabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'request', label: t.requestTitle },
    { id: 'response', label: t.responseTitle },
  ]

  return (
    <div className="app">
      <AppHeader />
      <main className="app__main">
        <IntroPanel onExample={loadExample} />
        <RequestBar
          method={draft.method}
          url={draft.url}
          sending={sending}
          issues={barIssues}
          onMethod={(method) => dispatch({ type: 'method', method })}
          onUrl={(url) => dispatch({ type: 'url', url })}
          onSend={submit}
          onCancel={cancel}
        />
        <div className="workspace__tabs" role="tablist" aria-label={t.workspaceTabs}>
          {workspaceTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="workspace__tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="workspace" data-tab={tab}>
          <RequestPane
            draft={draft}
            preparation={preparation}
            onParams={(params) => dispatch({ type: 'params', params })}
            onHeaders={(headers) => dispatch({ type: 'headers', headers })}
            onAuth={(auth) => dispatch({ type: 'auth', auth })}
            onBody={(body) => dispatch({ type: 'body', body })}
          />
          <ResponsePane state={state} />
        </div>
        <LinksPanel />
      </main>
      <AppFooter />
    </div>
  )
}
