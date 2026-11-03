import { useState } from 'react'
import { useI18n } from '../i18n/useI18n.ts'

/** Password-like field with a Show button: tokens and passwords are hidden on screen by default. */
export function SecretInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  return (
    <label className="field">
      <span>{label}</span>
      <span className="secret">
        <input
          className="input input--mono secret__input"
          type={visible ? 'text' : 'password'}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="button"
          aria-pressed={visible}
          aria-label={t.showSecret(label)}
          onClick={() => setVisible(!visible)}
        >
          {visible ? t.hide : t.show}
        </button>
      </span>
    </label>
  )
}
