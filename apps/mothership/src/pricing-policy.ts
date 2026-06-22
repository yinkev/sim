export interface ProviderTokenUsage {
  cached_input_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  input_tokens?: number
  output_tokens?: number
}

export interface ProviderTokenCost {
  input: number
  output: number
  total: number
}

interface ProviderTokenPricing {
  cachedInput?: number
  cacheWriteInput?: number
  input: number
  longContext?: LongContextPricing
  output: number
}

interface PricingSource {
  label: string
  url: string
}

interface LongContextPricing {
  inputMultiplier: number
  inputTokenThreshold: number
  outputMultiplier: number
}

interface PricingPolicy {
  reviewedAt: string
  sources: readonly PricingSource[]
  staleAfter: string
}

export interface PricingPolicyStatus {
  isFresh: boolean
  reviewedAt: string
  sources: readonly PricingSource[]
  staleAfter: string
}

const MILLION_TOKENS = 1_000_000
const GPT_5_4_AND_5_5_LONG_CONTEXT_THRESHOLD = 272_000
const OPENAI_LONG_CONTEXT_PRICING: LongContextPricing = {
  inputMultiplier: 2,
  inputTokenThreshold: GPT_5_4_AND_5_5_LONG_CONTEXT_THRESHOLD,
  outputMultiplier: 1.5,
}

export const PROVIDER_PRICING_POLICY: PricingPolicy = {
  reviewedAt: '2026-06-21',
  staleAfter: '2026-07-21',
  sources: [
    {
      label: 'OpenAI API pricing',
      url: 'https://developers.openai.com/api/docs/pricing',
    },
    {
      label: 'Anthropic Claude API pricing',
      url: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
    },
  ],
} as const

const ANTHROPIC_PRICING: Record<string, ProviderTokenPricing> = {
  'claude-opus-4-8': { input: 5.0, cacheWriteInput: 6.25, cachedInput: 0.5, output: 25.0 },
  'claude-opus-4-7': { input: 5.0, cacheWriteInput: 6.25, cachedInput: 0.5, output: 25.0 },
  'claude-opus-4-6': { input: 5.0, cacheWriteInput: 6.25, cachedInput: 0.5, output: 25.0 },
  'claude-opus-4-5': { input: 5.0, cacheWriteInput: 6.25, cachedInput: 0.5, output: 25.0 },
  'claude-opus-4-1': { input: 15.0, cacheWriteInput: 18.75, cachedInput: 1.5, output: 75.0 },
  'claude-opus-4-0': { input: 15.0, cacheWriteInput: 18.75, cachedInput: 1.5, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, cacheWriteInput: 3.75, cachedInput: 0.3, output: 15.0 },
  'claude-sonnet-4-5': { input: 3.0, cacheWriteInput: 3.75, cachedInput: 0.3, output: 15.0 },
  'claude-sonnet-4-0': { input: 3.0, cacheWriteInput: 3.75, cachedInput: 0.3, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, cacheWriteInput: 1.25, cachedInput: 0.1, output: 5.0 },
  'claude-3-haiku-20240307': {
    input: 0.25,
    cacheWriteInput: 0.3,
    cachedInput: 0.03,
    output: 1.25,
  },
} as const

const OPENAI_PRICING: Record<string, ProviderTokenPricing> = {
  'gpt-4.1': { input: 2.0, cachedInput: 0.5, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, cachedInput: 0.1, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, cachedInput: 0.025, output: 0.4 },
  'gpt-5.5-pro': {
    input: 30.0,
    output: 180.0,
  },
  'gpt-5.5': {
    input: 5.0,
    cachedInput: 0.5,
    output: 30.0,
    longContext: OPENAI_LONG_CONTEXT_PRICING,
  },
  'gpt-5.4-pro': {
    input: 30.0,
    output: 180.0,
    longContext: OPENAI_LONG_CONTEXT_PRICING,
  },
  'gpt-5.4': {
    input: 2.5,
    cachedInput: 0.25,
    output: 15.0,
    longContext: OPENAI_LONG_CONTEXT_PRICING,
  },
  'gpt-5.4-mini': { input: 0.75, cachedInput: 0.075, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, cachedInput: 0.02, output: 1.25 },
  'gpt-5.2-pro': { input: 21.0, output: 168.0 },
  'gpt-5.2': { input: 1.75, cachedInput: 0.175, output: 14.0 },
  'gpt-5.1': { input: 1.25, cachedInput: 0.125, output: 10.0 },
  'gpt-5-pro': { input: 15.0, output: 120.0 },
  'gpt-5': { input: 1.25, cachedInput: 0.125, output: 10.0 },
  'gpt-5-mini': { input: 0.25, cachedInput: 0.025, output: 2.0 },
  'gpt-5-nano': { input: 0.05, cachedInput: 0.005, output: 0.4 },
  'gpt-5-chat-latest': { input: 1.25, cachedInput: 0.125, output: 10.0 },
  'o4-mini': { input: 1.1, cachedInput: 0.275, output: 4.4 },
  'o3-pro': { input: 20.0, output: 80.0 },
  o3: { input: 2.0, cachedInput: 0.5, output: 8.0 },
  'o3-mini': { input: 1.1, cachedInput: 0.55, output: 4.4 },
  o1: { input: 15.0, cachedInput: 7.5, output: 60.0 },
  'gpt-4o': { input: 2.5, cachedInput: 1.25, output: 10.0 },
} as const

