/**
 * @vitest-environment node
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CenterLocalSpine, createMemoryCenterStorage } from '@/lib/center/local-spine'
import { parseCenterReviewPacketFile } from '@/lib/center/review-packet-files'
import { applyCenterReviewPacketImport } from '@/lib/center/review-packets'

describe('Center review packets', () => {
  it('parses review packet fixtures into worker gate records', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'center-review-'))
    const filePath = path.join(dir, 'RP-1.md')
    await writeFile(
      filePath,
      `---
id: RP-1
version: v1
type: review-packet
project: center
status: converged
round: 2
max_rounds: 20
created: 2026-01-01T00:00:00Z
updated: 2026-01-02T00:00:00Z
topic: Architecture review
approval_state: approved-with-required-changes
worker_gate: approved-for-execution
---

# Review Packet - Architecture Review

## Verdict

APPROVE WITH REQUIRED CHANGES.
`
    )

    const record = await parseCenterReviewPacketFile(filePath)

    expect(record).toMatchObject({
      sourceRef: 'center-review:packet:RP-1',
      packetId: 'RP-1',
      projectId: 'center',
      status: 'converged',
      approvalState: 'approved-with-required-changes',
      workerGate: 'approved-for-execution',
      round: 2,
      maxRounds: 20,
      uri: filePath,
      payload: {
        approvalState: 'approved-with-required-changes',
        workerGate: 'approved-for-execution',
      },
    })
  })

  it('lets explicit gate frontmatter override stale verdict prose', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'center-review-'))
    const filePath = path.join(dir, 'RP-2.md')
    await writeFile(
      filePath,
      `---
id: RP-2
type: review-packet
project: center
status: converged
round: 8
max_rounds: 20
topic: Worker gate review
approval_state: rejected
worker_gate: blocked
---

# Review Packet - Worker Gate Review

## Verdict

APPROVE.
`
    )

    const record = await parseCenterReviewPacketFile(filePath)

    expect(record).toMatchObject({
      packetId: 'RP-2',
      approvalState: 'rejected',
      workerGate: 'blocked',
      payload: {
        approvalState: 'rejected',
        workerGate: 'blocked',
        inferredApprovalState: 'approved',
      },
    })
  })

  it('imports review packets idempotently with source evidence', async () => {
    const storage = createMemoryCenterStorage()
    const spine = new CenterLocalSpine(storage)
    const profile = await spine.createProfile({ displayName: 'Kevin' })
    const record = {
      sourceRef: 'center-review:packet:RP-1',
      packetId: 'RP-1',
      projectId: 'center',
      title: 'Review Packet',
      status: 'converged' as const,
      approvalState: 'approved-with-required-changes' as const,
      workerGate: 'approved-for-execution' as const,
      round: 2,
      maxRounds: 20,
      uri: '/tmp/RP-1.md',
    }

    const first = await applyCenterReviewPacketImport(storage, profile.id, [record])
    const second = await applyCenterReviewPacketImport(storage, profile.id, [record])
    const exported = await spine.exportProfile(profile.id)

    expect(first).toMatchObject({ reviewPacketsAdded: 1, evidenceAdded: 1 })
    expect(second).toMatchObject({ reviewPacketsAdded: 0, evidenceAdded: 0, skippedExisting: 1 })
    expect(exported.evidence).toHaveLength(1)
    expect(exported.reviewPackets).toHaveLength(1)
    expect(exported.reviewPackets[0].evidenceRefs).toEqual([exported.evidence[0].id])
  })
})
