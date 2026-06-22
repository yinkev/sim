import { describe, expect, it } from 'vitest'
import {
  assertPricingPolicyFresh,
  calculateAnthropicCost,
  calculateOpenAICost,
  getPricingPolicyStatus,
  normalizeOpenAIModel,
  PROVIDER_PRICING_POLICY,
  resolveAnthropicPricing,
  resolveOpenAIPricing,
} from '@/pricing-policy'

describe('Mothership provider pricing policy', () => {
  it('exposes auditable provider pricing source metadata', () => {
    expect(PROVIDER_PRICING_POLICY.reviewedAt).toBe('2026-06-21')
    expect(PROVIDER_PRICING_POLICY.sources).toEqual([
      {
        label: 'OpenAI API pricing',
        url: 'https://developers.openai.com/api/docs/pricing',
      },
      {
        label: 'Anthropic Claude API pricing',
        url: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
      },
    ])

    for (const source of PROVIDER_PRICING_POLICY.sources) {
      expect(source.label.length).toBeGreaterThan(0)
      expect(new URL(source.url).protocol).toBe('https:')
    }
  })

  it('reports policy freshness for CI and readiness checks', () => {
    expect(getPricingPolicyStatus(new Date('2026-07-20T23:59:59Z')).isFresh).toBe(true)
    expect(getPricingPolicyStatus(new Date('2026-07-21T00:00:00Z')).isFresh).toBe(false)
    expect(() => assertPricingPolicyFresh(new Date('2026-07-21T00:00:00Z'))).toThrow(
      'Mothership provider pricing policy is stale'
    )

    expect(calculateOpenAICost('gpt-4.1', { input_tokens: 3, output_tokens: 4 })).toEqual({
      input: 0.000006,
      output: 0.000032,
      total: 0.000038,
    })
  })

  it('resolves Anthropic model families and cache pricing', () => {
    expect(resolveAnthropicPricing('claude-sonnet-4-6-20260101')).toEqual(
      expect.objectContaining({ input: 3, cachedInput: 0.3, cacheWriteInput: 3.75, output: 15 })
    )
    expect(resolveAnthropicPricing('claude-opus-4-8-fast')).toBeUndefined()

    expect(
      calculateAnthropicCost('claude-opus-4-8', {
        input_tokens: 10_000,
        cache_creation_input_tokens: 40_000,
        cache_read_input_tokens: 50_000,
        output_tokens: 15_000,
      })
    ).toEqual({
      input: 0.325,
      output: 0.375,
      total: 0.7,
    })
  })

  it('keeps existing Anthropic and OpenAI standard cost expectations', () => {
    expect(
      calculateAnthropicCost('claude-opus-4-8', { input_tokens: 3, output_tokens: 4 })
    ).toEqual({
      input: 0.000015,
      output: 0.0001,
      total: 0.000115,
    })
    expect(calculateOpenAICost('gpt-4.1', { input_tokens: 3, output_tokens: 4 })).toEqual({
      input: 0.000006,
      output: 0.000032,
      total: 0.000038,
    })
  })

  it('applies OpenAI normalization, alias, and cached-input pricing', () => {
    expect(normalizeOpenAIModel('openai/gpt-5.4')).toBe('gpt-5.4')
    expect(resolveOpenAIPricing('gpt-5.4-20260201')).toEqual(
      expect.objectContaining({ input: 2.5, cachedInput: 0.25, output: 15 })
    )
    expect(resolveOpenAIPricing('gpt-5.4-premium')).toBeUndefined()

    expect(
      calculateOpenAICost('openai/gpt-5.4', {
        cached_input_tokens: 40,
        input_tokens: 100,
        output_tokens: 10,
      })
    ).toEqual({
      input: 0.00016,
      output: 0.00015,
      total: 0.00031,
    })
  })

  it('applies OpenAI long-context pricing for configured long-context models', () => {
    expect(
      calculateOpenAICost('gpt-5.4', {
        cached_input_tokens: 40_000,
        input_tokens: 300_000,
        output_tokens: 10_000,
      })
    ).toEqual({
      input: 1.32,
      output: 0.225,
      total: 1.545,
    })
  })

  it('fails closed for unknown or unsupported provider pricing cases', () => {
    expect(() => calculateAnthropicCost('claude-unpriced', { input_tokens: 1 })).toThrow(
      'Mothership billing pricing is not configured for Anthropic model claude-unpriced'
    )
    expect(() => calculateOpenAICost('gpt-unpriced', { input_tokens: 1 })).toThrow(
      'Mothership billing pricing is not configured for OpenAI model gpt-unpriced'
    )
    expect(() => calculateOpenAICost('gpt-5.5-pro-premium', { input_tokens: 1 })).toThrow(
      'Mothership billing pricing is not configured for OpenAI model gpt-5.5-pro-premium'
    )
  })
})
