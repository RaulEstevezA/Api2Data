import type { ApiKeyLocation, AuthType } from '../core/auth/types.ts'
import type { BodyMode } from '../core/body/types.ts'
import type { SendFailure } from '../core/execute/transport.ts'
import type { HeaderSource } from '../core/http/types.ts'
import type { JsonErrorInfo, JsonExpected } from '../core/json/parse.ts'
import type { RequestIssue } from '../core/request/build.ts'
import type { UrlProblem } from '../core/request/url.ts'
import type { ExampleId } from '../examples/index.ts'

/** Number with the language's thousands separator. */
const en$ = (value: number) => value.toLocaleString('en')
const es$ = (value: number) => value.toLocaleString('es')

/** The character found, readable even when it is invisible (a line break, a tab). */
function describeFound(found: string | undefined): string {
  if (found === undefined) return ''
  const escaped = JSON.stringify(found).slice(1, -1)
  return `“${escaped || found}”`
}

const EXPECTED_EN: Record<JsonExpected, string> = {
  value: 'a value',
  key: 'a property name in double quotes',
  colon: '“:”',
  commaOrBrace: '“,” or “}”',
  commaOrBracket: '“,” or “]”',
}

const EXPECTED_ES: Record<JsonExpected, string> = {
  value: 'un valor',
  key: 'un nombre de propiedad entre comillas dobles',
  colon: '“:”',
  commaOrBrace: '“,” o “}”',
  commaOrBracket: '“,” o “]”',
}

const AUTH_EN: Record<AuthType, string> = { none: 'No Auth', bearer: 'Bearer Token', basic: 'Basic Auth', apiKey: 'API Key' }
const AUTH_ES: Record<AuthType, string> = { none: 'Sin autenticación', bearer: 'Bearer Token', basic: 'Basic Auth', apiKey: 'API Key' }

