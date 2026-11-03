import { CODE_TARGETS, findCodeTarget } from '../core/codegen/registry.ts'
import type { PreparedRequest } from '../core/http/types.ts'
import { useCopyFeedback } from '../hooks/useCopyFeedback.ts'
import { useStoredState } from '../hooks/useStoredState.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { CodeEditor } from './CodeEditor.tsx'
import './CodeSnippet.css'

/** The same request as code to run elsewhere: cURL, JavaScript or Python. Built from what Send would send. */
export function CodeSnippet({ request, withCredentials }: { request: PreparedRequest | null; withCredentials: boolean }) {
  const { t } = useI18n()
  // Only the choice of language is remembered
  const [targetId, setTargetId] = useStoredState('api2data.codeTarget', () => CODE_TARGETS[0].id)
  const { copied, copy } = useCopyFeedback()
  const target = findCodeTarget(targetId)
  const code = request ? target.generate(request) : ''

  return (
    <div className="code-snippet">
      <div className="code-snippet__bar">
        <label className="field code-snippet__target">
          <span>{t.codeTargetLabel}</span>
          <select className="select" value={target.id} onChange={(event) => setTargetId(event.target.value)}>
            {CODE_TARGETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button" disabled={!code} onClick={() => copy(code)}>
          {copied ? t.copied : t.copy}
        </button>
      </div>
      {request ? (
        <>
          <div className="code-snippet__code">
            <CodeEditor value={code} language={target.language} readOnly label={t.codeLabel(target.label)} />
          </div>
          {withCredentials && <p className="code-snippet__note">{t.codeCredentialsNote}</p>}
        </>
      ) : (
        <p className="code-snippet__note">{t.codeUnavailable}</p>
      )}
    </div>
  )
}
