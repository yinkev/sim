const WORKSPACE_ROUTE_PATTERN = /^\/workspace\/[^/]+(?:\/|$)/
const LIGHTWEIGHT_HOME_PATTERN = /^\/workspace\/[^/]+\/home\/?$/

/** Returns whether the pathname belongs to an ID-scoped workspace route. */
export function isWorkspaceRoute(pathname: string | null): boolean {
  return pathname !== null && WORKSPACE_ROUTE_PATTERN.test(pathname)
}

/** Returns whether the pathname is the exact lightweight workspace Home route. */
export function isLightweightWorkspaceHome(pathname: string | null): boolean {
  return pathname !== null && LIGHTWEIGHT_HOME_PATTERN.test(pathname)
}

/** Keeps workspace runtime providers mounted after their first activation. */
export function shouldActivateWorkspaceRuntime(
  wasActivated: boolean,
  pathname: string | null
): boolean {
  return wasActivated || !isLightweightWorkspaceHome(pathname)
}
