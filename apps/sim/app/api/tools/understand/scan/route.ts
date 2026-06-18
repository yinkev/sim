import { createLogger } from '@sim/logger'
import { getErrorMessage } from '@sim/utils/errors'
import { type NextRequest, NextResponse } from 'next/server'
import { understandScanContract } from '@/lib/api/contracts/tools/understand'
import { parseToolRequest } from '@/lib/api/server'
import { checkInternalAuth } from '@/lib/auth/hybrid'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { scanCodebase } from '@/lib/understand/pipeline'

export const dynamic = 'force-dynamic'

const logger = createLogger('UnderstandScanToolAPI')

export const POST = withRouteHandler(async (request: NextRequest) => {
  const auth = await checkInternalAuth(request, { requireWorkflowId: false })
  if (!auth.success || !auth.userId) {
    return NextResponse.json({ success: false, output: {}, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const parsed = await parseToolRequest(understandScanContract, request, {
      errorFormat: 'toolDetails',
      logger,
    })
    if (!parsed.success) return parsed.response

    return NextResponse.json({ success: true, output: await scanCodebase(parsed.data.body) })
  } catch (error) {
    logger.error('Understand scan failed', { error })
    return NextResponse.json(
      { success: false, output: {}, error: getErrorMessage(error, 'Understand scan failed') },
      { status: 500 }
    )
  }
})
