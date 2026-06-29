import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { importCenterPlaneContract } from '@/lib/api/contracts/center'
import { parseRequest } from '@/lib/api/server'
import { buildPlaneImportPacket } from '@/lib/center/producers/plane'
import { readCenterPlaneSnapshot } from '@/lib/center/producers/plane-files'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

const logger = createLogger('CenterPlaneImportAPI')

function isLocalPlaneImportEnabled(): boolean {
  return process.env.CENTER_DEV === '1' || process.env.NODE_ENV !== 'production'
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const parsed = await parseRequest(importCenterPlaneContract, request, {})
  if (!parsed.success) return parsed.response

  if (!isLocalPlaneImportEnabled()) {
    return NextResponse.json({ error: 'Plane import is local-development only' }, { status: 403 })
  }

  const snapshot = await readCenterPlaneSnapshot()
  const packet = buildPlaneImportPacket(snapshot)
  logger.info('Prepared Plane Center import packet', {
    filePath: snapshot.sourcePath,
    records: snapshot.records.length,
    evidence: packet.evidence.length,
    rawEvents: packet.rawEvents.length,
    observations: packet.observations.length,
    loops: packet.loops.length,
  })

  return NextResponse.json({
    packet,
    source: {
      filePath: snapshot.sourcePath,
      recordCount: snapshot.records.length,
    },
  })
})
