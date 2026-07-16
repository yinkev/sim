export const DEFAULT_SOCKET_URL = 'http://localhost:6887'
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

export interface CSPDirectives {
  'default-src'?: string[]
  'script-src'?: string[]
  'style-src'?: string[]
  'img-src'?: string[]
  'media-src'?: string[]
  'font-src'?: string[]
  'connect-src'?: string[]
  'worker-src'?: string[]
  'frame-src'?: string[]
  'frame-ancestors'?: string[]
  'form-action'?: string[]
  'base-uri'?: string[]
  'object-src'?: string[]
}

interface CSPSourceFlags {
  isDev: boolean
  isHosted: boolean
  isReactGrabEnabled: boolean
}

export const STATIC_IMG_SRC = ["'self'", 'data:', 'blob:', 'https:'] as const

export function getStaticScriptSrc({
  isDev,
  isHosted,
  isReactGrabEnabled,
}: CSPSourceFlags): string[] {
  return [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    'https://*.google.com',
    'https://apis.google.com',
    'https://challenges.cloudflare.com',
    ...(isReactGrabEnabled ? ['https://unpkg.com'] : []),
    ...(isHosted
      ? [
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://analytics.ahrefs.com',
        ]
      : []),
  ]
}

export function getStaticConnectSrc({
  isDev,
  isHosted,
  isReactGrabEnabled,
}: CSPSourceFlags): string[] {
  return [
    "'self'",
    'https://api.browser-use.com',
    'https://api.elevenlabs.io',
    'wss://api.elevenlabs.io',
    'https://api.exa.ai',
    'https://api.firecrawl.dev',
    'https://*.googleapis.com',
    'https://*.amazonaws.com',
    'https://*.s3.amazonaws.com',
    'https://*.blob.core.windows.net',
    'https://*.atlassian.com',
    'https://*.supabase.co',
    'https://api.github.com',
    'https://github.com/*',
    'https://challenges.cloudflare.com',
    ...(isReactGrabEnabled ? ['https://www.react-grab.com'] : []),
    ...(isDev ? ['ws://localhost:4722'] : []),
    ...(isHosted
      ? [
          'https://www.googletagmanager.com',
          'https://*.google-analytics.com',
          'https://*.analytics.google.com',
          'https://analytics.google.com',
          'https://www.google.com',
          'https://analytics.ahrefs.com',
          'https://*.g.doubleclick.net',
        ]
      : []),
  ]
}

export function getStaticFrameSrc({ isHosted }: CSPSourceFlags): string[] {
  return [
    "'self'",
    'blob:',
    'https://challenges.cloudflare.com',
    'https://drive.google.com',
    'https://docs.google.com',
    'https://*.google.com',
    'https://www.youtube.com',
    'https://player.vimeo.com',
    'https://www.dailymotion.com',
    'https://player.twitch.tv',
    'https://clips.twitch.tv',
    'https://streamable.com',
    'https://fast.wistia.net',
    'https://www.tiktok.com',
    'https://w.soundcloud.com',
    'https://open.spotify.com',
    'https://embed.music.apple.com',
    'https://www.loom.com',
    'https://www.facebook.com',
    'https://www.instagram.com',
    'https://platform.twitter.com',
    'https://rumble.com',
    'https://play.vidyard.com',
    'https://iframe.cloudflarestream.com',
    'https://www.mixcloud.com',
    'https://tenor.com',
    'https://giphy.com',
    ...(isHosted ? ['https://www.googletagmanager.com'] : []),
  ]
}

export function toWebSocketUrl(httpUrl: string): string {
  return httpUrl.replace('http://', 'ws://').replace('https://', 'wss://')
}

export function getHostnameFromUrl(url: string | undefined): string[] {
  if (!url) return []
  try {
    return [`https://${new URL(url).hostname}`]
  } catch {
    return []
  }
}

/** Builds a CSP header value from directive sources. */
export function buildCSPString(directives: CSPDirectives): string {
  return Object.entries(directives)
    .map(([directive, sources]) => {
      if (!sources || sources.length === 0) return ''
      const validSources = sources.filter((source: string) => source && source.trim() !== '')
      if (validSources.length === 0) return ''
      return `${directive} ${validSources.join(' ')}`
    })
    .filter(Boolean)
    .join('; ')
}
