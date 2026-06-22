export interface JsonResponseOptions {
  requestId?: string
  status?: number
}

export function jsonResponse(body: unknown, options: JsonResponseOptions = {}): Response {
  const headers = new Headers({
    'content-type': 'application/json',
  })
  if (options.requestId) {
    headers.set('x-request-id', options.requestId)
  }

  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers,
  })
}
