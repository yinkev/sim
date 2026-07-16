/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { deploymentKeys } from '@/hooks/queries/utils/deployment-keys'

function readQuerySource(fileName: string): string {
  return readFileSync(new URL(fileName, import.meta.url), 'utf8')
}

describe('deployment query key seam', () => {
  it('preserves every deployment query key shape', () => {
    expect(deploymentKeys.all).toEqual(['deployments'])
    expect(deploymentKeys.infos()).toEqual(['deployments', 'info'])
    expect(deploymentKeys.info('workflow-1')).toEqual(['deployments', 'info', 'workflow-1'])
    expect(deploymentKeys.info(null)).toEqual(['deployments', 'info', ''])
    expect(deploymentKeys.deployedState('workflow-1')).toEqual([
      'deployments',
      'deployedState',
      'workflow-1',
    ])
    expect(deploymentKeys.deployedState(null)).toEqual(['deployments', 'deployedState', ''])
    expect(deploymentKeys.allVersions()).toEqual(['deployments', 'versions'])
    expect(deploymentKeys.versions('workflow-1')).toEqual(['deployments', 'versions', 'workflow-1'])
    expect(deploymentKeys.versions(null)).toEqual(['deployments', 'versions', ''])
    expect(deploymentKeys.chatStatuses()).toEqual(['deployments', 'chatStatus'])
    expect(deploymentKeys.chatStatus('workflow-1')).toEqual([
      'deployments',
      'chatStatus',
      'workflow-1',
    ])
    expect(deploymentKeys.chatStatus(null)).toEqual(['deployments', 'chatStatus', ''])
    expect(deploymentKeys.chatDetails()).toEqual(['deployments', 'chatDetail'])
    expect(deploymentKeys.chatDetail('chat-1')).toEqual(['deployments', 'chatDetail', 'chat-1'])
    expect(deploymentKeys.chatDetail(null)).toEqual(['deployments', 'chatDetail', ''])
  })

  it('keeps schedules on the leaf module and preserves the broad export', () => {
    const schedules = readQuerySource('schedules.ts')
    const deployments = readQuerySource('deployments.ts')

    expect(schedules).toContain("from '@/hooks/queries/utils/deployment-keys'")
    expect(schedules).not.toContain("from '@/hooks/queries/deployments'")
    expect(deployments).toContain("from '@/hooks/queries/utils/deployment-keys'")
    expect(deployments).not.toMatch(/export const deploymentKeys\s*=/)
  })
})
