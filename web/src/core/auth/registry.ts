import { apiKeyAuth, basicAuth, bearerAuth, noAuth } from './schemes.ts'
import type { AuthConfig, AuthContribution, AuthScheme, AuthType } from './types.ts'

/** Every authorization type, in the order they are offered. The compiler checks that each type has its scheme. */
const SCHEMES: { [T in AuthType]: AuthScheme<T> } = {
  none: noAuth,
  bearer: bearerAuth,
  basic: basicAuth,
  apiKey: apiKeyAuth,
}

export const AUTH_TYPES = Object.keys(SCHEMES) as AuthType[]

function schemeOf<T extends AuthType>(type: T): AuthScheme<T> {
  return SCHEMES[type]
}

export function applyAuth(config: AuthConfig): AuthContribution {
  return schemeOf(config.type).apply(config.settings[config.type])
}

export function isAuthComplete(config: AuthConfig): boolean {
  return schemeOf(config.type).isComplete(config.settings[config.type])
}

export function defaultAuth(): AuthConfig {
  return {
    type: 'none',
    settings: {
      none: {},
      bearer: { token: '' },
      basic: { username: '', password: '' },
      apiKey: { name: 'X-API-Key', value: '', location: 'header' },
    },
  }
}
