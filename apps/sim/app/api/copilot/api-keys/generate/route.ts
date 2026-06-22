import { MothershipClientError } from '@sim/mothership-client'
import { validateKeyGenerateContract } from '@sim/mothership-contracts/routes'
import { type NextRequest, NextResponse } from 'next/server'
import { generateCopilotApiKeyContract } from '@/lib/api/contracts'
import { parseRequest } from '@/lib/api/server'
import { getSession } from '@/lib/auth'
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

export const POST = withRouteHandler(async (req: NextRequest) => {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const mothershipBaseURL = await getMothershipBaseURL({ userId })

    const parsed = await parseRequest(generateCopilotApiKeyContract, req, {})
    if (!parsed.success) return parsed.response

    const { name } = parsed.data.body

    const data = await requestMothershipRuntime({
      contract: validateKeyGenerateContract,
      baseUrl: mothershipBaseURL,
      input: { body: { userId, name } },
      spanName: 'sim → go /api/validate-key/generate',
      operation: 'generate_api_key',
      userId,
    })

    return NextResponse.json(
      { success: true, key: { id: data.id || 'new', apiKey: data.apiKey } },
      { status: 201 }
    )
  } catch (error) {
    if (isInvalidMothershipResponse(error)) {
      return NextResponse.json({ error: 'Invalid response from Sim Agent' }, { status: 500 })
    }
    if (error instanceof MothershipClientError) {
      return NextResponse.json(
        { error: 'Failed to generate copilot API key' },
        { status: error.status || 500 }
      )
    }
    return NextResponse.json({ error: 'Failed to generate copilot API key' }, { status: 500 })
  }
})
