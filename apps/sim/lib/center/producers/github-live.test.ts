/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'
import {
  readCenterGithubLiveConfig,
  readCenterGithubLiveSnapshot,
} from '@/lib/center/producers/github-live'

describe('GitHub live Center adapter', () => {
  it('requires configured repositories', () => {
    expect(readCenterGithubLiveConfig({})).toBeNull()
  })

  it('parses live repository configuration', () => {
    expect(
      readCenterGithubLiveConfig({
        CENTER_GITHUB_LIVE_REPOS: 'kyin/sim, bad repo, org/repo',
        CENTER_GITHUB_TOKEN: 'token-1',
        CENTER_GITHUB_API_BASE_URL: 'https://github.example/api',
      })
    ).toEqual({
      repos: ['kyin/sim', 'org/repo'],
      token: 'token-1',
      baseUrl: 'https://github.example/api',
    })
  })

  it('maps mocked live GitHub REST responses into Center GitHub records', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-1' })
      if (path.endsWith('/commits?per_page=5')) {
        return jsonResponse([
          {
            sha: 'abcdef1234567890',
            html_url: 'https://github.com/kyin/sim/commit/abcdef1234567890',
            author: { login: 'kyin' },
            commit: {
              message: 'Wire live GitHub producer',
              author: { name: 'Kevin', date: '2026-06-29T01:00:00Z' },
            },
          },
        ])
      }
      if (path.endsWith('/issues?state=all&per_page=10')) {
        return jsonResponse([
          {
            number: 42,
            title: 'Live import issue',
            state: 'open',
            updated_at: '2026-06-29T01:10:00Z',
            html_url: 'https://github.com/kyin/sim/issues/42',
            labels: [{ name: 'center' }],
            assignees: [{ login: 'kyin' }],
          },
        ])
      }
      if (path.endsWith('/pulls?state=all&per_page=10')) {
        return jsonResponse([
          {
            number: 17,
            title: 'Live import PR',
            state: 'open',
            updated_at: '2026-06-29T01:20:00Z',
            html_url: 'https://github.com/kyin/sim/pull/17',
            head: { sha: 'abcdef1234567890' },
            base: { ref: 'main' },
          },
        ])
      }
      if (path.endsWith('/actions/runs?per_page=5')) {
        return jsonResponse({
          workflow_runs: [
            {
              id: 1234,
              name: 'Center Checks',
              status: 'completed',
              conclusion: 'failure',
              updated_at: '2026-06-29T01:40:00Z',
              head_sha: 'abcdef1234567890',
              html_url: 'https://github.com/kyin/sim/actions/runs/1234',
            },
          ],
        })
      }
      if (path.endsWith('/pulls/17/reviews?per_page=5')) {
        return jsonResponse([
          {
            id: 9001,
            state: 'CHANGES_REQUESTED',
            submitted_at: '2026-06-29T01:30:00Z',
            html_url: 'https://github.com/kyin/sim/pull/17#pullrequestreview-9001',
            user: { login: 'reviewer' },
          },
        ])
      }
      throw new Error(`Unexpected GitHub request ${path}`)
    }) as unknown as typeof fetch

    const snapshot = await readCenterGithubLiveSnapshot(
      {
        repos: ['kyin/sim'],
        token: 'token-1',
        baseUrl: 'https://api.github.test',
      },
      fetchImpl
    )

    expect(snapshot.sourcePath).toBe('github-live:kyin/sim')
    expect(snapshot.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'commit', repo: 'kyin/sim' }),
        expect.objectContaining({ kind: 'issue', repo: 'kyin/sim' }),
        expect.objectContaining({ kind: 'pull_request', repo: 'kyin/sim' }),
        expect.objectContaining({ kind: 'review', repo: 'kyin/sim' }),
        expect.objectContaining({ kind: 'ci_run', repo: 'kyin/sim' }),
      ])
    )
    expect(snapshot.records).toHaveLength(5)
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(5)
  })
})

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response
}
