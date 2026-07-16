interface RootOptionalScriptsProps {
  isReactGrabEnabled: boolean
  isReactScanEnabled: boolean
}

interface RootHostedScriptsProps {
  isHosted: boolean
}

/** No-op root scripts for profiles where every optional script is disabled. */
export function RootOptionalScripts(_props: RootOptionalScriptsProps) {
  return null
}

/** No-op analytics scripts for self-hosted profiles. */
export function RootOptionalAnalyticsScripts(_props: RootHostedScriptsProps) {
  return null
}

/** No-op analytics fallback for self-hosted profiles. */
export function RootOptionalBody(_props: RootHostedScriptsProps) {
  return null
}
