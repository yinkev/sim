import { env, getEnv } from '../config/env'
import { isDev, isHosted, isReactGrabEnabled } from '../config/env-flags'
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
} from './csp-core'

export type { CSPDirectives } from './csp-core'
export { buildCSPString } from './csp-core'

/**
 * Content Security Policy (CSP) configuration builder
 *
 * NOTE: This file is loaded by next.config.ts at build time, before @/ path
 * aliases are resolved. Do NOT import from ../utils/urls (which uses @/ imports).
 * Keep all URL constants local to this file.
 */

/**
 * Static CSP sources shared between build-time and runtime.
 * Add new domains here — both paths pick them up automatically.
 */
const sourceFlags = { isDev, isHosted, isReactGrabEnabled }
const STATIC_SCRIPT_SRC = getStaticScriptSrc(sourceFlags)
const STATIC_CONNECT_SRC = getStaticConnectSrc(sourceFlags)
const STATIC_FRAME_SRC = getStaticFrameSrc(sourceFlags)

// Build-time CSP directives (for next.config.ts)
export const buildTimeCSPDirectives: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': [...STATIC_SCRIPT_SRC],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],

  'img-src': [...STATIC_IMG_SRC],

  'media-src': ["'self'", 'blob:'],
  'worker-src': ["'self'", 'blob:'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],

  'connect-src': [
    ...STATIC_CONNECT_SRC,
    env.NEXT_PUBLIC_APP_URL || '',
    ...(env.OLLAMA_URL ? [env.OLLAMA_URL] : isDev ? [DEFAULT_OLLAMA_URL] : []),
    ...(env.NEXT_PUBLIC_SOCKET_URL
      ? [env.NEXT_PUBLIC_SOCKET_URL, toWebSocketUrl(env.NEXT_PUBLIC_SOCKET_URL)]
      : isDev
        ? [DEFAULT_SOCKET_URL, toWebSocketUrl(DEFAULT_SOCKET_URL)]
        : []),
    ...getHostnameFromUrl(env.NEXT_PUBLIC_BRAND_LOGO_URL),
    ...getHostnameFromUrl(env.NEXT_PUBLIC_PRIVACY_URL),
    ...getHostnameFromUrl(env.NEXT_PUBLIC_TERMS_URL),
  ],

  'frame-src': [...STATIC_FRAME_SRC],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
}

/**
 * Generate runtime CSP header with dynamic environment variables.
 * Composes from the same STATIC_* constants as buildTimeCSPDirectives,
 * but resolves env vars at request time via getEnv() to fix Docker
 * deployments where build-time values may be stale placeholders.
 */
export function generateRuntimeCSP(): string {
  const appUrl = getEnv('NEXT_PUBLIC_APP_URL') || ''

  const socketUrl = getEnv('NEXT_PUBLIC_SOCKET_URL') || (isDev ? DEFAULT_SOCKET_URL : '')
  const socketWsUrl = socketUrl ? toWebSocketUrl(socketUrl) : ''
  const ollamaUrl = getEnv('OLLAMA_URL') || (isDev ? DEFAULT_OLLAMA_URL : '')

  const brandLogoDomains = getHostnameFromUrl(getEnv('NEXT_PUBLIC_BRAND_LOGO_URL'))
  const privacyDomains = getHostnameFromUrl(getEnv('NEXT_PUBLIC_PRIVACY_URL'))
  const termsDomains = getHostnameFromUrl(getEnv('NEXT_PUBLIC_TERMS_URL'))

  const runtimeDirectives: CSPDirectives = {
    ...buildTimeCSPDirectives,

    'img-src': [...STATIC_IMG_SRC],

    'connect-src': [
      ...STATIC_CONNECT_SRC,
      appUrl,
      ollamaUrl,
      socketUrl,
      socketWsUrl,
      ...brandLogoDomains,
      ...privacyDomains,
      ...termsDomains,
    ],
  }

  return buildCSPString(runtimeDirectives)
}

/**
 * Get the main CSP policy string (build-time)
 */
export function getMainCSPPolicy(): string {
  return buildCSPString(buildTimeCSPDirectives)
}

/**
 * Permissive CSP for workflow execution endpoints
 */
export function getWorkflowExecutionCSPPolicy(): string {
  return "default-src * 'unsafe-inline' 'unsafe-eval'; connect-src *;"
}

/**
 * CSP for embeddable chat pages.
 * Extends the shared embed policy with Microsoft Office.js sources so the
 * chat page can serve as an Office (Excel/Word/Outlook) add-in surface
 * when loaded with `?embed=office`.
 */
export function getChatEmbedCSPPolicy(): string {
  return buildCSPString({
    ...buildTimeCSPDirectives,
    'script-src': [...STATIC_SCRIPT_SRC, 'https://appsforoffice.microsoft.com'],
    'connect-src': [
      ...(buildTimeCSPDirectives['connect-src'] ?? []),
      'https://appsforoffice.microsoft.com',
    ],
    'frame-ancestors': ['*'],
  })
}

/**
 * Add a source to a specific directive (modifies build-time directives)
 */
export function addCSPSource(directive: keyof CSPDirectives, source: string): void {
  if (!buildTimeCSPDirectives[directive]) {
    buildTimeCSPDirectives[directive] = []
  }
  if (!buildTimeCSPDirectives[directive]!.includes(source)) {
    buildTimeCSPDirectives[directive]!.push(source)
  }
}

/**
 * Remove a source from a specific directive (modifies build-time directives)
 */
export function removeCSPSource(directive: keyof CSPDirectives, source: string): void {
  if (buildTimeCSPDirectives[directive]) {
    buildTimeCSPDirectives[directive] = buildTimeCSPDirectives[directive]!.filter(
      (s: string) => s !== source
    )
  }
}
