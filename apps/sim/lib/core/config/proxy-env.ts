type ProxyEnvValue = string | boolean | number | undefined

/** Matches the application env truthy coercion without loading the full env schema. */
export const isTruthy = (value: ProxyEnvValue): boolean =>
  typeof value === 'string' ? value.toLowerCase() === 'true' || value === '1' : Boolean(value)

/** Returns whether the configured app URL belongs to the hosted Sim deployment. */
export function isHostedAppUrl(appUrl: string | undefined): boolean {
  let hostname = ''
  try {
    hostname = appUrl ? new URL(appUrl).hostname : ''
  } catch {
    return false
  }
  return hostname === 'sim.ai' || hostname.endsWith('.sim.ai')
}

/** Authentication bypass is allowed only for self-hosted deployments. */
export function isProxyAuthDisabled(
  disableAuth: ProxyEnvValue,
  appUrl: string | undefined
): boolean {
  return isTruthy(disableAuth) && !isHostedAppUrl(appUrl)
}

export const proxyAppUrl = process.env.NEXT_PUBLIC_APP_URL
export const isHosted = isHostedAppUrl(proxyAppUrl)
export const isAuthDisabled = isProxyAuthDisabled(process.env.DISABLE_AUTH, proxyAppUrl)
