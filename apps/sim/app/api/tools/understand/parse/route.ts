import { createLogger } from '@sim/logger'
import { getErrorMessage } from '@sim/utils/errors'
import { type NextRequest, NextResponse } from 'next/server'
import { understandParseContract } from '@/lib/api/contracts/tools/understand'
import { parseToolRequest } from '@/lib/api/server'
import { checkInternalAuth } from '@/lib/auth/hybrid'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { parseCodebase } from '@/lib/understand/pipeline'
import type { ParseParams } from '@/tools/understand/types'

export const dynamic = 'force-dynamic'

const logger = createLogger('UnderstandParseToolAPI')

export const POST = withRouteHandler(async (request: NextRequest) => {
  const auth = await checkInternalAuth(request, { requireWorkflowId: false })
  if (!auth.success || !auth.userId) {
    return NextResponse.json({ success: false, output: {}, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const parsed = await parseToolRequest(understandParseContract, request, {
      errorFormat: 'toolDetails',
      logger,
    })
    if (!parsed.success) return parsed.response

    const params = parsed.data.body as ParseParams
    return NextResponse.json({ success: true, output: await parseCodebase(params) })
  } catch (error) {
    logger.error('Understand parse failed', { error })
    return NextResponse.json(
      { success: false, output: {}, error: getErrorMessage(error, 'Understand parse failed') },
      { status: 500 }
    )
  }
})
