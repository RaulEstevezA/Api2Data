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

const XML_ENCODING = /^\s*<\?xml[^>]*\bencoding\s*=\s*["']([A-Za-z0-9._:-]+)["']/
const HTML_CHARSET = /<meta[^>]+charset\s*=\s*["']?([A-Za-z0-9._:-]+)/i

/** The charset the content declares when the header does not: a byte order mark, the encoding of an XML prolog
 * (`<?xml version="1.0" encoding="ISO-8859-15"?>`) or an HTML `<meta charset>`. Null when it declares none, so UTF-8
 * is used. Browsers do the same when they load a document, though fetch does not. */
export function sniffCharset(bytes: Uint8Array, mediaType: string | null): string | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  // The declarations are ASCII, so the first bytes can be read one by one whatever the encoding
  const head = String.fromCharCode(...bytes.subarray(0, 1024))
  const xml = XML_ENCODING.exec(head)
  if (xml) return xml[1]
  if (mediaType === null || mediaType === 'text/html' || mediaType === 'application/xhtml+xml') return HTML_CHARSET.exec(head)?.[1] ?? null
  return null
}
