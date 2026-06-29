import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { importCenterGithubContract } from '@/lib/api/contracts/center'
import { parseRequest } from '@/lib/api/server'
import {
  getUnknownCenterCapabilityIds,
  readCenterCapabilityRegistry,
} from '@/lib/center/capability-registry'
import { buildGithubImportPacket } from '@/lib/center/producers/github'
import { readCenterGithubSnapshot } from '@/lib/center/producers/github-files'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

const logger = createLogger('CenterGithubImportAPI')

function isLocalGithubImportEnabled(): boolean {
  return process.env.CENTER_DEV === '1' || process.env.NODE_ENV !== 'production'
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const parsed = await parseRequest(importCenterGithubContract, request, {})
  if (!parsed.success) return parsed.response

  if (!isLocalGithubImportEnabled()) {
    return NextResponse.json({ error: 'GitHub import is local-development only' }, { status: 403 })
  }

  const snapshot = await readCenterGithubSnapshot()
  const packet = buildGithubImportPacket(snapshot)
  const capabilities = await readCenterCapabilityRegistry()
  const unknownCapabilityIds = getUnknownCenterCapabilityIds(packet, capabilities)
  if (unknownCapabilityIds.length > 0) {
    return NextResponse.json(
      { error: 'Unknown Center capability ids', unknownCapabilityIds },
      { status: 422 }
    )
  }
  logger.info('Prepared GitHub Center import packet', {
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
    capabilities,
  })
})
