import { getEnv, isTruthy } from '@/lib/core/config/public-env'

const appUrl = getEnv('NEXT_PUBLIC_APP_URL')
let appHostname = ''
try {
  appHostname = appUrl ? new URL(appUrl).hostname : ''
} catch {}

/** True for sim.ai and its subdomains. */
export const isHosted = appHostname === 'sim.ai' || appHostname.endsWith('.sim.ai')

/** Disabled auth is allowed only for self-hosted deployments. */
export const isAuthDisabled = isTruthy(process.env.DISABLE_AUTH) && !isHosted

const isDev = process.env.NODE_ENV === 'development'

/** Enables React Grab only in development. */
export const isReactGrabEnabled = isDev && isTruthy(process.env.REACT_GRAB_ENABLED)

/** Enables React Scan only in development. */
export const isReactScanEnabled = isDev && isTruthy(process.env.REACT_SCAN_ENABLED)
