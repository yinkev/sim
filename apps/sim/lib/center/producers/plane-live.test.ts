/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'
import {
  readCenterPlaneLiveConfig,
  readCenterPlaneLiveSnapshot,
} from '@/lib/center/producers/plane-live'

describe('Plane live Center adapter', () => {
  it('requires workspace, project, and token configuration', () => {
    expect(readCenterPlaneLiveConfig({ CENTER_PLANE_WORKSPACE_SLUG: 'sim' })).toBeNull()
    expect(
      readCenterPlaneLiveConfig({
        CENTER_PLANE_WORKSPACE_SLUG: 'sim',
        CENTER_PLANE_API_KEY: 'plane-token',
      })
    ).toBeNull()
  })

  it('parses live Plane configuration', () => {
    expect(
      readCenterPlaneLiveConfig({
        CENTER_PLANE_WORKSPACE_SLUG: 'sim',
        CENTER_PLANE_PROJECT_IDS: 'center, producers',
        CENTER_PLANE_API_KEY: 'plane-token',
        CENTER_PLANE_BASE_URL: 'https://plane.example',
        CENTER_PLANE_APP_BASE_URL: 'https://app.plane.example',
      })
    ).toEqual({
      workspaceSlug: 'sim',
      projectIds: ['center', 'producers'],
      token: 'plane-token',
      baseUrl: 'https://plane.example',
      appBaseUrl: 'https://app.plane.example',
    })
  })

  it('maps mocked live Plane REST responses into Center Plane records', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer plane-token' })
      if (path.endsWith('/api/v1/workspaces/sim/projects/center/')) {
        return jsonResponse({
          id: 'center',
          name: 'Center Operating Surface',
          status: 'active',
          updated_at: '2026-06-29T02:00:00Z',
          project_lead: { display_name: 'Kevin' },
        })
      }
      if (
        path.endsWith('/api/v1/workspaces/sim/projects/center/cycles/?per_page=100&cycle_view=all')
      ) {
        return jsonResponse({
          results: [
            {
              id: 'cycle-1',
              name: 'Phase 9 Producers',
              status: 'current',
              start_date: '2026-06-29',
              end_date: '2026-07-03',
              updated_at: '2026-06-29T02:05:00Z',
            },
          ],
        })
      }
      if (
        path.endsWith(
          '/api/v1/workspaces/sim/projects/center/modules/?per_page=100&expand=assignees'
        )
      ) {
        return jsonResponse({
          results: [
            {
              id: 'module-1',
              name: 'External Producers',
              status: 'in_progress',
              updated_at: '2026-06-29T02:10:00Z',
              members: [{ display_name: 'Kevin' }],
            },
          ],
        })
      }
      if (
        path.endsWith(
          '/api/v1/workspaces/sim/projects/center/work-items/?per_page=100&expand=assignees'
        )
      ) {
        return jsonResponse({
          results: [
            {
              id: 'issue-101',
              name: 'Plane sync needs blocker state',
              state: { name: 'blocked' },
              priority: 'high',
              assignees: [{ display_name: 'Kevin' }],
              module_id: 'module-1',
              cycle_id: 'cycle-1',
              sequence_id: 101,
              updated_at: '2026-06-29T02:15:00Z',
            },
          ],
        })
      }
      throw new Error(`Unexpected Plane request ${path}`)
    }) as unknown as typeof fetch

    const snapshot = await readCenterPlaneLiveSnapshot(
      {
        workspaceSlug: 'sim',
        projectIds: ['center'],
        token: 'plane-token',
        baseUrl: 'https://api.plane.test',
        appBaseUrl: 'https://app.plane.test',
      },
      fetchImpl
    )

    expect(snapshot.sourcePath).toBe('plane-live:sim:center')
    expect(snapshot.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'project', projectId: 'center' }),
        expect.objectContaining({ kind: 'cycle', cycleId: 'cycle-1' }),
        expect.objectContaining({ kind: 'module', moduleId: 'module-1' }),
        expect.objectContaining({
          kind: 'issue',
          issueId: 'issue-101',
          status: 'blocked',
          sequenceId: '101',
        }),
      ])
    )
    expect(snapshot.records).toHaveLength(4)
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(4)
  })
})

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response
}
