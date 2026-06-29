/**
 * @vitest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildMs2SchedulerImportPacket,
  readMs2SchedulerSnapshot,
} from '@/lib/center/producers/ms2scheduler'

describe('MS2Scheduler Center adapter', () => {
  it('maps local MS2Scheduler files into Center producer import records', async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), 'ms2-center-'))
    await mkdir(path.join(dataDir, 'plans'))
    await writeFile(path.join(dataDir, 'current'), 'v001')
    await writeFile(
      path.join(dataDir, 'plans', 'v001.json'),
      JSON.stringify({
        version: 'v001',
        created_at: '2026-01-01T00:00:00Z',
        cfg: { today: '2026-01-01' },
        tasks: [{ id: 'task-1', resource_title: 'Cardio review' }],
        result: {
          status: 'feasible',
          inputs_hash: 'hash-1',
          finishes_on: '2026-01-03',
          assignments: [
            {
              action: 'place',
              date: '2026-01-01',
              task_id: 'task-1',
              reason: 'first viable day',
            },
          ],
        },
      })
    )
    await writeFile(
      path.join(dataDir, 'plans', 'v002.json'),
      JSON.stringify({
        version: 'v002',
        parent_version: 'v001',
        result: {
          status: 'feasible',
          inputs_hash: 'hash-2',
          assignments: [{ action: 'place', date: '2026-01-02', task_id: 'task-1' }],
        },
      })
    )
    await writeFile(
      path.join(dataDir, 'activity.jsonl'),
      `${JSON.stringify({
        recorded_at: '2026-01-01T01:00:00Z',
        plan_version: 'v001',
        study_date: '2026-01-01',
        task_id: 'task-1',
        event: 'start',
      })}\n`
    )
    await writeFile(
      path.join(dataDir, 'completion.jsonl'),
      `${JSON.stringify({
        recorded_at: '2026-01-01T02:00:00Z',
        plan_version: 'v001',
        study_date: '2026-01-01',
        task_id: 'task-1',
        outcome: 'done',
        actual_minutes: 42,
      })}\n`
    )
    await writeFile(path.join(dataDir, 'calibration_state.json'), JSON.stringify({ Cardio: {} }))

    const snapshot = await readMs2SchedulerSnapshot(dataDir)
    const packet = buildMs2SchedulerImportPacket(snapshot)

    expect(packet.evidence.map((item) => item.sourceRef)).toEqual(
      expect.arrayContaining([
        'ms2:plan:v001:receipt',
        'ms2:plan:v002:receipt',
        'ms2:activity-log',
        'ms2:completion-log',
        'ms2:calibration-state',
      ])
    )
    expect(packet.rawEvents.map((item) => item.eventType)).toEqual(
      expect.arrayContaining(['study.plan.current', 'study.start', 'study.completion'])
    )
    expect(packet.observations.map((item) => item.observationType)).toEqual(
      expect.arrayContaining(['study.start', 'study.estimate_calibrated'])
    )
    expect(packet.loops[0]).toMatchObject({
      title: 'MS2Scheduler Study',
      nextAction: 'Cardio review on 2026-01-01',
    })
    expect(packet.recommendations[0].sourceRef).toBe('ms2:recovery:v002:recommendation')
    expect(packet.actionProposals[0]).toMatchObject({
      sourceRef: 'ms2:recovery:v002:action',
      recommendationRef: 'ms2:recovery:v002:recommendation',
      actionType: 'ms2scheduler.review_recovery_candidate',
    })
  })
})
