/**
 * @vitest-environment node
 */
import { copilotHttpMock, copilotHttpMockFns } from '@sim/testing'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockReadFeatureCaseArtifact,
  MockFeatureCaseArtifactForbiddenError,
  MockFeatureCaseArtifactNotFoundError,
} = vi.hoisted(() => ({
  mockReadFeatureCaseArtifact: vi.fn(),
  MockFeatureCaseArtifactForbiddenError: class FeatureCaseArtifactForbiddenError extends Error {},
  MockFeatureCaseArtifactNotFoundError: class FeatureCaseArtifactNotFoundError extends Error {},
}))

vi.mock('@/lib/copilot/request/http', () => copilotHttpMock)
vi.mock('@/lib/mothership/control-panel/feature-case-ledger', () => ({
  FeatureCaseArtifactForbiddenError: MockFeatureCaseArtifactForbiddenError,
  FeatureCaseArtifactNotFoundError: MockFeatureCaseArtifactNotFoundError,
  readFeatureCaseArtifact: mockReadFeatureCaseArtifact,
}))

import {
  FeatureCaseArtifactForbiddenError,
  FeatureCaseArtifactNotFoundError,
} from '@/lib/mothership/control-panel/feature-case-ledger'
import { GET } from '@/app/api/mothership/control-panel/feature-case-artifact/route'

function request(query = '') {
  return new NextRequest(
    `http://localhost:3000/api/mothership/control-panel/feature-case-artifact${query}`,
    { method: 'GET' }
  )
}

describe('GET /api/mothership/control-panel/feature-case-artifact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    copilotHttpMockFns.mockAuthenticateCopilotRequestSessionOnly.mockResolvedValue({
      userId: 'user-1',
      isAuthenticated: true,
    })
    mockReadFeatureCaseArtifact.mockReturnValue({
      path: 'scripts/fixtures/mothership-feature-cases/valid/control-panel-ui.json',
      filename: 'control-panel-ui.json',
      contentType: 'text/plain; charset=utf-8',
      content: '{"id":"task-67-control-panel-ui"}',
    })
  })

  it('returns a selected FeatureCase artifact as text', async () => {
    const response = await GET(
      request('?eventId=task-67-control-panel-ui%3A2026-06-22T05%3A14%3A42.000Z&artifact=case')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe(
      'inline; filename="control-panel-ui.json"'
    )
    expect(response.headers.get('x-mothership-artifact-path')).toBe(
      'scripts/fixtures/mothership-feature-cases/valid/control-panel-ui.json'
    )
    await expect(response.text()).resolves.toBe('{"id":"task-67-control-panel-ui"}')
    expect(mockReadFeatureCaseArtifact).toHaveBeenCalledWith({
      eventId: 'task-67-control-panel-ui:2026-06-22T05:14:42.000Z',
      artifact: 'case',
    })
  })

  it('authenticates before parsing query params', async () => {
    copilotHttpMockFns.mockAuthenticateCopilotRequestSessionOnly.mockResolvedValueOnce({
      userId: null,
      isAuthenticated: false,
    })

    const response = await GET(request('?artifact=case'))

    expect(response.status).toBe(401)
    expect(mockReadFeatureCaseArtifact).not.toHaveBeenCalled()
  })

  it('rejects invalid query params without reading artifacts', async () => {
    const response = await GET(request('?eventId=task-67-control-panel-ui&artifact=everything'))

    expect(response.status).toBe(400)
    expect(mockReadFeatureCaseArtifact).not.toHaveBeenCalled()
  })

  it('returns 404 for unknown ledger artifacts', async () => {
    mockReadFeatureCaseArtifact.mockImplementationOnce(() => {
      throw new FeatureCaseArtifactNotFoundError('FeatureCase event not found: missing')
    })

    const response = await GET(request('?eventId=missing&artifact=case'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'FeatureCase event not found: missing',
    })
  })

  it('returns 403 for forbidden artifact paths', async () => {
    mockReadFeatureCaseArtifact.mockImplementationOnce(() => {
      throw new FeatureCaseArtifactForbiddenError('FeatureCase artifact path must be repo-relative')
    })

    const response = await GET(request('?eventId=task-67-control-panel-ui&artifact=case'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'FeatureCase artifact path must be repo-relative',
    })
  })

  it('fails closed on unexpected reader errors', async () => {
    mockReadFeatureCaseArtifact.mockImplementationOnce(() => {
      throw new Error('entryDigest does not match event payload')
    })

    const response = await GET(request('?eventId=task-67-control-panel-ui&artifact=case'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Failed to read FeatureCase artifact',
    })
  })
})
