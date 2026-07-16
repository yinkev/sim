import { isHostedAppUrl } from '@/lib/core/config/proxy-env'
import { getEnv, isTruthy } from '@/lib/core/config/public-env'
import {
  buildCSPString,
  type CSPDirectives,
  DEFAULT_OLLAMA_URL,
  DEFAULT_SOCKET_URL,
  getHostnameFromUrl,
  getStaticConnectSrc,
  getStaticFrameSrc,
  getStaticScriptSrc,
  STATIC_IMG_SRC,
  toWebSocketUrl,
} from '@/lib/core/security/csp-core'

/** Generates the request-time CSP without loading validated application env. */
export function generateRuntimeCSP(): string {
  const isDev = process.env.NODE_ENV === 'development'
  const sourceFlags = {
    isDev,
    isHosted: isHostedAppUrl(getEnv('NEXT_PUBLIC_APP_URL')),
    isReactGrabEnabled: isDev && isTruthy(getEnv('REACT_GRAB_ENABLED')),
  }
  const appUrl = getEnv('NEXT_PUBLIC_APP_URL') || ''
  const socketUrl = getEnv('NEXT_PUBLIC_SOCKET_URL') || (isDev ? DEFAULT_SOCKET_URL : '')
  const socketWsUrl = socketUrl ? toWebSocketUrl(socketUrl) : ''
  const ollamaUrl = getEnv('OLLAMA_URL') || (isDev ? DEFAULT_OLLAMA_URL : '')

  const runtimeDirectives: CSPDirectives = {
    'default-src': ["'self'"],
    'script-src': getStaticScriptSrc(sourceFlags),
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': [...STATIC_IMG_SRC],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'connect-src': [
      ...getStaticConnectSrc(sourceFlags),
      appUrl,
      ollamaUrl,
      socketUrl,
      socketWsUrl,
      ...getHostnameFromUrl(getEnv('NEXT_PUBLIC_BRAND_LOGO_URL')),
      ...getHostnameFromUrl(getEnv('NEXT_PUBLIC_PRIVACY_URL')),
      ...getHostnameFromUrl(getEnv('NEXT_PUBLIC_TERMS_URL')),
    ],
    'frame-src': getStaticFrameSrc(sourceFlags),
    'frame-ancestors': ["'self'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  }

  return buildCSPString(runtimeDirectives)
}
