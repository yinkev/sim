import { createHash } from 'node:crypto'

export * from '@sim/mothership-contracts'

export function fingerprintSecret(secret: string | null | undefined): string | null {
  const normalized = normalizeSecret(secret)
  if (!normalized) return null
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

function normalizeSecret(secret: string | null | undefined): string | null {
  const normalized = secret?.trim()
  return normalized ? normalized : null
}
