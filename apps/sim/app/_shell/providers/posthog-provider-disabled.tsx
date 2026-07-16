import type { ReactNode } from 'react'

/** Dependency-free root boundary when PostHog is disabled. */
export function PostHogProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
