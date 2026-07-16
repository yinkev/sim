/**
 * Reads runtime public env in both client and server contexts.
 * Client values come from `window.__ENV` populated by `<PublicEnvScript>`,
 * with the bundled `process.env` value as a fallback.
 */
export function getEnv(variable: string): string | undefined {
  if (typeof window === 'undefined') return process.env[variable]
  const runtimeWindow = window as typeof window & {
    __ENV?: Record<string, string | undefined>
  }
  return runtimeWindow.__ENV?.[variable] ?? process.env[variable]
}

/** Coerces string-backed env flags without treating `"false"` as enabled. */
export function isTruthy(value: string | boolean | number | undefined): boolean {
  return typeof value === 'string'
    ? value.toLowerCase() === 'true' || value === '1'
    : Boolean(value)
}
