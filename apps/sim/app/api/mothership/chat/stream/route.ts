import type { NextRequest } from 'next/server'
import { mothershipChatStreamQuerySchema } from '@/lib/api/contracts/mothership-chats'
import { validationErrorResponse } from '@/lib/api/server'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { GET as copilotStreamGet, maxDuration } from '@/app/api/copilot/chat/stream/route'

export { maxDuration }

export const GET = withRouteHandler((request: NextRequest) => {
  const validation = mothershipChatStreamQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  )
  if (!validation.success) return validationErrorResponse(validation.error)

  return copilotStreamGet(request, undefined)
})