const en = {
  tagline: 'Send HTTP requests to an API and inspect the response',
  introDescription:
    'Write the address, choose the method, add parameters, headers, authorization or a body if you need them, and send. You see the status, the time, the size and the response formatted (JSON, XML or text) with its headers. Requests go straight from your browser to the API: nothing passes through other servers.',
  privacyShort: 'Processed locally',
  examplesLabel: 'Try an example',
  examples: {
    github: 'GET a repository',
    query: 'Query parameters',
    post: 'POST with JSON',
  } satisfies Record<ExampleId, string>,
  exampleDescriptions: {
    github: 'Public GitHub API: data of the Api2Class repository',
    query: 'JSONPlaceholder: comments filtered with ?postId=1',
    post: 'JSONPlaceholder: creates a post from a JSON body (simulated by the API)',
  } satisfies Record<ExampleId, string>,
  languageLabel: 'Language',
  license: 'MIT License',
  sourceCode: 'Source code',
  allTools: 'All tools',
  api2classNote: 'Got a JSON response? Turn it into typed models with Api2Class.',
  api2classLink: 'Open Api2Class',
  workspaceTabs: 'Workspace',

  // Request bar
  requestBarLabel: 'Request',
  methodLabel: 'Method',
  urlLabel: 'URL',
  urlPlaceholder: 'https://api.example.com/users',
  send: 'Send',
  sending: 'Sending…',
  sendShortcut: 'Send (Ctrl/Cmd+Enter)',
  cancel: 'Cancel',
  urlProblem: (problem: UrlProblem): string => {
    switch (problem) {
      case 'empty':
        return 'Write the address of the API to send the request.'
      case 'invalid':
        return 'This address is not valid. Check that it has no spaces and the domain is complete.'
      case 'unsupportedScheme':
        return 'Only http:// and https:// addresses can be requested.'
    }
  },
  schemeAdded: (url: string) => `No protocol written: it will be sent to ${url}`,
  fixBeforeSending: 'Fix this before sending:',

  // Request sections
  requestTitle: 'Request',
  sectionsLabel: 'Request sections',
  sections: { params: 'Params', headers: 'Headers', auth: 'Authorization', body: 'Body' },
  keyPlaceholder: 'Key',
  valuePlaceholder: 'Value',
  remove: 'Remove',
  enableRow: (key: string) => `Send “${key || 'empty'}”`,
  removeRow: (key: string) => `Remove “${key || 'empty'}”`,
  keyOf: (index: number) => `Key of row ${en$(index)}`,
  valueOf: (index: number) => `Value of row ${en$(index)}`,
  paramsHint: 'They are added to the URL. Uncheck a row to leave it out without deleting it.',
  headersHint: 'Uncheck a row to leave it out without deleting it.',
  automaticHeaders: 'Added automatically',
  headerSource: { user: '', auth: 'from Authorization', body: 'from Body' } satisfies Record<HeaderSource, string>,
  authTypeLabel: 'Type',
  authTypes: AUTH_EN,
  authNone: 'The request is sent without credentials.',
  tokenLabel: 'Token',
  usernameLabel: 'Username',
  passwordLabel: 'Password',
  apiKeyNameLabel: 'Key name',
  apiKeyValueLabel: 'Value',
  apiKeyLocationLabel: 'Add to',
  apiKeyLocations: { header: 'Header', query: 'Query params' } satisfies Record<ApiKeyLocation, string>,
  show: 'Show',
  hide: 'Hide',
  showSecret: (label: string) => `Show ${label.toLowerCase()}`,
  credentialsNote: 'Credentials are only kept in this tab while it is open, and only sent to the API.',
  bodyModeLabel: 'Body type',
  bodyModes: { none: 'None', json: 'JSON', text: 'Text', xml: 'XML', form: 'Form URL Encoded' } satisfies Record<BodyMode, string>,
  bodyNotAllowed: (method: string) => `${method} requests have no body. Choose POST, PUT, PATCH or DELETE to send one.`,
  bodyNone: 'The request is sent without a body.',
  bodyEditorLabel: (mode: string) => `${mode} body`,
  bodyPlaceholder: { json: '{\n  "name": "Raúl Estévez"\n}', text: 'Text to send', xml: '<user>\n  <name>Raúl Estévez</name>\n</user>' },
  formatJson: 'Format',
  jsonValid: 'Valid JSON',
  contentTypeNote: (value: string) => `Sent with Content-Type: ${value}`,
  errorPosition: (line: number, column: number) => `Line ${en$(line)}, column ${en$(column)}`,
  jsonError: (error: JsonErrorInfo) => {
    const after = error.key === undefined ? '' : ` after “${error.key}”`
    const found = describeFound(error.found)
    switch (error.code) {
      case 'empty':
        return 'Write a JSON body.'
      case 'unexpectedEnd':
        return error.expected
          ? `The JSON ends too early: expected ${EXPECTED_EN[error.expected]}${after}.`
          : 'The JSON ends too early: a string is not closed.'
      case 'unexpectedCharacter':
        return `Expected ${EXPECTED_EN[error.expected ?? 'value']}${after}, found ${found}.${
          error.found === "'" ? ' JSON uses double quotes.' : error.found === '/' ? ' JSON does not allow comments.' : ''
        }`
      case 'trailingComma':
        return `Comma before ${found}${after}: remove it.`
      case 'invalidNumber':
        return 'Invalid number: JSON does not allow leading zeros or a dot without decimals.'
      case 'invalidEscape':
        return `Unknown escape sequence \\${error.found ?? ''}.`
      case 'controlCharacter':
        return 'Line break or tab inside a string: write it as \\n or \\t.'
      case 'trailingContent':
        return 'There is more text after the end of the JSON.'
      case 'tooDeep':
        return 'The JSON is nested too deep (more than 512 levels).'
    }
  },
  issue: (issue: RequestIssue): string => {
    switch (issue.code) {
      case 'url':
        return en.urlProblem(issue.problem)
      case 'schemeAdded':
        return en.schemeAdded(issue.url)
      case 'body':
        return `Body: ${en.errorPosition(issue.issue.error.line, issue.issue.error.column)} · ${en.jsonError(issue.issue.error)}`
      case 'headerName':
        return `“${issue.name}” is not a valid header name: use letters, numbers and - without spaces.`
      case 'headerValue':
        return `The value of “${issue.name}” has characters a header cannot carry (line breaks or symbols such as €).`
      case 'forbiddenHeader':
        return `“${issue.name}” is set by the browser itself: the value written here will not be sent.`
      case 'authIncomplete':
        return `${AUTH_EN[issue.type]} is selected but incomplete: no credentials will be sent.`
      case 'authOverridden':
        return `There is already a “${issue.name}” header in Headers: it is sent instead of the one from Authorization.`
    }
  },

  // Response
  responseTitle: 'Response',
  responseEmpty: 'Send a request to see the response here.',
  responseSending: (method: string, url: string) => `Waiting for the response to ${method} ${url}…`,
  responseCancelled: 'Request cancelled. Nothing was received.',
  responseTabs: { body: 'Body', headers: 'Headers', raw: 'Raw' },
  responseTabsLabel: 'Response sections',
  statusLabel: 'Status',
  timeLabel: 'Time',
  sizeLabel: 'Size',
  sizeHint: 'Size of the body received by the browser, after decompression',
  typeLabel: 'Type',
  noContentType: 'no Content-Type',
  redirectedTo: 'Redirected to',
  bodyEmpty: 'The response has no body.',
  bodyBinary: (type: string) => `The body is binary content (${type}) and cannot be shown as text. Download it to open it.`,
  binaryUnknown: 'unknown type',
  invalidJsonResponse: (position: string, detail: string) =>
    `The response says it is JSON but it is not valid (${position} · ${detail}). It is shown as received.`,
  responseBodyLabel: 'Response body',
  rawLabel: 'Raw response',
  headerName: 'Name',
  headerValue: 'Value',
  exposedHeadersNote:
    'The browser only shows the headers the API exposes to other websites (Access-Control-Expose-Headers), so some may be missing.',
  noHeaders: 'The browser did not expose any header of this response.',
  copy: 'Copy',
  copied: 'Copied',
  download: 'Download',
  failure: (failure: SendFailure, host: string): { title: string; text: string; causes?: string[]; tip?: string } => {
    switch (failure.kind) {
      case 'aborted':
        return { title: 'Request cancelled', text: 'Nothing was received.' }
      case 'offline':
        return { title: 'No internet connection', text: 'Your device is offline. Connect and send the request again.' }
      case 'mixedContent':
        return {
          title: 'The browser blocks http addresses here',
          text: 'Api2Data is served over https, and browsers do not let an https page request an http address. Use the https address of the API if it has one.',
        }
      case 'interrupted':
        return {
          title: 'The response was interrupted',
          text: 'The connection was cut while the response was being received. Send the request again.',
        }
      case 'blocked':
        return {
          title: 'No response could be read',
          text: `The browser did not let Api2Data read a response from “${host}”. The most common cause is CORS: Api2Data runs in your browser, so the API has to allow requests from other websites (Access-Control-Allow-Origin header). It does not necessarily mean that the API or the endpoint is down.`,
          causes: [
            'The API does not allow requests from other websites (CORS), or not with this method or these headers.',
            'The address does not exist or the server cannot be reached.',
            'An extension, a firewall or the network blocks the request.',
          ],
          tip: 'To tell them apart, try the same request outside the browser (for example with curl). The browser console (F12) shows the exact reason.',
        }
    }
  },
}