export function getPricingPolicyStatus(now = new Date()): PricingPolicyStatus {
  return {
    ...PROVIDER_PRICING_POLICY,
    isFresh: now.getTime() < Date.parse(PROVIDER_PRICING_POLICY.staleAfter),
  }
}

export function assertPricingPolicyFresh(now = new Date()): void {
  const status = getPricingPolicyStatus(now)
  if (!status.isFresh) {
    throw new Error(
      `Mothership provider pricing policy is stale; review provider pricing sources and update staleAfter ${status.staleAfter}`
    )
  }
}

export function normalizeOpenAIModel(model: string): string {
  return model.toLowerCase().startsWith('openai/') ? model.slice('openai/'.length) : model
}

export function resolveAnthropicPricing(model: string): ProviderTokenPricing | undefined {
  const normalizedModel = model.toLowerCase()
  for (const [modelId, pricing] of Object.entries(ANTHROPIC_PRICING)) {
    if (matchesPricedModelId(normalizedModel, modelId)) {
      return pricing
    }
  }
  return undefined
}

export function resolveOpenAIPricing(model: string): ProviderTokenPricing | undefined {
  const normalizedModel = normalizeOpenAIModel(model).toLowerCase()
  const exactMatch = OPENAI_PRICING[normalizedModel]
  if (exactMatch) return exactMatch

  return Object.entries(OPENAI_PRICING)
    .sort(([left], [right]) => right.length - left.length)
    .find(([modelId]) => matchesPricedModelId(normalizedModel, modelId))?.[1]
}

export function calculateAnthropicCost(
  model: string,
  usage: ProviderTokenUsage
): ProviderTokenCost {
  const pricing = resolveAnthropicPricing(model)
  if (!pricing) {
    throw new Error(`Mothership billing pricing is not configured for Anthropic model ${model}`)
  }

  const input = costForTokens(usage.input_tokens ?? 0, pricing.input)
  const cacheWrite = costForTokens(usage.cache_creation_input_tokens ?? 0, pricing.cacheWriteInput)
  const cacheRead = costForTokens(
    usage.cache_read_input_tokens ?? usage.cached_input_tokens ?? 0,
    pricing.cachedInput
  )
  const output = costForTokens(usage.output_tokens ?? 0, pricing.output)

  return totalCost(input + cacheWrite + cacheRead, output)
}

export function calculateOpenAICost(model: string, usage: ProviderTokenUsage): ProviderTokenCost {
  const basePricing = resolveOpenAIPricing(model)
  if (!basePricing) {
    throw new Error(`Mothership billing pricing is not configured for OpenAI model ${model}`)
  }

  const inputTokens = usage.input_tokens ?? 0
  const pricing = effectiveOpenAIPricing(basePricing, inputTokens)
  const cachedInputTokens = Math.min(usage.cached_input_tokens ?? 0, inputTokens)
  const billableInputTokens = inputTokens - cachedInputTokens
  const input =
    costForTokens(billableInputTokens, pricing.input) +
    costForTokens(cachedInputTokens, pricing.cachedInput ?? pricing.input)
  const output = costForTokens(usage.output_tokens ?? 0, pricing.output)

  return totalCost(input, output)
}

function effectiveOpenAIPricing(
  pricing: ProviderTokenPricing,
  inputTokens: number
): ProviderTokenPricing {
  const longContext = pricing.longContext
  if (!longContext || inputTokens <= longContext.inputTokenThreshold) return pricing

  return {
    ...pricing,
    cachedInput:
      pricing.cachedInput === undefined
        ? undefined
        : pricing.cachedInput * longContext.inputMultiplier,
    input: pricing.input * longContext.inputMultiplier,
    output: pricing.output * longContext.outputMultiplier,
  }
}

function matchesPricedModelId(model: string, pricedModelId: string): boolean {
  if (model === pricedModelId) return true
  if (!model.startsWith(`${pricedModelId}-`)) return false

  const suffix = model.slice(pricedModelId.length + 1)
  return /^\d{8}$/.test(suffix) || /^\d{4}-\d{2}-\d{2}$/.test(suffix)
}

function costForTokens(tokens: number, rate: number | undefined): number {
  return Number.parseFloat((((tokens ?? 0) * (rate ?? 0)) / MILLION_TOKENS).toFixed(8))
}

function totalCost(input: number, output: number): ProviderTokenCost {
  const roundedInput = Number.parseFloat(input.toFixed(8))
  const roundedOutput = Number.parseFloat(output.toFixed(8))
  return {
    input: roundedInput,
    output: roundedOutput,
    total: Number.parseFloat((roundedInput + roundedOutput).toFixed(8)),
  }
}
