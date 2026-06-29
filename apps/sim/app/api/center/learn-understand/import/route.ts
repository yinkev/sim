import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { importCenterLearnUnderstandContract } from '@/lib/api/contracts/center'
import { parseRequest } from '@/lib/api/server'
import {
  getUnknownCenterCapabilityIds,
  readCenterCapabilityRegistry,
} from '@/lib/center/capability-registry'
import { buildLearnUnderstandImportPackets } from '@/lib/center/producers/learn-understand'
import { readCenterLearnUnderstandSnapshot } from '@/lib/center/producers/learn-understand-files'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

const logger = createLogger('CenterLearnUnderstandImportAPI')

function isLocalLearnUnderstandImportEnabled(): boolean {
  return process.env.CENTER_DEV === '1' || process.env.NODE_ENV !== 'production'
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const parsed = await parseRequest(importCenterLearnUnderstandContract, request, {})
  if (!parsed.success) return parsed.response

  if (!isLocalLearnUnderstandImportEnabled()) {
    return NextResponse.json(
      { error: 'Learn/Understand import is local-development only' },
      { status: 403 }
    )
  }

  const snapshot = await readCenterLearnUnderstandSnapshot()
  const packets = buildLearnUnderstandImportPackets(snapshot)
  const capabilities = await readCenterCapabilityRegistry()
  const unknownCapabilityIds = packets.flatMap((packet) =>
    getUnknownCenterCapabilityIds(packet, capabilities)
  )
  if (unknownCapabilityIds.length > 0) {
    return NextResponse.json(
      {
        error: 'Unknown Center capability ids',
        unknownCapabilityIds: [...new Set(unknownCapabilityIds)].sort(),
      },
      { status: 422 }
    )
  }
  logger.info('Prepared Learn/Understand Center import packets', {
    filePath: snapshot.sourcePath,
    records: snapshot.records.length,
    packets: packets.length,
    evidence: packets.reduce((sum, packet) => sum + packet.evidence.length, 0),
    rawEvents: packets.reduce((sum, packet) => sum + packet.rawEvents.length, 0),
    observations: packets.reduce((sum, packet) => sum + packet.observations.length, 0),
    loops: packets.reduce((sum, packet) => sum + packet.loops.length, 0),
  })

  return NextResponse.json({
    packets,
    source: {
      filePath: snapshot.sourcePath,
      recordCount: snapshot.records.length,
    },
    capabilities,
  })
})
