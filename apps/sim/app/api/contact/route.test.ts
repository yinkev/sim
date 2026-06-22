/**
 * @vitest-environment node
 */
import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCheckRateLimitDirect } = vi.hoisted(() => ({
  mockCheckRateLimitDirect: vi.fn(),
}))

vi.mock('@/components/emails', () => ({
  renderHelpConfirmationEmail: vi.fn(),
}))

vi.mock('@/lib/core/config/env', () => ({
  env: { EMAIL_DOMAIN: 'example.com' },
}))

vi.mock('@/lib/core/rate-limiter', () => ({
  RateLimiter: class {
    checkRateLimitDirect = mockCheckRateLimitDirect
  },
}))

vi.mock('@/lib/core/security/turnstile', () => ({
  isTurnstileConfigured: vi.fn(() => false),
  verifyTurnstileToken: vi.fn(),
}))

vi.mock('@/lib/core/utils/urls', () => ({
  getEmailDomain: vi.fn(() => 'example.com'),
  SITE_URL: 'http://localhost:3000',
}))

vi.mock('@/lib/messaging/email/mailer', () => ({
  sendEmail: vi.fn(),
}))

import { POST } from '@/app/api/contact/route'

function createInvalidJsonRequest(): NextRequest {
  return new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  }) as unknown as NextRequest
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimitDirect.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: new Date(Date.now() + 60_000),
    })
  })

  it('returns 400 for malformed JSON bodies', async () => {
    const response = await POST(createInvalidJsonRequest(), undefined)

    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
    expect(response.status).toBe(400)
  })
})
