'use client'

import type { ReactNode } from 'react'
import disabledPostHog from '@/lib/posthog/dev-disabled'

interface PostHogProviderProps {
  children: ReactNode
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  return <>{children}</>
}

export function usePostHog() {
  return disabledPostHog
}
