export interface ContentType {
  /** Lower case, without parameters: "application/json" */
  mediaType: string
  charset: string | null
}

export function parseContentType(value: string | null | undefined): ContentType | null {
  if (!value?.trim()) return null
  const [type, ...parameters] = value.split(';')
  let charset: string | null = null
  for (const parameter of parameters) {
    const [name, ...rest] = parameter.split('=')
    if (name.trim().toLowerCase() === 'charset') charset = rest.join('=').trim().replace(/^"|"$/g, '') || null
  }
  return { mediaType: type.trim().toLowerCase(), charset }
}

export function headerValue(headers: readonly [string, string][], name: string): string | null {
  const lower = name.toLowerCase()
  return headers.find(([key]) => key.toLowerCase() === lower)?.[1] ?? null
}

/** The body as text, in the charset the server declared (UTF-8 when it declares none or an unknown one). */
export function decodeBody(bytes: Uint8Array, charset: string | null): string {
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}
