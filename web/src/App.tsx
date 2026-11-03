import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { draftReducer, emptyDraft, newRowId } from './app/draft.ts'
import { useHistory } from './app/useHistory.ts'
import { useSender } from './app/useSender.ts'
import { AppFooter } from './components/AppFooter.tsx'
import { AppHeader } from './components/AppHeader.tsx'
import { HistoryPanel } from './components/HistoryPanel.tsx'
import { IntroPanel } from './components/IntroPanel.tsx'
import { LinksPanel } from './components/LinksPanel.tsx'
import { RequestBar } from './components/RequestBar.tsx'
import { RequestFileActions } from './components/RequestFileActions.tsx'
import { RequestPane } from './components/RequestPane.tsx'
import { ResponsePane } from './components/ResponsePane.tsx'
import type { Status } from './components/StatusMessage.tsx'
import { createFetchTransport } from './core/execute/fetchTransport.ts'
import { createHistoryStore } from './core/history/store.ts'
import { looksLikeCurl, parseCurl } from './core/import/curl.ts'
import { createRequestFile, readRequestFile, requestFileName } from './core/import/requestFile.ts'
import type { RequestDraft } from './core/http/types.ts'
import { prepareRequest } from './core/request/build.ts'
import { EXAMPLES, type ExampleId } from './examples/index.ts'
import { useI18n } from './i18n/useI18n.ts'
import { downloadFile } from './utils/download.ts'
import './App.css'

// Requests go straight from this page to the API; the desktop app will provide its own transport
const transport = createFetchTransport({
  fetch: (input, init) => fetch(input, init),
  now: () => performance.now(),
  pageProtocol: window.location.protocol,
  isOnline: () => navigator.onLine,
})

// localStorage is looked up on every call: reading it can throw when the browser blocks it, and the store
// turns that into "nothing saved"
const browserStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
}

const historyStore = createHistoryStore(browserStorage)

type WorkspaceTab = 'request' | 'response'

export default function App() {
  const { t } = useI18n()
  const [draft, dispatch] = useReducer(draftReducer, undefined, emptyDraft)
  const { state, send, cancel } = useSender(transport)
  const history = useHistory(historyStore)
  // The request as it was when sent, recorded in the history once its result arrives
  const sent = useRef<{ draft: RequestDraft; recorded: boolean } | null>(null)
  const preparation = useMemo(() => prepareRequest(draft), [draft])
  // Errors under the bar only after trying to send: an address being typed is not yet a mistake
  const [attempted, setAttempted] = useState(false)
  const [tab, setTab] = useState<WorkspaceTab>('request')
  // Result of the last import or save, shown under the bar until the next change
  const [status, setStatus] = useState<Status | null>(null)
  const sending = state.status === 'sending'

  const submit = useCallback(() => {
    if (!preparation.request) {
      setAttempted(true)
      return
    }
    setAttempted(false)
    setStatus(null)
    // On narrow screens the answer is what the user wants to see next
    setTab('response')
    sent.current = { draft, recorded: false }
    void send(preparation.request)
  }, [draft, preparation.request, send])

  const { record } = history
  useEffect(() => {
    const current = sent.current
    if (!current || current.recorded || (state.status !== 'done' && state.status !== 'failed')) return
    current.recorded = true
    // A cancelled request is not worth keeping
    if (state.status === 'failed' && state.failure.kind === 'aborted') return
    record(current.draft, state.status === 'done' ? { status: state.response.status } : { failure: state.failure.kind })
  }, [state, record])

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

  /** Replaces the request being edited: an example, a history entry, an opened file or a pasted cURL command. */
  function load(next: RequestDraft, nextStatus: Status | null = null) {
    dispatch({ type: 'load', draft: next })
    setAttempted(false)
    setStatus(nextStatus)
    setTab('request')
  }

  function loadExample(id: ExampleId) {
    const example = EXAMPLES.find((candidate) => candidate.id === id)
    if (example) load(example.draft())
  }

  function changeUrl(url: string) {
    // A pasted cURL command fills the whole request instead of the address
    if (looksLikeCurl(url)) {
      const result = parseCurl(url, newRowId)
      if (result.ok) load(result.draft, { tone: 'success', text: t.curlImported, details: result.notices.map(t.curlNotice) })
      else setStatus({ tone: 'error', text: t.curlProblem(result.problem) })
      return
    }
    setStatus(null)
    dispatch({ type: 'url', url })
  }

  function openFile(text: string, name: string) {
    const result = readRequestFile(text, newRowId)
    if (!result.ok) setStatus({ tone: 'error', text: t.fileProblem(name, result.problem) })
    else load(result.draft, { tone: 'success', text: t.fileOpened(name), details: result.notices.map(t.curlNotice) })
  }

  function saveFile() {
    const name = requestFileName(draft)
    downloadFile(name, createRequestFile(draft, new Date()), 'application/json')
    setStatus({ tone: 'success', text: t.fileSaved(name) })
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
          status={status}
          onMethod={(method) => dispatch({ type: 'method', method })}
          onUrl={changeUrl}
          onSend={submit}
          onCancel={cancel}
        />
        <HistoryPanel
          entries={history.entries}
          enabled={history.enabled}
          keepCredentials={history.keepCredentials}
          notice={history.notice}
          onEnabled={history.setEnabled}
          onKeepCredentials={history.setKeepCredentials}
          onDismissNotice={history.dismissNotice}
          onLoad={(entry) => load(entry.draft)}
          onRemove={history.remove}
          onClear={history.clear}
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
            actions={
              <RequestFileActions
                onOpen={openFile}
                onOpenError={(name, problem) => setStatus({ tone: 'error', text: t.fileProblem(name, problem) })}
                onSave={saveFile}
              />
            }
          />
          <ResponsePane state={state} />
        </div>
        <LinksPanel />
      </main>
      <AppFooter />
    </div>
  )
}
