import { createLogger } from '@sim/logger'
import { MothershipClientError } from '@sim/mothership-client'
import { getAvailableModelsContract } from '@sim/mothership-contracts/routes'
import { toError } from '@sim/utils/errors'
import { type NextRequest, NextResponse } from 'next/server'
import { copilotModelsContract } from '@/lib/api/contracts/copilot'
import { parseRequest } from '@/lib/api/server'
import { authenticateCopilotRequestSessionOnly } from '@/lib/copilot/request/http'
import { getMothershipBaseURL } from '@/lib/copilot/server/agent-url'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { requestMothershipRuntime } from '@/lib/mothership/client'

interface AvailableModel {
  id: string
  friendlyName: string
  provider: string
}

const logger = createLogger('CopilotModelsAPI')

interface RawAvailableModel {
  id: string
  friendlyName?: string
  displayName?: string
  provider?: string
}

function isInvalidMothershipResponse(error: unknown): boolean {
  return (
    (error instanceof MothershipClientError &&
      error.message === 'Mothership response failed contract validation') ||
    error instanceof SyntaxError
  )
}

function isRawAvailableModel(item: unknown): item is RawAvailableModel {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof (item as { id: unknown }).id === 'string'
  )
}

function getMothershipErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: unknown }).error
    if (typeof error === 'string' && error.length > 0) return error
  }
  return fallback
}

export const GET = withRouteHandler(async (req: NextRequest) => {
  const parsed = await parseRequest(copilotModelsContract, req, {})
  if (!parsed.success) return parsed.response

  const { userId, isAuthenticated } = await authenticateCopilotRequestSessionOnly()
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const mothershipBaseURL = await getMothershipBaseURL({ userId })
    const payload = await requestMothershipRuntime({
      contract: getAvailableModelsContract,
      baseUrl: mothershipBaseURL,
      spanName: 'sim → go /api/get-available-models',
      operation: 'get_available_models',
    })

    const rawModels = Array.isArray(payload?.models) ? payload.models : []
    const models: AvailableModel[] = rawModels
      .filter((item: unknown): item is RawAvailableModel => isRawAvailableModel(item))
      .map((item: RawAvailableModel) => ({
        id: item.id,
        friendlyName: item.friendlyName || item.displayName || item.id,
        provider: item.provider || 'unknown',
      }))

    return NextResponse.json({ success: true, models })
  } catch (error) {
    if (isInvalidMothershipResponse(error)) {
      logger.warn('Invalid models response from copilot backend')
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid response from Sim Agent',
          models: [],
        },
        { status: 500 }
      )
    }

    if (error instanceof MothershipClientError) {
      logger.warn('Failed to fetch available models from copilot backend', {
        status: error.status,
      })
      const body = error.body && typeof error.body === 'object' ? error.body : {}
      return NextResponse.json(
        {
          success: false,
          error: getMothershipErrorMessage(body, 'Failed to fetch available models'),
          models: [],
        },
        { status: error.status || 500 }
      )
    }

    logger.error('Error fetching available models', {
      error: toError(error).message,
    })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch available models',
        models: [],
      },
      { status: 500 }
    )
  }
})
