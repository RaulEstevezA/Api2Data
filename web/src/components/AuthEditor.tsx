import type { ReactNode } from 'react'
import { AUTH_TYPES } from '../core/auth/registry.ts'
import type { ApiKeyLocation, AuthConfig, AuthSettings, AuthType } from '../core/auth/types.ts'
import { useI18n } from '../i18n/useI18n.ts'
import type { Messages } from '../i18n/messages.ts'
import { SecretInput } from './SecretInput.tsx'
import './AuthEditor.css'

type FieldsProps<T extends AuthType> = { settings: AuthSettings[T]; onChange: (settings: AuthSettings[T]) => void; t: Messages }

/** The fields of each authorization type: only those of the chosen type are shown. */
const FIELDS: { [T in AuthType]: (props: FieldsProps<T>) => ReactNode } = {
  none: ({ t }) => <p className="auth__note">{t.authNone}</p>,
  bearer: ({ settings, onChange, t }) => (
    <SecretInput label={t.tokenLabel} value={settings.token} onChange={(token) => onChange({ token })} />
  ),
  basic: ({ settings, onChange, t }) => (
    <div className="auth__fields">
      <label className="field">
        <span>{t.usernameLabel}</span>
        <input
          className="input input--mono"
          value={settings.username}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...settings, username: event.target.value })}
        />
      </label>
      <SecretInput label={t.passwordLabel} value={settings.password} onChange={(password) => onChange({ ...settings, password })} />
    </div>
  ),
  apiKey: ({ settings, onChange, t }) => (
    <div className="auth__fields">
      <label className="field">
        <span>{t.apiKeyNameLabel}</span>
        <input
          className="input input--mono"
          value={settings.name}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...settings, name: event.target.value })}
        />
      </label>
      <SecretInput label={t.apiKeyValueLabel} value={settings.value} onChange={(value) => onChange({ ...settings, value })} />
      <label className="field">
        <span>{t.apiKeyLocationLabel}</span>
        <select
          className="select"
          value={settings.location}
          onChange={(event) => onChange({ ...settings, location: event.target.value as ApiKeyLocation })}
        >
          {(['header', 'query'] as const).map((location) => (
            <option key={location} value={location}>
              {t.apiKeyLocations[location]}
            </option>
          ))}
        </select>
      </label>
    </div>
  ),
}

function Fields<T extends AuthType>({
  type,
  config,
  onChange,
  t,
}: {
  type: T
  config: AuthConfig
  onChange: (auth: AuthConfig) => void
  t: Messages
}) {
  const render = FIELDS[type] as (props: FieldsProps<T>) => ReactNode
  return render({
    settings: config.settings[type],
    onChange: (settings) => onChange({ ...config, settings: { ...config.settings, [type]: settings } }),
    t,
  })
}

export function AuthEditor({ auth, onChange }: { auth: AuthConfig; onChange: (auth: AuthConfig) => void }) {
  const { t } = useI18n()
  return (
    <div className="auth">
      <label className="field auth__type">
        <span>{t.authTypeLabel}</span>
        <select className="select" value={auth.type} onChange={(event) => onChange({ ...auth, type: event.target.value as AuthType })}>
          {AUTH_TYPES.map((type) => (
            <option key={type} value={type}>
              {t.authTypes[type]}
            </option>
          ))}
        </select>
      </label>
      <Fields type={auth.type} config={auth} onChange={onChange} t={t} />
      {auth.type !== 'none' && <p className="auth__note">{t.credentialsNote}</p>}
    </div>
  )
}
