export interface BearerSettings {
  token: string
}

export interface BasicSettings {
  username: string
  password: string
}

export type ApiKeyLocation = 'header' | 'query'

export interface ApiKeySettings {
  name: string
  value: string
  location: ApiKeyLocation
}

/** The settings of each authorization type. Adding a type means adding an entry here and a scheme in the registry. */
export interface AuthSettings {
  none: Record<string, never>
  bearer: BearerSettings
  basic: BasicSettings
  apiKey: ApiKeySettings
}

export type AuthType = keyof AuthSettings

/** The chosen type plus the settings of every type, so switching back and forth does not lose what was typed. */
export interface AuthConfig {
  type: AuthType
  settings: AuthSettings
}

/** What an authorization adds to the request. */
export interface AuthContribution {
  headers: { name: string; value: string }[]
  query: { key: string; value: string }[]
}

export interface AuthScheme<T extends AuthType> {
  type: T
  /** The headers or query parameters to add. Empty when the settings are incomplete. */
  apply(settings: AuthSettings[T]): AuthContribution
  /** False when something required is missing, so the user can be told nothing will be sent. */
  isComplete(settings: AuthSettings[T]): boolean
}
