import { once } from 'node:events'
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import { createLogger } from '@sim/logger'
import { getErrorMessage } from '@sim/utils/errors'
import { generateId } from '@sim/utils/id'
import type { MothershipEnv } from '@/env'
import { createMothershipHandler, type MothershipAppState } from '@/http'
import { jsonResponse } from '@/response'

const logger = createLogger('MothershipServer')
export const MAX_REQUEST_BODY_BYTES = 1024 * 1024

class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body too large')
    this.name = 'RequestBodyTooLargeError'
  }
}

type NodeRequestInit = RequestInit & {
  duplex?: 'half'
}

export interface MothershipApp {
  handler: (request: Request) => Promise<Response>
  state: MothershipAppState
  startShutdown: () => void
}

export function createMothershipApp(env: MothershipEnv): MothershipApp {
  const state: MothershipAppState = { shuttingDown: false }
  return {
    state,
    handler: createMothershipHandler(env, state),
    startShutdown: () => {
      state.shuttingDown = true
    },
  }
}

function createCappedBodyStream(request: IncomingMessage): ReadableStream<Uint8Array> | undefined {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined
  }

  const contentLength = request.headers['content-length']
  if (
    typeof contentLength === 'string' &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > MAX_REQUEST_BODY_BYTES
  ) {
    throw new RequestBodyTooLargeError()
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let totalBytes = 0
      let closed = false

      const cleanup = () => {
        request.off('data', onData)
        request.off('end', onEnd)
        request.off('error', onError)
      }

      const fail = (error: Error) => {
        if (closed) return
        closed = true
        cleanup()
        controller.error(error)
        request.resume()
      }

      const onData = (chunk: Buffer | string) => {
        if (closed) return
        const bodyChunk = toBodyChunk(chunk)
        totalBytes += bodyChunk.byteLength
        if (totalBytes > MAX_REQUEST_BODY_BYTES) {
          fail(new RequestBodyTooLargeError())
          return
        }
        controller.enqueue(bodyChunk)
      }

      const onEnd = () => {
        if (closed) return
        closed = true
        cleanup()
        controller.close()
      }

      const onError = (error: Error) => {
        fail(error)
      }

      request.on('data', onData)
      request.on('end', onEnd)
      request.on('error', onError)
    },
    cancel() {
      request.destroy()
    },
  })
}

function toBodyChunk(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) return chunk
  if (typeof chunk === 'string') return Buffer.from(chunk)
  throw new Error('Unsupported request body chunk')
}

function toHeaders(input: IncomingHttpHeaders): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item)
      }
    } else if (value !== undefined) {
      headers.set(key, value)
    }
  }
  return headers
}

function getIncomingHeader(input: IncomingHttpHeaders, headerName: string): string | undefined {
  const value = input[headerName]
  if (Array.isArray(value)) return value[0]
  return value
}

function getIncomingRequestId(request: IncomingMessage): string {
  return (
    getIncomingHeader(request.headers, 'x-request-id') ||
    getIncomingHeader(request.headers, 'x-sim-request-id') ||
    generateId()
  )
}

async function toFetchRequest(request: IncomingMessage, signal: AbortSignal): Promise<Request> {
  const host = request.headers.host ?? 'localhost'
  const url = new URL(request.url ?? '/', `http://${host}`)
  const body = createCappedBodyStream(request)

  const init: NodeRequestInit = {
    method: request.method ?? 'GET',
    headers: toHeaders(request.headers),
    signal,
    ...(body ? { body, duplex: 'half' } : {}),
  }

  return new Request(url, init)
}

async function writeChunk(response: ServerResponse, chunk: Uint8Array): Promise<void> {
  if (response.destroyed) {
    throw new Error('Mothership response socket was closed')
  }

  if (response.write(chunk)) return
  await Promise.race([
    once(response, 'drain'),
    once(response, 'close').then(() => {
      throw new Error('Mothership response socket was closed')
    }),
  ])
}

async function writeResponse(serverResponse: ServerResponse, response: Response): Promise<void> {
  serverResponse.statusCode = response.status
  for (const [key, value] of response.headers.entries()) {
    serverResponse.setHeader(key, value)
  }

  if (!response.body) {
    serverResponse.end()
    return
  }

  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await writeChunk(serverResponse, value)
    }
    serverResponse.end()
  } finally {
    reader.releaseLock()
  }
}

export function createMothershipNodeServer(app: MothershipApp): Server {
  return createServer(async (request, response) => {
    const abortController = new AbortController()
    const abortRequest = () => {
      abortController.abort()
    }
    request.once('aborted', abortRequest)
    response.once('close', abortRequest)

    try {
      const fetchRequest = await toFetchRequest(request, abortController.signal)
      const fetchResponse = await app.handler(fetchRequest)
      await writeResponse(response, fetchResponse)
    } catch (error) {
      if (response.headersSent || response.writableEnded) {
        const requestId = getIncomingRequestId(request)
        logger.withMetadata({ requestId }).error('Mothership response stream failed', {
          error: getErrorMessage(error),
        })
        if (!response.destroyed) {
          response.destroy()
        }
        return
      }

      const requestId = getIncomingRequestId(request)
      const isBodyTooLarge = error instanceof RequestBodyTooLargeError
      if (isBodyTooLarge) {
        logger.withMetadata({ requestId }).warn('Rejected oversized Mothership request body')
        await writeResponse(
          response,
          jsonResponse(
            {
              ok: false,
              error: 'Request body too large',
              requestId,
            },
            { status: 413, requestId }
          )
        )
        return
      }

      logger.withMetadata({ requestId }).error('Unhandled Mothership request error', {
        error: getErrorMessage(error),
      })
      await writeResponse(
        response,
        jsonResponse(
          {
            ok: false,
            error: 'Internal server error',
            requestId,
          },
          { status: 500, requestId }
        )
      )
    } finally {
      request.off('aborted', abortRequest)
      response.off('close', abortRequest)
    }
  })
}
