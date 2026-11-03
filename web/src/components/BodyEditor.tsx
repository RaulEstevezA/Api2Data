import { bodyKind, BODY_MODES } from '../core/body/registry.ts'
import type { BodyConfig, TextBodyMode } from '../core/body/types.ts'
import type { KeyValue } from '../core/http/types.ts'
import { prettyJson } from '../core/json/pretty.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { CodeEditor } from './CodeEditor.tsx'
import { KeyValueEditor } from './KeyValueEditor.tsx'
import './BodyEditor.css'

const isTextMode = (mode: BodyConfig['mode']): mode is TextBodyMode => mode === 'json' || mode === 'text' || mode === 'xml'

export function BodyEditor({ body, onChange }: { body: BodyConfig; onChange: (body: BodyConfig) => void }) {
  const { t } = useI18n()
  const kind = bodyKind(body.mode)
  const issue = kind.validate(body)
  const setText = (mode: TextBodyMode, text: string) => onChange({ ...body, text: { ...body.text, [mode]: text } })

  return (
    <div className="body-editor">
      <div className="body-editor__modes" role="group" aria-label={t.bodyModeLabel}>
        {BODY_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className="button button--small"
            aria-pressed={mode === body.mode}
            onClick={() => onChange({ ...body, mode })}
          >
            {t.bodyModes[mode]}
          </button>
        ))}
      </div>

      {body.mode === 'none' && <p className="body-editor__note">{t.bodyNone}</p>}

      {isTextMode(body.mode) && (
        <div className="body-editor__code">
          <CodeEditor
            value={body.text[body.mode]}
            onChange={(text) => setText(body.mode as TextBodyMode, text)}
            language={body.mode === 'text' ? null : body.mode}
            label={t.bodyEditorLabel(t.bodyModes[body.mode])}
            placeholder={t.bodyPlaceholder[body.mode]}
            errorLine={issue?.error.line ?? null}
          />
        </div>
      )}

      {body.mode === 'form' && (
        <div className="body-editor__form">
          <KeyValueEditor rows={body.form} label={t.bodyModes.form} onChange={(form: KeyValue[]) => onChange({ ...body, form })} />
        </div>
      )}

      {body.mode !== 'none' && (
        <div className="body-editor__status">
          {issue ? (
            <p className="body-editor__error" role="alert">
              <strong>{t.errorPosition(issue.error.line, issue.error.column)}</strong> · {t.jsonError(issue.error)}
            </p>
          ) : body.mode === 'json' && body.text.json.trim() ? (
            <p className="body-editor__valid">{t.jsonValid}</p>
          ) : (
            <p className="body-editor__note">{kind.contentType && t.contentTypeNote(kind.contentType)}</p>
          )}
          {body.mode === 'json' && (
            <button
              type="button"
              className="button button--small"
              disabled={!!issue || !body.text.json.trim()}
              onClick={() => setText('json', prettyJson(body.text.json))}
            >
              {t.formatJson}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
