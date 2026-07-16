import path from 'node:path'
import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'
import {
  EMCN_ICON_MODULAR_IMPORTS,
  EMCN_MODULAR_IMPORTS,
} from './lib/build-config/emcn-modular-imports'
import { env, isTruthy } from './lib/core/config/env'
import { isAuthDisabled, isDev, isHosted } from './lib/core/config/env-flags'
import {
  getChatEmbedCSPPolicy,
  getMainCSPPolicy,
  getWorkflowExecutionCSPPolicy,
} from './lib/core/security/csp'

const repoRoot = path.resolve(process.cwd(), '../..')
const isPostHogDisabled = !isTruthy(env.NEXT_PUBLIC_POSTHOG_ENABLED) || !env.NEXT_PUBLIC_POSTHOG_KEY
const isTelemetryDisabled = env.NEXT_TELEMETRY_DISABLED?.trim() === '1'
const areRootOptionalScriptsDisabled =
  !isHosted && (!isDev || (!isTruthy(env.REACT_GRAB_ENABLED) && !isTruthy(env.REACT_SCAN_ENABLED)))

const createNextConfig = (phase: string): NextConfig => ({
  turbopack: {
    root: repoRoot,
    ...(phase === PHASE_DEVELOPMENT_SERVER &&
      (isAuthDisabled ||
        isPostHogDisabled ||
        isTelemetryDisabled ||
        areRootOptionalScriptsDisabled ||
        !isHosted) && {
        resolveAlias: {
          ...(isTelemetryDisabled && {
            '@/instrumentation-client': '@/instrumentation-disabled',
            '@/instrumentation-edge': '@/instrumentation-disabled',
            '@/instrumentation-node': '@/instrumentation-disabled',
          }),
          ...(areRootOptionalScriptsDisabled && {
            '@/app/_shell/root-optional-scripts': '@/app/_shell/root-optional-scripts-disabled',
          }),
          ...(isAuthDisabled && {
            'better-auth/cookies': '@/lib/auth/better-auth-cookies-disabled',
            '@/app/_shell/providers/session-provider':
              '@/app/_shell/providers/session-provider-anonymous',
            '@/app/workspace/[workspaceId]/components/impersonation-banner':
              '@/app/workspace/[workspaceId]/components/impersonation-banner/impersonation-banner-disabled',
            '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider':
              '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider-anonymous',
            '@/ee/whitelabeling/components/branding-provider':
              '@/ee/whitelabeling/components/branding-provider-disabled',
            '@/ee/whitelabeling/org-branding': '@/ee/whitelabeling/org-branding-disabled',
            '@/ee/access-control/hooks/use-user-permission-config':
              '@/ee/access-control/hooks/use-user-permission-config-disabled',
            '@/lib/auth/page-session': '@/lib/auth/page-session-anonymous',
            '@/lib/auth/server-session': '@/lib/auth/server-session-anonymous',
          }),
          ...(!isHosted && {
            '@/lib/analytics/profound': '@/lib/analytics/profound-disabled',
          }),
          ...(isPostHogDisabled && {
            '@/app/_shell/providers/posthog-provider':
              '@/app/_shell/providers/posthog-provider-disabled',
            'posthog-js/react': '@/lib/posthog/dev-disabled-react',
            'posthog-js': '@/lib/posthog/dev-disabled',
          }),
        },
      }),
  },
  modularizeImports: {
    '@/components/emcn': {
      transform: EMCN_MODULAR_IMPORTS,
      skipDefaultConversion: true,
    },
    '@/components/emcn/icons': {
      transform: EMCN_ICON_MODULAR_IMPORTS,
      skipDefaultConversion: true,
    },
  },
  devIndicators: false,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'api.stability.ai',
      },
      // Azure Blob Storage
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
      },
      // AWS S3
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // Brand logo domain if configured
      ...(process.env.NEXT_PUBLIC_BRAND_LOGO_URL
        ? (() => {
            try {
              return [
                {
                  protocol: 'https' as const,
                  hostname: new URL(process.env.NEXT_PUBLIC_BRAND_LOGO_URL!).hostname,
                },
              ]
            } catch {
              return []
            }
          })()
        : []),
      // Brand favicon domain if configured
      ...(process.env.NEXT_PUBLIC_BRAND_FAVICON_URL
        ? (() => {
            try {
              return [
                {
                  protocol: 'https' as const,
                  hostname: new URL(process.env.NEXT_PUBLIC_BRAND_FAVICON_URL!).hostname,
                },
              ]
            } catch {
              return []
            }
          })()
        : []),
    ],
  },
  typescript: {
    ignoreBuildErrors: isTruthy(env.DOCKER_BUILD),
  },
  output: isTruthy(env.DOCKER_BUILD) ? 'standalone' : undefined,
  serverExternalPackages: [
    '@1password/sdk',
    '@opentelemetry/api',
    'unpdf',
    'ffmpeg-static',
    'fluent-ffmpeg',
    'ws',
    'isolated-vm',
    '@e2b/code-interpreter',
    'e2b',
    '@earendil-works/pi-coding-agent',
  ],
  outputFileTracingIncludes: {
    '/api/tools/stagehand/*': ['./node_modules/ws/**/*'],
    '/*': [
      './node_modules/sharp/**/*',
      './node_modules/@img/**/*',
      './lib/execution/sandbox/bundles/*.cjs',
    ],
  },
  experimental: {
    // Next 16 enables Turbopack's dev filesystem cache by default. On this app's
    // large workspace graph it expands to multiple GiB and spends minutes compacting.
    turbopackFileSystemCacheForDev: false,
    // Bound Turbopack's native task graph; NODE_OPTIONS only limits the V8 heap.
    turbopackMemoryLimit: 6 * 1024 * 1024 * 1024,
    optimizeCss: true,
    preloadEntriesOnStart: false,
    optimizePackageImports: [
      'lodash',
      'framer-motion',
      'reactflow',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-accordion',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-slider',
      'streamdown',
      'zod',
      // Heavy barrels used across the client graph — transform-only the
      // imported symbols instead of evaluating the full barrel on compile.
      'lucide-react',
      'date-fns',
      'es-toolkit',
      '@tanstack/react-query',
    ],
  },
  ...(isDev && {
    allowedDevOrigins: [
      ...(env.NEXT_PUBLIC_APP_URL
        ? (() => {
            try {
              return [new URL(env.NEXT_PUBLIC_APP_URL).host]
            } catch {
              return []
            }
          })()
        : []),
      'localhost:6888',
      'localhost:3001',
    ],
  }),
  transpilePackages: ['@t3-oss/env-nextjs', '@t3-oss/env-core', '@sim/db'],
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/.well-known/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Accept' },
        ],
      },
      // /api/* CORS is set at runtime in proxy.ts (resolveApiCorsPolicy).
      {
        source: '/api/workflows/:id/execute',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' },
          {
            key: 'Content-Security-Policy',
            value: getWorkflowExecutionCSPPolicy(),
          },
        ],
      },
      {
        // Exclude Vercel internal resources and static assets from strict COEP, Google Drive Picker to prevent 'refused to connect' issue
        source: '/((?!_next|_vercel|api|favicon.ico|w/.*|workspace/.*|api/tools/drive).*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      {
        // For main app routes, Google Drive Picker, and Vercel resources - use permissive policies
        source: '/(w/.*|workspace/.*|api/tools/drive|_next/.*|_vercel/.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
      // Block access to sourcemap files (defense in depth)
      {
        source: '/(.*)\\.map$',
        headers: [
          {
            key: 'x-robots-tag',
            value: 'noindex',
          },
        ],
      },
      // Chat pages - allow iframe embedding from any origin
      {
        source: '/chat/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // No X-Frame-Options to allow iframe embedding
          {
            key: 'Content-Security-Policy',
            value: getChatEmbedCSPPolicy(),
          },
          // Permissive CORS for chat requests from embedded chats
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' },
        ],
      },
      // Apply security headers to routes not handled by middleware runtime CSP
      // Middleware handles: /, /login, /signup, /workspace/*
      // Exclude chat routes which have their own permissive embed headers
      {
        source: '/((?!workspace|chat|login|signup|$).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: getMainCSPPolicy(),
          },
        ],
      },
    ]
  },
  async redirects() {
    const redirects = []

    // Social link redirects (used in emails to avoid spam filter issues)
    redirects.push(
      {
        source: '/discord',
        destination: 'https://discord.gg/Hr4UWYEcTT',
        permanent: false,
      },
      {
        source: '/x',
        destination: 'https://x.com/simdotai',
        permanent: false,
      },
      {
        source: '/github',
        destination: 'https://github.com/simstudioai/sim',
        permanent: false,
      },
      {
        source: '/team',
        destination: 'https://cal.com/emirkarabeg/sim-team',
        permanent: false,
      },
      {
        source: '/careers',
        destination: 'https://jobs.ashbyhq.com/sim',
        permanent: true,
      }
    )

    // Redirect /building and /studio to /blog (legacy URL support)
    redirects.push(
      {
        source: '/building/:path*',
        destination: 'https://www.sim.ai/blog/:path*',
        permanent: true,
      },
      {
        source: '/studio/:path*',
        destination: 'https://www.sim.ai/blog/:path*',
        permanent: true,
      }
    )

    // Move root feeds to blog namespace
    redirects.push(
      {
        source: '/rss.xml',
        destination: '/blog/rss.xml',
        permanent: true,
      },
      {
        source: '/sitemap-images.xml',
        destination: '/blog/sitemap-images.xml',
        permanent: true,
      }
    )

    // Legacy chat URL support: the workspace chat route was renamed from
    // `/workspace/:workspaceId/task/:chatId` to `/workspace/:workspaceId/chat/:chatId`.
    // Preserve existing bookmarks and deeplinks.
    redirects.push({
      source: '/workspace/:workspaceId/task/:chatId',
      destination: '/workspace/:workspaceId/chat/:chatId',
      permanent: true,
    })

    // Legacy integration slug: the incident.io block's display name was fixed
    // from `incidentio` to `incident.io`, which moved its catalog slug.
    // Preserve the previously indexed landing URL.
    redirects.push({
      source: '/integrations/incidentio',
      destination: '/integrations/incident-io',
      permanent: true,
    })

    return redirects
  },
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/icon.svg',
      },
      {
        source: '/r/:shortCode',
        destination: 'https://go.trybeluga.ai/:shortCode',
      },
    ]
  },
})

export default createNextConfig
