import { useRef } from 'react'
import { MAX_REQUEST_FILE_SIZE } from '../core/import/requestFile.ts'
import { useI18n } from '../i18n/useI18n.ts'

/** Open and Save in the request pane. The file is read in the browser; nothing is uploaded. */
export function RequestFileActions({
  onOpen,
  onOpenError,
  onSave,
}: {
  onOpen: (text: string, name: string) => void
  onOpenError: (name: string, problem: 'tooLarge' | 'error') => void
  onSave: () => void
}) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)

  async function open(file: File) {
    if (file.size > MAX_REQUEST_FILE_SIZE) {
      onOpenError(file.name, 'tooLarge')
      return
    }
    try {
      onOpen(await file.text(), file.name)
    } catch {
      onOpenError(file.name, 'error')
    }
  }

  return (
    <>
      <button type="button" className="button" title={t.openRequestTitle} onClick={() => input.current?.click()}>
        {t.openRequest}
      </button>
      <button type="button" className="button" title={t.saveRequestTitle} onClick={onSave}>
        {t.saveRequest}
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,.txt,.sh,.curl,application/json,text/plain"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Emptied so the same file can be opened again
          event.target.value = ''
          if (file) void open(file)
        }}
      />
    </>
  )
}
