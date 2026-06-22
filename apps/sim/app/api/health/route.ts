import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

/**
 * Health check endpoint for deployment platforms and container probes.
 */
export const GET = withRouteHandler(async () => {
  return Response.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
})
