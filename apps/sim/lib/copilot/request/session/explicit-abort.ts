import type { Context } from '@opentelemetry/api'
import { MothershipClientError } from '@sim/mothership-client'
import { explicitAbortContract } from '@sim/mothership-contracts/routes'
import { TraceAttr } from '@/lib/copilot/generated/trace-attributes-v1'
import { AbortReason } from '@/lib/copilot/request/session/abort'
import { getMothershipBaseURL } from '@/lib/copilot/server/agent-url'
import { requestMothershipRuntime } from '@/lib/mothership/client'

export const DEFAULT_EXPLICIT_ABORT_TIMEOUT_MS = 3000

export async function requestExplicitStreamAbort(params: {
  streamId: string
  userId: string
  chatId?: string
  workspaceId?: string
  timeoutMs?: number
  otelContext?: Context
}): Promise<void> {
  const {
    streamId,
    userId,
    chatId,
    workspaceId,
    timeoutMs = DEFAULT_EXPLICIT_ABORT_TIMEOUT_MS,
    otelContext,
  } = params

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(AbortReason.ExplicitAbortFetchTimeout),
    timeoutMs
  )

  try {
    const mothershipBaseURL = await getMothershipBaseURL({ userId })
    await requestMothershipRuntime({
      contract: explicitAbortContract,
      baseUrl: mothershipBaseURL,
      input: {
        signal: controller.signal,
        body: {
          messageId: streamId,
          userId,
          ...(chatId ? { chatId } : {}),
          ...(workspaceId ? { workspaceId } : {}),
        },
      },
      otelContext,
      spanName: 'sim → go /api/streams/explicit-abort',
      operation: 'explicit_abort',
      attributes: {
        [TraceAttr.StreamId]: streamId,
        ...(chatId ? { [TraceAttr.ChatId]: chatId } : {}),
      },
    })
  } catch (error) {
    if (error instanceof MothershipClientError && error.status > 0) {
      throw new Error(`Explicit abort marker request failed: ${error.status}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
