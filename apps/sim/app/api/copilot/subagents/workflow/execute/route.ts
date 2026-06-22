import { createLogger } from '@sim/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { workflowSubagentExecuteContract } from '@/lib/api/contracts/copilot'
import { parseRequest } from '@/lib/api/server'
import { executeWorkflowSubagent } from '@/lib/copilot/subagents/workflow/execute'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { checkSimCallbackAuth } from '@/lib/mothership/service-auth'

const logger = createLogger('CopilotWorkflowSubagentExecute')

export const POST = withRouteHandler(async (req: NextRequest) => {
  const auth = checkSimCallbackAuth(req.headers)
  if (!auth.success) {
    return NextResponse.json(
      {
        success: false,
        code: 'callback_auth_failed',
        error: auth.error,
        retryable: false,
        streamEvents: [],
      },
      { status: auth.status }
    )
  }

  const parsed = await parseRequest(workflowSubagentExecuteContract, req, {})
  if (!parsed.success) return parsed.response

  const result = await executeWorkflowSubagent(parsed.data.body)
  if (!result.success) {
    logger.warn('Workflow subagent callback completed with failure result', {
      code: result.code,
      retryable: result.retryable,
      runId: parsed.data.body.runId,
      streamId: parsed.data.body.streamId,
      workspaceId: parsed.data.body.workspaceId,
    })
  }

  return NextResponse.json(result)
})
