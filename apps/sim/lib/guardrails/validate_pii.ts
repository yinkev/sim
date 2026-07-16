import { createLogger } from '@sim/logger'
import { getErrorMessage } from '@sim/utils/errors'
import { env } from '@/lib/core/config/env'
import { mapWithConcurrency } from '@/lib/core/utils/concurrency'

const logger = createLogger('PIIValidator')

/** Just above the analyzer's spaCy NER budget so a stuck sidecar aborts gracefully. */
const REQUEST_TIMEOUT_MS = 45_000

/** Concurrent per-string sidecar calls within one batch; the warm model handles parallelism. */
const MASK_CONCURRENCY = 8

const PII_FEATURE_DISABLED_ERROR =
  'PII feature is disabled. Configure PII_URL to enable optional PII validation and masking.'

function getPiiUrl(): string | undefined {
  const piiUrl = env.PII_URL?.trim()
  return piiUrl || undefined
}

export interface PIIValidationInput {
  text: string
  entityTypes: string[]
  mode: 'block' | 'mask'
  language?: string
  requestId: string
}

interface DetectedPIIEntity {
  type: string
  start: number
  end: number
  score: number
  text: string
}

export interface PIIValidationResult {
  passed: boolean
  error?: string
  detectedEntities: DetectedPIIEntity[]
  maskedText?: string
}

interface AnalyzerSpan {
  entity_type: string
  start: number
  end: number
  score: number
}

/**
 * Detect PII spans via the optional Presidio analyzer. An empty `entityTypes`
 * detects all supported entity types.
 */
async function analyze(
  piiUrl: string,
  text: string,
  entityTypes: string[],
  language: string
): Promise<AnalyzerSpan[]> {
  const entities = entityTypes.length > 0 ? entityTypes : undefined

  // boundary-raw-fetch: optional internal call to the configured Presidio analyzer
  const response = await fetch(`${piiUrl}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, language, ...(entities ? { entities } : {}) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Presidio analyze failed (${response.status}): ${detail.slice(0, 200)}`)
  }
  return (await response.json()) as AnalyzerSpan[]
}

/** Mask spans via the optional Presidio anonymizer. */
async function anonymize(piiUrl: string, text: string, spans: AnalyzerSpan[]): Promise<string> {
  if (spans.length === 0) return text

  // boundary-raw-fetch: optional internal call to the configured Presidio anonymizer
  const response = await fetch(`${piiUrl}/anonymize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, analyzer_results: spans }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Presidio anonymize failed (${response.status}): ${detail.slice(0, 200)}`)
  }
  const data = (await response.json()) as { text: string }
  return data.text
}

/**
 * Validate text through the optional Presidio sidecar. The feature fails closed
 * with a clear disabled result when `PII_URL` is not configured.
 */
export async function validatePII(input: PIIValidationInput): Promise<PIIValidationResult> {
  const { text, entityTypes, mode, language = 'en', requestId } = input
  const piiUrl = getPiiUrl()

  if (!piiUrl) {
    logger.warn(`[${requestId}] PII validation requested while feature is disabled`)
    return {
      passed: false,
      error: PII_FEATURE_DISABLED_ERROR,
      detectedEntities: [],
    }
  }

  logger.info(`[${requestId}] Starting PII validation`, {
    textLength: text.length,
    entityTypes,
    mode,
    language,
  })

  try {
    const spans = await analyze(piiUrl, text, entityTypes, language)
    const detectedEntities: DetectedPIIEntity[] = spans.map((span) => ({
      type: span.entity_type,
      start: span.start,
      end: span.end,
      score: span.score,
      text: text.slice(span.start, span.end),
    }))

    if (spans.length === 0) {
      logger.info(`[${requestId}] PII validation completed`, { passed: true, detectedCount: 0 })
      return { passed: true, detectedEntities: [], maskedText: mode === 'mask' ? text : undefined }
    }

    if (mode === 'block') {
      const counts = new Map<string, number>()
      for (const entity of detectedEntities) {
        counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1)
      }
      const summary = Array.from(counts.entries())
        .map(([type, count]) => `${count} ${type}`)
        .join(', ')
      logger.info(`[${requestId}] PII validation completed`, {
        passed: false,
        detectedCount: detectedEntities.length,
      })
      return { passed: false, error: `PII detected: ${summary}`, detectedEntities }
    }

    const maskedText = await anonymize(piiUrl, text, spans)
    logger.info(`[${requestId}] PII validation completed`, {
      passed: true,
      detectedCount: detectedEntities.length,
      hasMaskedText: true,
    })
    return { passed: true, detectedEntities, maskedText }
  } catch (error) {
    logger.error(`[${requestId}] PII validation failed`, { error: getErrorMessage(error) })
    return {
      passed: false,
      error: `PII validation failed: ${getErrorMessage(error)}`,
      detectedEntities: [],
    }
  }
}

/**
 * Mask PII across many strings through the optional Presidio sidecar. The
 * feature throws a clear disabled error when `PII_URL` is not configured.
 */
export async function maskPIIBatch(
  texts: string[],
  entityTypes: string[],
  language = 'en'
): Promise<string[]> {
  if (texts.length === 0) return []

  const piiUrl = getPiiUrl()
  if (!piiUrl) throw new Error(PII_FEATURE_DISABLED_ERROR)

  return mapWithConcurrency(texts, MASK_CONCURRENCY, async (text) => {
    if (!text) return text
    const spans = await analyze(piiUrl, text, entityTypes, language)
    return anonymize(piiUrl, text, spans)
  })
}

export { type PIIEntityType, SUPPORTED_PII_ENTITIES } from '@/lib/guardrails/pii-entities'
