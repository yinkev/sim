/**
 * @vitest-environment node
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildGithubImportPacket } from '@/lib/center/producers/github'
import { readCenterGithubSnapshot } from '@/lib/center/producers/github-files'

describe('GitHub Center adapter', () => {
  it('maps GitHub-shaped records into Center producer import records', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'github-center-'))
    const filePath = path.join(tempDir, 'events.json')
    await writeFile(
      filePath,
      JSON.stringify({
        records: [
          {
            kind: 'commit',
            repo: 'kyin/sim',
            sha: 'abcdef1234567890',
            message: 'Add Center GitHub producer\n\nMap events into Center.',
            committedAt: '2026-06-29T01:00:00Z',
            author: 'kyin',
            branch: 'main',
            url: 'https://github.com/kyin/sim/commit/abcdef1234567890',
          },
          {
            kind: 'issue',
            repo: 'kyin/sim',
            number: 42,
            title: 'Center import needs GitHub evidence',
            state: 'open',
            updatedAt: '2026-06-29T01:10:00Z',
            labels: ['center'],
            assignees: ['kyin'],
            url: 'https://github.com/kyin/sim/issues/42',
          },
          {
            kind: 'pull_request',
            repo: 'kyin/sim',
            number: 17,
            title: 'Wire Center GitHub producer',
            state: 'open',
            updatedAt: '2026-06-29T01:20:00Z',
            headSha: 'abcdef1234567890',
            baseRef: 'main',
            url: 'https://github.com/kyin/sim/pull/17',
          },
          {
            kind: 'review',
            repo: 'kyin/sim',
            pullNumber: 17,
            reviewId: '9001',
            state: 'CHANGES_REQUESTED',
            submittedAt: '2026-06-29T01:30:00Z',
            author: 'reviewer',
            url: 'https://github.com/kyin/sim/pull/17#pullrequestreview-9001',
          },
          {
            kind: 'ci_run',
            repo: 'kyin/sim',
            runId: '1234',
            workflowName: 'Center Checks',
            status: 'completed',
            conclusion: 'failure',
            updatedAt: '2026-06-29T01:40:00Z',
            headSha: 'abcdef1234567890',
            url: 'https://github.com/kyin/sim/actions/runs/1234',
          },
        ],
      })
    )

    const snapshot = await readCenterGithubSnapshot(filePath)
    const packet = buildGithubImportPacket(snapshot)

    expect(snapshot.records).toHaveLength(5)
    expect(packet.evidence).toHaveLength(5)
    expect(packet.rawEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'github.commit',
        'github.issue.updated',
        'github.pull_request.updated',
        'github.pull_request.reviewed',
        'github.ci.failed',
      ])
    )
    expect(packet.observations.map((observation) => observation.observationType)).toEqual(
      expect.arrayContaining([
        'engineering.commit_landed',
        'engineering.issue_open',
        'engineering.pr_open',
        'engineering.review_blocking',
        'engineering.ci_failed',
      ])
    )
    expect(packet.loops.at(0)).toMatchObject({
      title: 'GitHub kyin/sim',
      domain: 'engineering',
      status: 'blocked',
      nextAction: 'Inspect failing CI run Center Checks in kyin/sim',
    })
    expect(packet.loops.at(0)?.blockedBy).toEqual(
      expect.arrayContaining(['Changes requested on PR #17', 'CI failed: Center Checks'])
    )
  })
})
