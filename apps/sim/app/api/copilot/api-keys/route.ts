import { MothershipClientError } from '@sim/mothership-client'
import {
  validateKeyDeleteContract,
  validateKeyListContract,
} from '@sim/mothership-contracts/routes'
import { type NextRequest, NextResponse } from 'next/server'
import { deleteCopilotApiKeyQuerySchema } from '@/lib/api/contracts'
import { getSession } from '@/lib/auth'
import { TraceAttr } from '@/lib/copilot/generated/trace-attributes-v1'
import { getMothershipBaseURL } from '@/lib/copilot/server/agent-url'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { requestMothershipRuntime } from '@/lib/mothership/client'

function isInvalidMothershipResponse(error: unknown): boolean {
  return (
    (error instanceof MothershipClientError &&
      error.message === 'Mothership response failed contract validation') ||
    error instanceof SyntaxError ||
    (error instanceof Error && error.message === 'Invalid JSON')
  )
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const mothershipBaseURL = await getMothershipBaseURL({ userId })

    const apiKeys = await requestMothershipRuntime({
      contract: validateKeyListContract,
      baseUrl: mothershipBaseURL,
      input: { body: { userId } },
      spanName: 'sim → go /api/validate-key/get-api-keys',
      operation: 'get_api_keys',
      userId,
    })

    const keys = apiKeys.map((k) => {
      const value = typeof k.apiKey === 'string' ? k.apiKey : ''
      const last6 = value.slice(-6)
      const displayKey = typeof k.displayKey === 'string' ? k.displayKey : `•••••${last6}`
      return {
        id: k.id,
        displayKey,
        name: k.name || null,
        createdAt: k.createdAt || null,
        lastUsed: k.lastUsed || null,
      }
    })

    return NextResponse.json({ keys }, { status: 200 })
  } catch (error) {
    if (isInvalidMothershipResponse(error)) {
      return NextResponse.json({ error: 'Invalid response from Sim Agent' }, { status: 500 })
    }
    if (error instanceof MothershipClientError) {
      return NextResponse.json({ error: 'Failed to get keys' }, { status: error.status || 500 })
    }
    return NextResponse.json({ error: 'Failed to get keys' }, { status: 500 })
  }
})

export const DELETE = withRouteHandler(async (request: NextRequest) => {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const mothershipBaseURL = await getMothershipBaseURL({ userId })
    const queryResult = deleteCopilotApiKeyQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams)
    )
    if (!queryResult.success) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const { id } = queryResult.data

    await requestMothershipRuntime({
      contract: validateKeyDeleteContract,
      baseUrl: mothershipBaseURL,
      input: { body: { userId, apiKeyId: id } },
      spanName: 'sim → go /api/validate-key/delete',
      operation: 'delete_api_key',
      userId,
      attributes: { [TraceAttr.ApiKeyId]: id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    if (isInvalidMothershipResponse(error)) {
      return NextResponse.json({ error: 'Invalid response from Sim Agent' }, { status: 500 })
    }
    if (error instanceof MothershipClientError) {
      return NextResponse.json({ error: 'Failed to delete key' }, { status: error.status || 500 })
    }
    return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 })
  }
})
