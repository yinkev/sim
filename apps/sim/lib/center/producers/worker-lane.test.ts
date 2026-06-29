/**
 * @vitest-environment node
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildWorkerLaneImportPacket } from '@/lib/center/producers/worker-lane'
import { readCenterWorkerLaneSnapshot } from '@/lib/center/producers/worker-lane-files'

describe('Worker lane Center adapter', () => {
  it('maps worker execution records into Center events, evidence, loops, and review proposals', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'worker-lane-center-'))
    const filePath = path.join(tempDir, 'events.json')
    await writeFile(
      filePath,
      JSON.stringify({
        records: [
          {
            kind: 'run_started',
            producerId: 'codex',
            producerDisplayName: 'Codex',
            runId: 'codex-run-1',
            loopKey: 'center-phase-11',
            loopTitle: 'Center Phase 11 Worker Lane',
            taskTitle: 'Implement worker lane producer',
            startedAt: '2026-06-29T04:00:00Z',
            command: 'codex exec phase-11',
            url: 'file://worker/codex-run-1',
          },
          {
            kind: 'diff',
            producerId: 'codex',
            producerDisplayName: 'Codex',
            runId: 'codex-run-1',
            loopKey: 'center-phase-11',
            loopTitle: 'Center Phase 11 Worker Lane',
            taskTitle: 'Implement worker lane producer',
            diffId: 'diff-1',
            title: 'Worker lane adapter patch',
            changedAt: '2026-06-29T04:05:00Z',
            filesChanged: 5,
            insertions: 240,
            deletions: 0,
            url: 'file://worker/diff-1',
          },
          {
            kind: 'test_result',
            producerId: 'codex',
            producerDisplayName: 'Codex',
            runId: 'codex-run-1',
            loopKey: 'center-phase-11',
            loopTitle: 'Center Phase 11 Worker Lane',
            taskTitle: 'Implement worker lane producer',
            testId: 'test-1',
            title: 'worker-lane.test.ts',
            status: 'passed',
            passed: 1,
            failed: 0,
            finishedAt: '2026-06-29T04:10:00Z',
            url: 'file://worker/test-1',
          },
          {
            kind: 'artifact',
            producerId: 'codex',
            producerDisplayName: 'Codex',
            runId: 'codex-run-1',
            loopKey: 'center-phase-11',
            loopTitle: 'Center Phase 11 Worker Lane',
            taskTitle: 'Implement worker lane producer',
            artifactId: 'artifact-1',
            title: 'Phase 11 implementation record',
            artifactKind: 'bridge-doc',
            createdAt: '2026-06-29T04:12:00Z',
            url: 'file://worker/artifact-1',
          },
          {
            kind: 'review_needed',
            producerId: 'codex',
            producerDisplayName: 'Codex',
            runId: 'codex-run-1',
            loopKey: 'center-phase-11',
            loopTitle: 'Center Phase 11 Worker Lane',
            taskTitle: 'Implement worker lane producer',
            reviewId: 'review-1',
            title: 'Review worker lane mapping',
            reason: 'New producer contract changes Center review state.',
            authorityRequired: 'A2',
            requestedAt: '2026-06-29T04:15:00Z',
            url: 'file://worker/review-1',
          },
          {
            kind: 'run_completed',
            producerId: 'codex',
            producerDisplayName: 'Codex',
            runId: 'codex-run-1',
            loopKey: 'center-phase-11',
            loopTitle: 'Center Phase 11 Worker Lane',
            taskTitle: 'Implement worker lane producer',
            status: 'completed',
            durationMs: 900000,
            completedAt: '2026-06-29T04:20:00Z',
            url: 'file://worker/codex-run-1',
          },
          {
            kind: 'failure',
            producerId: 'hermes',
            producerDisplayName: 'Hermes',
            runId: 'hermes-run-1',
            loopKey: 'hermes-memory-relay',
            loopTitle: 'Hermes Memory Relay',
            taskTitle: 'Audit memory relay state',
            failureId: 'failure-1',
            title: 'Missing relay receipt',
            severity: 'high',
            message: 'Worker ended without attaching a receipt.',
            failedAt: '2026-06-29T04:25:00Z',
            url: 'file://worker/failure-1',
          },
        ],
      })
    )

    const snapshot = await readCenterWorkerLaneSnapshot(filePath)
    const packet = buildWorkerLaneImportPacket(snapshot)

    expect(snapshot.records).toHaveLength(7)
    expect(packet.rawEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'agent.run.started',
        'agent.diff.produced',
        'agent.test.passed',
        'agent.artifact.created',
        'agent.review.requested',
        'agent.run.completed',
        'agent.failure.recorded',
      ])
    )
    expect(packet.evidence).toHaveLength(7)
    expect(packet.observations).toHaveLength(7)
    expect(packet.loops).toHaveLength(2)
    expect(packet.recommendations).toHaveLength(1)
    expect(packet.actionProposals).toHaveLength(1)
    expect(
      packet.loops.find((loop) => loop.sourceRef === 'worker-lane:loop:center-phase-11')
    ).toMatchObject({
      title: 'Center Phase 11 Worker Lane',
      domain: 'agent-execution',
      status: 'blocked',
      nextAction: 'Review worker output: Review worker lane mapping',
    })
    expect(
      packet.loops.find((loop) => loop.sourceRef === 'worker-lane:loop:hermes-memory-relay')
    ).toMatchObject({
      title: 'Hermes Memory Relay',
      domain: 'agent-execution',
      status: 'blocked',
      nextAction: 'Inspect failure: Missing relay receipt',
    })
    expect(packet.actionProposals.at(0)).toMatchObject({
      actionType: 'review.agent_work',
      targetType: 'agent-run',
      targetId: 'codex-run-1',
    })
  })
})
