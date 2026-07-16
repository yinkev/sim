/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maskPIIBatch, validatePII } from '@/lib/guardrails/validate_pii'

const mocks = vi.hoisted(() => ({
  piiUrl: 'http://pii.test' as string | undefined,
}))

vi.mock('@/lib/core/config/env', () => ({
  env: {
    get PII_URL(): string | undefined {
      return mocks.piiUrl
    },
  },
}))

interface Span {
  entity_type: string
  start: number
  end: number
  score: number
}

function applyReplace(text: string, results: Span[]): string {
  let out = text
  for (const span of [...results].sort((a, b) => b.start - a.start)) {
    out = `${out.slice(0, span.start)}<${span.entity_type}>${out.slice(span.end)}`
  }
  return out
}

function emailSpans(text: string, entities: string[] | undefined): Span[] {
  if (entities && !entities.includes('EMAIL_ADDRESS')) return []
  const index = text.indexOf('a@b.com')
  return index === -1
    ? []
    : [{ entity_type: 'EMAIL_ADDRESS', start: index, end: index + 7, score: 0.9 }]
}

describe('validate_pii', () => {
  let analyzeBodies: Array<{ text: string; language: string; entities?: string[] }>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.piiUrl = 'http://pii.test'
    analyzeBodies = []
    fetchMock = vi.fn(async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body)
      if (url.includes('/analyze')) {
        analyzeBodies.push({ text: body.text, language: body.language, entities: body.entities })
        return new Response(JSON.stringify(emailSpans(body.text, body.entities)), { status: 200 })
      }
      return new Response(
        JSON.stringify({ text: applyReplace(body.text, body.analyzer_results) }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  describe('maskPIIBatch', () => {
    it('masks detected entities while preserving input order', async () => {
      await expect(maskPIIBatch(['email a@b.com', 'nothing here'], [])).resolves.toEqual([
        'email <EMAIL_ADDRESS>',
        'nothing here',
      ])
    })

    it('forwards entity types and language to the analyzer', async () => {
      await maskPIIBatch(['mail a@b.com'], ['EMAIL_ADDRESS', 'PERSON'], 'es')
      expect(analyzeBodies[0].entities).toEqual(['EMAIL_ADDRESS', 'PERSON'])
      expect(analyzeBodies[0].language).toBe('es')
    })

    it('returns an empty result without requiring the sidecar', async () => {
      mocks.piiUrl = undefined
      await expect(maskPIIBatch([], [])).resolves.toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('throws on a configured sidecar failure so the caller can scrub', async () => {
      fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }))
      await expect(maskPIIBatch(['email a@b.com'], [])).rejects.toThrow(/Presidio analyze failed/)
    })
  })

  describe('validatePII', () => {
    it('block mode fails with a summary when PII is detected', async () => {
      const result = await validatePII({
        text: 'reach me at a@b.com',
        entityTypes: [],
        mode: 'block',
        requestId: 'r1',
      })
      expect(result.passed).toBe(false)
      expect(result.error).toContain('EMAIL_ADDRESS')
      expect(result.detectedEntities).toHaveLength(1)
    })

    it('mask mode returns masked text', async () => {
      const result = await validatePII({
        text: 'mail a@b.com',
        entityTypes: [],
        mode: 'mask',
        requestId: 'r2',
      })
      expect(result.passed).toBe(true)
      expect(result.maskedText).toBe('mail <EMAIL_ADDRESS>')
    })

    it('passes clean text when the optional sidecar is configured', async () => {
      const result = await validatePII({
        text: 'nothing to see',
        entityTypes: [],
        mode: 'block',
        requestId: 'r3',
      })
      expect(result.passed).toBe(true)
      expect(result.detectedEntities).toHaveLength(0)
    })
  })

  describe('disabled by default', () => {
    beforeEach(() => {
      mocks.piiUrl = undefined
    })

    it('returns a clear disabled result for PII-configured workflows', async () => {
      const result = await validatePII({
        text: 'mail a@b.com',
        entityTypes: [],
        mode: 'block',
        requestId: 'disabled-r1',
      })

      expect(result).toEqual({
        passed: false,
        error:
          'PII feature is disabled. Configure PII_URL to enable optional PII validation and masking.',
        detectedEntities: [],
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns a clear disabled error for masking', async () => {
      await expect(maskPIIBatch(['secret'], [])).rejects.toThrow('PII feature is disabled')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