export type Messages = typeof en

const es: Messages = {
  tagline: 'Envía peticiones HTTP a una API y revisa la respuesta',
  introDescription:
    'Escribe la dirección, elige el método, añade parámetros, cabeceras, autorización o un body si los necesitas, y envía. Verás el estado, el tiempo, el tamaño y la respuesta formateada (JSON, XML o texto) con sus cabeceras. Las peticiones van directamente de tu navegador a la API: no pasan por otros servidores.',
  privacyShort: 'Procesado en local',
  examplesLabel: 'Prueba un ejemplo',
  examples: {
    github: 'GET de un repositorio',
    query: 'Parámetros de consulta',
    post: 'POST con JSON',
  },
  exampleDescriptions: {
    github: 'API pública de GitHub: datos del repositorio de Api2Class',
    query: 'JSONPlaceholder: comentarios filtrados con ?postId=1',
    post: 'JSONPlaceholder: crea una publicación a partir de un body JSON (la API lo simula)',
  },
  languageLabel: 'Idioma',
  license: 'Licencia MIT',
  sourceCode: 'Código fuente',
  allTools: 'Todas las herramientas',
  api2classNote: '¿Tienes una respuesta JSON? Conviértela en modelos tipados con Api2Class.',
  api2classLink: 'Abrir Api2Class',
  workspaceTabs: 'Área de trabajo',

  requestBarLabel: 'Petición',
  methodLabel: 'Método',
  urlLabel: 'URL',
  urlPlaceholder: 'https://api.example.com/users',
  send: 'Enviar',
  sending: 'Enviando…',
  sendShortcut: 'Enviar (Ctrl/Cmd+Enter)',
  cancel: 'Cancelar',
  urlProblem: (problem) => {
    switch (problem) {
      case 'empty':
        return 'Escribe la dirección de la API para enviar la petición.'
      case 'invalid':
        return 'Esta dirección no es válida. Comprueba que no tiene espacios y que el dominio está completo.'
      case 'unsupportedScheme':
        return 'Solo se pueden pedir direcciones http:// y https://.'
    }
  },
  schemeAdded: (url) => `Sin protocolo escrito: se enviará a ${url}`,
  fixBeforeSending: 'Corrige esto antes de enviar:',

  requestTitle: 'Petición',
  sectionsLabel: 'Secciones de la petición',
  sections: { params: 'Params', headers: 'Headers', auth: 'Autorización', body: 'Body' },
  keyPlaceholder: 'Clave',
  valuePlaceholder: 'Valor',
  remove: 'Quitar',
  enableRow: (key) => `Enviar “${key || 'vacío'}”`,
  removeRow: (key) => `Quitar “${key || 'vacío'}”`,
  keyOf: (index) => `Clave de la fila ${es$(index)}`,
  valueOf: (index) => `Valor de la fila ${es$(index)}`,
  paramsHint: 'Se añaden a la URL. Desmarca una fila para no enviarla sin borrarla.',
  headersHint: 'Desmarca una fila para no enviarla sin borrarla.',
  automaticHeaders: 'Añadidas automáticamente',
  headerSource: { user: '', auth: 'de Autorización', body: 'del Body' },
  authTypeLabel: 'Tipo',
  authTypes: AUTH_ES,
  authNone: 'La petición se envía sin credenciales.',
  tokenLabel: 'Token',
  usernameLabel: 'Usuario',
  passwordLabel: 'Contraseña',
  apiKeyNameLabel: 'Nombre de la clave',
  apiKeyValueLabel: 'Valor',
  apiKeyLocationLabel: 'Añadir en',
  apiKeyLocations: { header: 'Header', query: 'Query params' },
  show: 'Mostrar',
  hide: 'Ocultar',
  showSecret: (label) => `Mostrar ${label.toLowerCase()}`,
  credentialsNote: 'Las credenciales solo se guardan en esta pestaña mientras está abierta, y solo se envían a la API.',
  bodyModeLabel: 'Tipo de body',
  bodyModes: { none: 'Ninguno', json: 'JSON', text: 'Texto', xml: 'XML', form: 'Form URL Encoded' },
  bodyNotAllowed: (method) => `Las peticiones ${method} no llevan body. Elige POST, PUT, PATCH o DELETE para enviar uno.`,
  bodyNone: 'La petición se envía sin body.',
  bodyEditorLabel: (mode) => `Body ${mode}`,
  bodyPlaceholder: {
    json: '{\n  "name": "Raúl Estévez"\n}',
    text: 'Texto que se enviará',
    xml: '<user>\n  <name>Raúl Estévez</name>\n</user>',
  },
  formatJson: 'Formatear',
  jsonValid: 'JSON válido',
  contentTypeNote: (value) => `Se envía con Content-Type: ${value}`,
  errorPosition: (line, column) => `Línea ${es$(line)}, columna ${es$(column)}`,
  jsonError: (error) => {
    const after = error.key === undefined ? '' : ` después de “${error.key}”`
    const found = describeFound(error.found)
    switch (error.code) {
      case 'empty':
        return 'Escribe un body JSON.'
      case 'unexpectedEnd':
        return error.expected
          ? `El JSON termina antes de tiempo: se esperaba ${EXPECTED_ES[error.expected]}${after}.`
          : 'El JSON termina antes de tiempo: falta cerrar las comillas de un texto.'
      case 'unexpectedCharacter':
        return `Se esperaba ${EXPECTED_ES[error.expected ?? 'value']}${after}, pero hay ${found}.${
          error.found === "'" ? ' JSON usa comillas dobles.' : error.found === '/' ? ' JSON no admite comentarios.' : ''
        }`
      case 'trailingComma':
        return `Coma antes de ${found}${after}: quítala.`
      case 'invalidNumber':
        return 'Número no válido: JSON no admite ceros a la izquierda ni un punto sin decimales.'
      case 'invalidEscape':
        return `Secuencia de escape desconocida: \\${error.found ?? ''}.`
      case 'controlCharacter':
        return 'Salto de línea o tabulador dentro de un texto: escríbelo como \\n o \\t.'
      case 'trailingContent':
        return 'Hay más texto después del final del JSON.'
      case 'tooDeep':
        return 'El JSON tiene demasiados niveles (más de 512).'
    }
  },
  issue: (issue) => {
    switch (issue.code) {
      case 'url':
        return es.urlProblem(issue.problem)
      case 'schemeAdded':
        return es.schemeAdded(issue.url)
      case 'body':
        return `Body: ${es.errorPosition(issue.issue.error.line, issue.issue.error.column)} · ${es.jsonError(issue.issue.error)}`
      case 'headerName':
        return `“${issue.name}” no es un nombre de cabecera válido: usa letras, números y - sin espacios.`
      case 'headerValue':
        return `El valor de “${issue.name}” tiene caracteres que una cabecera no admite (saltos de línea o símbolos como €).`
      case 'forbiddenHeader':
        return `“${issue.name}” la pone el propio navegador: el valor escrito aquí no se enviará.`
      case 'authIncomplete':
        return `${AUTH_ES[issue.type]} está elegido pero incompleto: no se enviarán credenciales.`
      case 'authOverridden':
        return `Ya hay una cabecera “${issue.name}” en Headers: se envía esa en lugar de la de Autorización.`
    }
  },

  responseTitle: 'Respuesta',
  responseEmpty: 'Envía una petición para ver aquí la respuesta.',
  responseSending: (method, url) => `Esperando la respuesta a ${method} ${url}…`,
  responseCancelled: 'Petición cancelada. No se ha recibido nada.',
  responseTabs: { body: 'Body', headers: 'Headers', raw: 'Raw' },
  responseTabsLabel: 'Secciones de la respuesta',
  statusLabel: 'Estado',
  timeLabel: 'Tiempo',
  sizeLabel: 'Tamaño',
  sizeHint: 'Tamaño del body recibido por el navegador, ya descomprimido',
  typeLabel: 'Tipo',
  noContentType: 'sin Content-Type',
  redirectedTo: 'Redirigida a',
  bodyEmpty: 'La respuesta no tiene body.',
  bodyBinary: (type) => `El body es contenido binario (${type}) y no se puede mostrar como texto. Descárgalo para abrirlo.`,
  binaryUnknown: 'tipo desconocido',
  invalidJsonResponse: (position, detail) =>
    `La respuesta dice ser JSON pero no es válida (${position} · ${detail}). Se muestra tal como llegó.`,
  responseBodyLabel: 'Body de la respuesta',
  rawLabel: 'Respuesta sin formato',
  headerName: 'Nombre',
  headerValue: 'Valor',
  exposedHeadersNote:
    'El navegador solo muestra las cabeceras que la API expone a otras webs (Access-Control-Expose-Headers), así que puede faltar alguna.',
  noHeaders: 'El navegador no ha expuesto ninguna cabecera de esta respuesta.',
  copy: 'Copiar',
  copied: 'Copiado',
  download: 'Descargar',
  failure: (failure, host) => {
    switch (failure.kind) {
      case 'aborted':
        return { title: 'Petición cancelada', text: 'No se ha recibido nada.' }
      case 'offline':
        return { title: 'Sin conexión a internet', text: 'Tu dispositivo no tiene conexión. Conéctate y vuelve a enviar la petición.' }
      case 'mixedContent':
        return {
          title: 'El navegador bloquea aquí las direcciones http',
          text: 'Api2Data se sirve por https, y los navegadores no dejan que una página https pida una dirección http. Usa la dirección https de la API si la tiene.',
        }
      case 'interrupted':
        return {
          title: 'La respuesta se ha interrumpido',
          text: 'La conexión se ha cortado mientras llegaba la respuesta. Vuelve a enviar la petición.',
        }
      case 'blocked':
        return {
          title: 'No se ha podido leer ninguna respuesta',
          text: `El navegador no ha dejado que Api2Data lea una respuesta de “${host}”. La causa más habitual es CORS: Api2Data se ejecuta en tu navegador, así que la API tiene que permitir peticiones desde otras webs (cabecera Access-Control-Allow-Origin). No significa necesariamente que la API o el endpoint estén caídos.`,
          causes: [
            'La API no permite peticiones desde otras webs (CORS), o no con este método o estas cabeceras.',
            'La dirección no existe o no se puede llegar al servidor.',
            'Una extensión, un cortafuegos o la red bloquean la petición.',
          ],
          tip: 'Para distinguirlas, prueba la misma petición fuera del navegador (por ejemplo con curl). La consola del navegador (F12) muestra el motivo exacto.',
        }
    }
  },
}

export const messages = { en, es }
export type Language = keyof typeof messages
export const languages = Object.keys(messages) as Language[]
