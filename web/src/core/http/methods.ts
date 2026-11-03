export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

// fetch rejects a body on GET and HEAD; DELETE and OPTIONS may carry one, but almost never do
const WITH_BODY: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Whether the method can send a body, so the Body section is only offered where it makes sense. */
export function allowsBody(method: HttpMethod): boolean {
  return WITH_BODY.has(method)
}

export function isHttpMethod(value: unknown): value is HttpMethod {
  return HTTP_METHODS.includes(value as HttpMethod)
}
