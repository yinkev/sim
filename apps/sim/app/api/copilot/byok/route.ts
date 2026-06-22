import { db } from '@sim/db'
import { settings, user } from '@sim/db/schema'
import { getErrorMessage } from '@sim/utils/errors'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import {
  deleteCopilotByokKeyContract,
  listCopilotByokKeysContract,
  upsertCopilotByokKeyContract,
} from '@/lib/api/contracts/copilot'
import { parseRequest } from '@/lib/api/server'
import { getSession } from '@/lib/auth'
import { getRequiredSimAgentApiUrl } from '@/lib/copilot/constants'
import { getMothershipSourceEnvHeaders } from '@/lib/copilot/server/agent-url'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { createMothershipAdminAuthHeaders } from '@/lib/mothership/service-auth'

/**
 * Enterprise BYOK key management for the current workspace's mothership.
 *
 * Unlike the cross-environment admin inspector (`/api/admin/mothership`), this
 * talks to the SAME copilot the workspace's mothership actually runs on:
 * `SIM_AGENT_API_URL`. Until the owned Mothership admin route family exists,
 * this is a pre-strict legacy backend call authenticated with the runtime key.
 * The route is superuser-gated; the workspace id rides in the request and is
 * resolved by the caller from the route.
 */
async function getAuthorizedSuperUserId(): Promise<string | null> {
  const session = await getSession()
  if (!session?.user?.id) return null

  const [currentUser] = await db
    .select({ role: user.role, superUserModeEnabled: settings.superUserModeEnabled })
    .from(user)
    .leftJoin(settings, eq(settings.userId, user.id))
    .where(eq(user.id, session.user.id))
    .limit(1)

  const authorized = currentUser?.role === 'admin' && (currentUser.superUserModeEnabled ?? false)
  return authorized ? session.user.id : null
}

async function forwardToCopilot(
  method: 'GET' | 'POST' | 'DELETE',
  query: URLSearchParams,
  body?: string
) {
  let simAgentApiUrl: string
  let authHeaders: Record<string, string>
  try {
    simAgentApiUrl = getRequiredSimAgentApiUrl()
    authHeaders = createMothershipAdminAuthHeaders(simAgentApiUrl)
  } catch (error) {
    return NextResponse.json(
      {
        error: `Mothership admin authentication not configured: ${getErrorMessage(error, 'Unknown error')}`,
      },
      { status: 500 }
    )
  }

  const headers: Record<string, string> = {
    ...authHeaders,
    ...getMothershipSourceEnvHeaders(),
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    const qs = query.toString()
    const targetUrl = `${simAgentApiUrl}/api/admin/byok${qs ? `?${qs}` : ''}`
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
    })
    const text = await upstream.text()
    const data = text ? JSON.parse(text) : {}
    return NextResponse.json(data, { status: upstream.status })
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to reach copilot: ${getErrorMessage(error, 'Unknown error')}` },
      { status: 502 }
    )
  }
}

export const GET = withRouteHandler(async (req: NextRequest) => {
  const userId = await getAuthorizedSuperUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseRequest(listCopilotByokKeysContract, req, {})
  if (!parsed.success) return parsed.response

  return forwardToCopilot(
    'GET',
    new URLSearchParams({ workspaceId: parsed.data.query.workspaceId })
  )
})

export const POST = withRouteHandler(async (req: NextRequest) => {
  const userId = await getAuthorizedSuperUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseRequest(upsertCopilotByokKeyContract, req, {})
  if (!parsed.success) return parsed.response

  const body = JSON.stringify({ ...parsed.data.body, createdBy: userId })
  return forwardToCopilot('POST', new URLSearchParams(), body)
})

export const DELETE = withRouteHandler(async (req: NextRequest) => {
  const userId = await getAuthorizedSuperUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseRequest(deleteCopilotByokKeyContract, req, {})
  if (!parsed.success) return parsed.response

  return forwardToCopilot(
    'DELETE',
    new URLSearchParams({
      workspaceId: parsed.data.query.workspaceId,
      provider: parsed.data.query.provider,
    })
  )
})
