/**
 * @vitest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { deriveCenterBaselinePrediction } from '@/lib/center/baseline-prediction'
import { readCenterCapabilityRegistry } from '@/lib/center/capability-registry'
import { CenterLocalSpine, createMemoryCenterStorage } from '@/lib/center/local-spine'
import type { CenterProducerImportPacket } from '@/lib/center/producer-import'
import { applyCenterProducerImport } from '@/lib/center/producer-import'
import { buildGithubImportPacket } from '@/lib/center/producers/github'
import { buildLearnUnderstandImportPackets } from '@/lib/center/producers/learn-understand'
import {
  buildMs2SchedulerImportPacket,
  readMs2SchedulerSnapshot,
} from '@/lib/center/producers/ms2scheduler'
import { buildPlaneImportPacket } from '@/lib/center/producers/plane'
import { buildWorkerLaneImportPacket } from '@/lib/center/producers/worker-lane'
import { parseCenterReviewPacketFile } from '@/lib/center/review-packet-files'
import { applyCenterReviewPacketImport } from '@/lib/center/review-packets'

describe('Center all-producer smoke harness', () => {
  it('imports every producer packet twice without unresolved references or duplicates', async () => {
    const storage = createMemoryCenterStorage()
    const spine = new CenterLocalSpine(storage)
    const profile = await spine.createProfile({ displayName: 'Kevin' })
    const registry = await readCenterCapabilityRegistry()
    const packets = [
      await createMs2Packet(),
      createGithubPacket(),
      createPlanePacket(),
      ...createLearnUnderstandPackets(),
      createWorkerLanePacket(),
    ]
    const reviewPacket = await createReviewPacketRecord()

    assertCapabilitiesRegistered(packets, registry.registeredIds)

    const firstSummaries = []
    for (const packet of packets) {
      firstSummaries.push(
        await applyCenterProducerImport(storage, profile.id, packet, {
          registeredCapabilityIds: registry.registeredIds,
        })
      )
    }
    const firstReviewSummary = await applyCenterReviewPacketImport(storage, profile.id, [
      reviewPacket,
    ])
    const firstExport = await spine.exportProfile(profile.id)
    const projection = deriveCenterBaselinePrediction(firstExport, profile.id)

    for (const summary of firstSummaries) {
      expect(summary.blockedUnknownCapabilityIds).toEqual([])
      expect(summary.unresolvedEvidenceRefs).toEqual([])
      expect(summary.unresolvedSourceEventRefs).toEqual([])
      expect(summary.unresolvedRecommendationRefs).toEqual([])
      expect(summary.observationsSkippedMissingEvents).toBe(0)
    }
    expect(firstReviewSummary).toMatchObject({ reviewPacketsAdded: 1, evidenceAdded: 1 })
    expect(firstExport.evidence.length).toBeGreaterThan(0)
    expect(firstExport.rawEvents.length).toBeGreaterThan(0)
    expect(firstExport.observations.length).toBeGreaterThan(0)
    expect(firstExport.loops.length).toBeGreaterThan(0)
    expect(firstExport.reviewPackets).toHaveLength(1)
    expect(projection.prediction.status).toBe('baseline')
    expect(projection.prediction.dataSufficiency).toBe('medium')

    for (const packet of packets) {
      const summary = await applyCenterProducerImport(storage, profile.id, packet, {
        registeredCapabilityIds: registry.registeredIds,
      })
      expect(summary.blockedUnknownCapabilityIds).toEqual([])
      expect(summary.evidenceAdded).toBe(0)
      expect(summary.rawEventsAdded).toBe(0)
      expect(summary.observationsAdded).toBe(0)
      expect(summary.loopsAdded).toBe(0)
      expect(summary.recommendationsAdded).toBe(0)
      expect(summary.actionProposalsAdded).toBe(0)
      expect(summary.skippedExisting).toBeGreaterThan(0)
    }
    const secondReviewSummary = await applyCenterReviewPacketImport(storage, profile.id, [
      reviewPacket,
    ])
    const secondExport = await spine.exportProfile(profile.id)

    expect(secondReviewSummary).toMatchObject({
      reviewPacketsAdded: 0,
      evidenceAdded: 0,
      skippedExisting: 1,
    })
    expect(counts(secondExport)).toEqual(counts(firstExport))
  })
})

async function createMs2Packet(): Promise<CenterProducerImportPacket> {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'center-ms2-'))
  const planDir = path.join(dataDir, 'plans')
  await mkdir(planDir, { recursive: true })
  await writeFile(path.join(dataDir, 'current'), 'v001')
  await writeFile(
    path.join(planDir, 'v001.json'),
    JSON.stringify({
      version: 'v001',
      created_at: '2026-06-28T08:00:00Z',
      cfg: { today: '2026-06-28' },
      source: { fixture: 'center smoke' },
      tasks: [
        {
          id: 'task-1',
          resource_title: 'Cardio review',
          phase: 'systems',
          priority: 'high',
          est_minutes: 45,
        },
      ],
      result: {
        status: 'feasible',
        inputs_hash: 'hash-v001',
        finishes_on: '2026-06-30',
        horizon_end: '2026-07-05',
        assignments: [
          {
            action: 'place',
            date: '2026-06-28',
            task_id: 'task-1',
            reason: 'fixture',
          },
        ],
      },
    })
  )
  await writeFile(
    path.join(planDir, 'v002.json'),
    JSON.stringify({
      version: 'v002',
      parent_version: 'v001',
      created_at: '2026-06-28T09:00:00Z',
      tasks: [{ id: 'task-1', resource_title: 'Cardio review' }],
      result: {
        status: 'feasible',
        inputs_hash: 'hash-v002',
        assignments: [{ action: 'place', date: '2026-06-29', task_id: 'task-1' }],
      },
    })
  )
  await writeFile(
    path.join(dataDir, 'activity.jsonl'),
    [
      JSON.stringify({
        recorded_at: '2026-06-28T08:01:00Z',
        plan_version: 'v001',
        study_date: '2026-06-28',
        task_id: 'task-1',
        event: 'start',
      }),
      JSON.stringify({
        recorded_at: '2026-06-28T08:45:00Z',
        plan_version: 'v001',
        study_date: '2026-06-28',
        task_id: 'task-1',
        event: 'end',
      }),
    ].join('\n')
  )
  await writeFile(
    path.join(dataDir, 'completion.jsonl'),
    `${JSON.stringify({
      recorded_at: '2026-06-28T08:46:00Z',
      plan_version: 'v001',
      study_date: '2026-06-28',
      task_id: 'task-1',
      outcome: 'completed',
      actual_minutes: 44,
    })}\n`
  )
  await writeFile(path.join(dataDir, 'calibration_state.json'), JSON.stringify({ task_1: 44 }))

  return buildMs2SchedulerImportPacket(await readMs2SchedulerSnapshot(dataDir))
}

function createGithubPacket(): CenterProducerImportPacket {
  return buildGithubImportPacket({
    sourcePath: 'fixture:github',
    records: [
      {
        kind: 'commit',
        repo: 'kyin/sim',
        sha: 'abcdef1234567890',
        message: 'Add Center smoke fixture',
        committedAt: '2026-06-28T10:00:00Z',
        author: 'Kevin',
        branch: 'main',
      },
      {
        kind: 'pull_request',
        repo: 'kyin/sim',
        number: 42,
        title: 'Center hardening',
        state: 'open',
        updatedAt: '2026-06-28T10:10:00Z',
      },
      {
        kind: 'review',
        repo: 'kyin/sim',
        pullNumber: 42,
        reviewId: 'R1',
        state: 'CHANGES_REQUESTED',
        submittedAt: '2026-06-28T10:20:00Z',
      },
      {
        kind: 'ci_run',
        repo: 'kyin/sim',
        runId: '1001',
        workflowName: 'center-tests',
        status: 'completed',
        conclusion: 'failure',
        updatedAt: '2026-06-28T10:30:00Z',
      },
    ],
  })
}

function createPlanePacket(): CenterProducerImportPacket {
  return buildPlaneImportPacket({
    sourcePath: 'fixture:plane',
    records: [
      {
        kind: 'project',
        workspace: 'sim',
        projectId: 'center',
        name: 'Center',
        status: 'active',
        updatedAt: '2026-06-28T11:00:00Z',
      },
      {
        kind: 'issue',
        workspace: 'sim',
        projectId: 'center',
        issueId: 'issue-1',
        sequenceId: 'CEN-1',
        title: 'Close producer gate',
        status: 'blocked',
        updatedAt: '2026-06-28T11:10:00Z',
        priority: 'high',
      },
      {
        kind: 'status',
        workspace: 'sim',
        projectId: 'center',
        issueId: 'issue-1',
        sequenceId: 'CEN-1',
        fromStatus: 'todo',
        toStatus: 'blocked',
        changedAt: '2026-06-28T11:20:00Z',
      },
    ],
  })
}

function createLearnUnderstandPackets(): CenterProducerImportPacket[] {
  return buildLearnUnderstandImportPackets({
    sourcePath: 'fixture:learn-understand',
    records: [
      {
        kind: 'learning_gap',
        gapId: 'gap-1',
        topic: 'center',
        title: 'Capability gate needs proof',
        severity: 'high',
        detectedAt: '2026-06-28T12:00:00Z',
      },
      {
        kind: 'practice_task',
        taskId: 'practice-1',
        topic: 'center',
        title: 'Run import smoke harness',
        status: 'open',
        createdAt: '2026-06-28T12:10:00Z',
      },
      {
        kind: 'system_map',
        mapId: 'map-1',
        scope: 'center',
        title: 'Center producer graph',
        generatedAt: '2026-06-28T12:20:00Z',
        nodeCount: 8,
        edgeCount: 7,
      },
      {
        kind: 'risk_evidence',
        riskId: 'risk-1',
        scope: 'center',
        title: 'Unresolved refs could hide dropped evidence',
        severity: 'medium',
        detectedAt: '2026-06-28T12:30:00Z',
      },
    ],
  })
}

function createWorkerLanePacket(): CenterProducerImportPacket {
  const base = {
    producerId: 'codex',
    producerDisplayName: 'Codex',
    runId: 'run-1',
    loopKey: 'center-hardening',
    loopTitle: 'Center Hardening',
    taskTitle: 'Implement capability gate',
  }
  return buildWorkerLaneImportPacket({
    sourcePath: 'fixture:worker-lane',
    records: [
      {
        ...base,
        kind: 'run_started',
        startedAt: '2026-06-28T13:00:00Z',
        command: 'bun test apps/sim/lib/center',
      },
      {
        ...base,
        kind: 'diff',
        diffId: 'diff-1',
        title: 'Capability enforcement diff',
        changedAt: '2026-06-28T13:10:00Z',
        filesChanged: 4,
      },
      {
        ...base,
        kind: 'test_result',
        testId: 'center-tests',
        title: 'Center tests',
        status: 'passed',
        finishedAt: '2026-06-28T13:20:00Z',
        passed: 12,
        failed: 0,
      },
      {
        ...base,
        kind: 'review_needed',
        reviewId: 'review-1',
        title: 'Review capability gate',
        reason: 'Runtime boundary changed',
        requestedAt: '2026-06-28T13:30:00Z',
        authorityRequired: 'A2',
      },
    ],
  })
}

async function createReviewPacketRecord() {
  const dir = await mkdtemp(path.join(tmpdir(), 'center-review-'))
  const filePath = path.join(dir, 'RP-1.md')
  await writeFile(
    filePath,
    `---
id: RP-1
type: review-packet
project: center
status: converged
round: 8
max_rounds: 20
topic: Center hardening
approval_state: approved-with-required-changes
worker_gate: approved-for-execution
---

# Center Hardening Review

## Verdict

APPROVE WITH REQUIRED CHANGES.
`
  )
  const record = await parseCenterReviewPacketFile(filePath)
  if (!record) throw new Error('Expected review packet fixture to parse')
  return record
}

function assertCapabilitiesRegistered(
  packets: CenterProducerImportPacket[],
  registeredCapabilityIds: string[]
) {
  const registered = new Set(registeredCapabilityIds)
  for (const capabilityId of new Set(packets.flatMap((packet) => packet.capabilityIds))) {
    expect(registered.has(capabilityId), capabilityId).toBe(true)
  }
}

function counts(dataset: Awaited<ReturnType<CenterLocalSpine['exportProfile']>>) {
  return {
    profiles: dataset.profiles.length,
    actors: dataset.actors.length,
    rawEvents: dataset.rawEvents.length,
    evidence: dataset.evidence.length,
    observations: dataset.observations.length,
    loops: dataset.loops.length,
    decisions: dataset.decisions.length,
    recommendations: dataset.recommendations.length,
    actionProposals: dataset.actionProposals.length,
    featureProjections: dataset.featureProjections.length,
    predictionSummaries: dataset.predictionSummaries.length,
    outcomes: dataset.outcomes.length,
    reviewPackets: dataset.reviewPackets.length,
  }
}
