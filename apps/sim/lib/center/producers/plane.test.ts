/**
 * @vitest-environment node
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPlaneImportPacket } from '@/lib/center/producers/plane'
import { readCenterPlaneSnapshot } from '@/lib/center/producers/plane-files'

describe('Plane Center adapter', () => {
  it('maps Plane-shaped records into Center producer import records', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'plane-center-'))
    const filePath = path.join(tempDir, 'events.json')
    await writeFile(
      filePath,
      JSON.stringify({
        records: [
          {
            kind: 'project',
            workspace: 'sim',
            projectId: 'center',
            name: 'Center Operating Surface',
            status: 'active',
            updatedAt: '2026-06-29T02:00:00Z',
            lead: 'kyin',
            url: 'https://app.plane.so/sim/projects/center',
          },
          {
            kind: 'cycle',
            workspace: 'sim',
            projectId: 'center',
            cycleId: 'phase-9',
            name: 'Phase 9 Producers',
            status: 'active',
            startsAt: '2026-06-29',
            endsAt: '2026-07-03',
            updatedAt: '2026-06-29T02:05:00Z',
            url: 'https://app.plane.so/sim/projects/center/cycles/phase-9',
          },
          {
            kind: 'module',
            workspace: 'sim',
            projectId: 'center',
            moduleId: 'external-producers',
            name: 'External Producers',
            status: 'active',
            updatedAt: '2026-06-29T02:10:00Z',
            owner: 'kyin',
            url: 'https://app.plane.so/sim/projects/center/modules/external-producers',
          },
          {
            kind: 'issue',
            workspace: 'sim',
            projectId: 'center',
            issueId: 'issue-101',
            sequenceId: 'CENTER-101',
            title: 'Plane sync needs reviewable blocker state',
            status: 'blocked',
            priority: 'high',
            assignee: 'kyin',
            cycleId: 'phase-9',
            moduleId: 'external-producers',
            updatedAt: '2026-06-29T02:15:00Z',
            url: 'https://app.plane.so/sim/projects/center/issues/issue-101',
          },
          {
            kind: 'comment',
            workspace: 'sim',
            projectId: 'center',
            issueId: 'issue-101',
            commentId: 'comment-1',
            body: 'Waiting on the Center status mapping.',
            author: 'reviewer',
            createdAt: '2026-06-29T02:20:00Z',
            url: 'https://app.plane.so/sim/projects/center/issues/issue-101#comment-1',
          },
          {
            kind: 'status',
            workspace: 'sim',
            projectId: 'center',
            issueId: 'issue-101',
            sequenceId: 'CENTER-101',
            title: 'Plane sync needs reviewable blocker state',
            fromStatus: 'in_progress',
            toStatus: 'blocked',
            actor: 'reviewer',
            changedAt: '2026-06-29T02:25:00Z',
            url: 'https://app.plane.so/sim/projects/center/issues/issue-101',
          },
        ],
      })
    )

    const snapshot = await readCenterPlaneSnapshot(filePath)
    const packet = buildPlaneImportPacket(snapshot)

    expect(snapshot.records).toHaveLength(6)
    expect(packet.evidence).toHaveLength(6)
    expect(packet.rawEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'plane.project.updated',
        'plane.cycle.updated',
        'plane.module.updated',
        'plane.issue.updated',
        'plane.comment.created',
        'plane.issue.status_changed',
      ])
    )
    expect(packet.observations.map((observation) => observation.observationType)).toEqual(
      expect.arrayContaining([
        'planning.project_active',
        'planning.cycle_active',
        'planning.module_active',
        'planning.issue_blocked',
        'planning.comment_added',
        'planning.status_blocked',
      ])
    )
    expect(packet.loops.at(0)).toMatchObject({
      title: 'Plane Center Operating Surface',
      domain: 'project',
      status: 'blocked',
      nextAction: 'Unblock Plane issue CENTER-101: Plane sync needs reviewable blocker state',
    })
    expect(packet.loops.at(0)?.blockedBy).toEqual(
      expect.arrayContaining([
        'Plane issue CENTER-101 is blocked',
        'Plane issue CENTER-101 moved to blocked',
      ])
    )
  })
})
