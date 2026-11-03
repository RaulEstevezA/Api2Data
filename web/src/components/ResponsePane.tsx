import { openSearchPanel } from '@codemirror/search'
import type { EditorView } from '@codemirror/view'
import { useState } from 'react'
import type { SendState } from '../app/useSender.ts'
import type { HttpResponse } from '../core/http/types.ts'
import type { ProcessedResponse } from '../core/response/process.ts'
import { useCopyFeedback } from '../hooks/useCopyFeedback.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { downloadFile } from '../utils/download.ts'
import { CodeEditor } from './CodeEditor.tsx'
import { Pane } from './Pane.tsx'
import { RequestFailure } from './RequestFailure.tsx'
import { ResponseHeaders } from './ResponseHeaders.tsx'
import { ResponseSummary } from './ResponseSummary.tsx'
import { SectionTabs } from './SectionTabs.tsx'
import './ResponsePane.css'

type ResponseSection = 'body' | 'headers' | 'raw'

const EXTENSIONS: Record<string, string> = { json: 'json', xml: 'xml', html: 'html', text: 'txt' }

function fileName(response: ProcessedResponse): string {
  return `response.${response.body.kind === 'text' ? EXTENSIONS[response.body.view.kind] : 'bin'}`
}

/** What the Copy button copies in each section. */
function copyable(response: ProcessedResponse, section: ResponseSection): string {
  if (section === 'raw') return response.raw
  if (section === 'headers') return response.headers.map(([name, value]) => `${name}: ${value}`).join('\n')
  return response.body.kind === 'text' ? response.body.view.pretty : ''
}

function ResponseBodyView({ response, onView }: { response: ProcessedResponse; onView: (view: EditorView | null) => void }) {
  const { t } = useI18n()
  const { body } = response
  if (body.kind === 'empty') return <p className="response-pane__message">{t.bodyEmpty}</p>
  if (body.kind === 'binary')
    return <p className="response-pane__message">{t.bodyBinary(response.contentType?.mediaType ?? t.binaryUnknown)}</p>
  const invalid = body.view.invalidJson
  return (
    <div className="response-pane__code">
      {invalid && (
        <p className="alert alert--warning response-pane__alert">
          {t.invalidJsonResponse(t.errorPosition(invalid.line, invalid.column), t.jsonError(invalid))}
        </p>
      )}
      <div className="response-pane__editor">
        <CodeEditor
          value={body.view.pretty}
          language={body.view.language}
          readOnly
          label={t.responseBodyLabel}
          errorLine={invalid?.line ?? null}
          onView={onView}
        />
      </div>
    </div>
  )
}

export function ResponsePane({ state, onPaste }: { state: SendState; onPaste: (response: HttpResponse) => void }) {
  const { t } = useI18n()
  const [section, setSection] = useState<ResponseSection>('body')
  const { copied, copy } = useCopyFeedback()
  const response = state.status === 'done' ? state.response : null
  // The editor shown (body or raw), to open its search panel
  const [editor, setEditor] = useState<EditorView | null>(null)

  const tabs = [
    { id: 'body' as const, label: t.responseTabs.body },
    { id: 'headers' as const, label: t.responseTabs.headers, badge: response ? String(response.headers.length) : undefined },
    { id: 'raw' as const, label: t.responseTabs.raw },
  ]

  return (
    <Pane
      title={t.responseTitle}
      toolbar={
        response && (
          <>
            <ResponseSummary response={response} />
            <SectionTabs label={t.responseTabsLabel} tabs={tabs} selected={section} onSelect={setSection} idPrefix="response" />
          </>
        )
      }
      footer={
        response && (
          <div className="response-pane__actions">
            <span className="mono response-pane__file">{fileName(response)}</span>
            <div className="actions">
              <button
                type="button"
                className="button"
                title={t.searchTitle}
                disabled={!editor || section === 'headers'}
                onClick={() => editor && openSearchPanel(editor)}
              >
                {t.search}
              </button>
              <button
                type="button"
                className="button"
                disabled={!copyable(response, section)}
                onClick={() => copy(copyable(response, section))}
              >
                {copied ? t.copied : t.copy}
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={response.size === 0}
                onClick={() =>
                  downloadFile(fileName(response), response.bytes, response.contentType?.mediaType ?? 'application/octet-stream')
                }
              >
                {t.download}
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="response-pane" aria-live="polite">
        {state.status === 'idle' && <p className="response-pane__message">{t.responseEmpty}</p>}
        {state.status === 'sending' && (
          <p className="response-pane__message">{t.responseSending(state.request.method, state.request.url)}</p>
        )}
        {state.status === 'failed' && <RequestFailure failure={state.failure} request={state.request} onPaste={onPaste} />}
        {response && (
          <div id="response-panel" className="response-pane__section" role="tabpanel" aria-labelledby={`response-tab-${section}`}>
            {section === 'body' && <ResponseBodyView response={response} onView={setEditor} />}
            {section === 'headers' && <ResponseHeaders headers={response.headers} />}
            {section === 'raw' && (
              <div className="response-pane__editor">
                <CodeEditor value={response.raw} language={null} readOnly label={t.rawLabel} onView={setEditor} />
              </div>
            )}
          </div>
        )}
      </div>
    </Pane>
  )
}
