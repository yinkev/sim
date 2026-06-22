/**
 * @vitest-environment node
 */
import { createMockRequest } from '@sim/testing'
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('returns an ok status payload', async () => {
    const response = await GET(
      createMockRequest('GET', undefined, {}, 'http://localhost:3000/api/health'),
      {}
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    })
  })
})
