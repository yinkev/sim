import { createLogger } from '@sim/logger'
import { getErrorMessage } from '@sim/utils/errors'
import { type NextRequest, NextResponse } from 'next/server'
import { understandExtractContract } from '@/lib/api/contracts/tools/understand'
import { parseToolRequest } from '@/lib/api/server'
import { checkInternalAuth } from '@/lib/auth/hybrid'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { extractCodeSemantics } from '@/lib/understand/pipeline'
import type { ExtractParams } from '@/tools/understand/types'

export const dynamic = 'force-dynamic'

const logger = createLogger('UnderstandExtractToolAPI')

export const POST = withRouteHandler(async (request: NextRequest) => {
  const auth = await checkInternalAuth(request, { requireWorkflowId: false })
  if (!auth.success || !auth.userId) {
    return NextResponse.json({ success: false, output: {}, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const parsed = await parseToolRequest(understandExtractContract, request, {
      errorFormat: 'toolDetails',
      logger,
    })
    if (!parsed.success) return parsed.response

    const params = parsed.data.body as ExtractParams
    return NextResponse.json({ success: true, output: await extractCodeSemantics(params) })
  } catch (error) {
    logger.error('Understand extract failed', { error })
    return NextResponse.json(
      { success: false, output: {}, error: getErrorMessage(error, 'Understand extract failed') },
      { status: 500 }
    )
  }
})
