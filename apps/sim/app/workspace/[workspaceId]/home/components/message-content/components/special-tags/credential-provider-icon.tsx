'use client'

import { createElement, type ReactNode } from 'react'
import { OAUTH_PROVIDERS } from '@/lib/oauth/oauth'

interface CredentialProviderIconProps {
  provider: string
  className?: string
  fallback: ReactNode
}

function getCredentialIcon(provider: string) {
  const lower = provider.toLowerCase()

  const directMatch = OAUTH_PROVIDERS[lower]
  if (directMatch) return directMatch.icon

  for (const config of Object.values(OAUTH_PROVIDERS)) {
    if (config.name.toLowerCase() === lower) return config.icon
    for (const service of Object.values(config.services)) {
      if (service.name.toLowerCase() === lower) return service.icon
      if (service.providerId.toLowerCase() === lower) return service.icon
    }
  }

  return null
}

export function CredentialProviderIcon({
  provider,
  className,
  fallback,
}: CredentialProviderIconProps) {
  const Icon = getCredentialIcon(provider)

  return Icon ? createElement(Icon, { className }) : fallback
}
