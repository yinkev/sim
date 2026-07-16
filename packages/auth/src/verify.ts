import { db } from '@sim/db'
import * as schema from '@sim/db/schema'
import { type Auth, type BetterAuthOptions, betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { oneTimeToken } from 'better-auth/plugins'

export interface VerifyAuthOptions {
  /** Better Auth shared secret. Must match the apps/sim Better Auth secret. */
  secret: string
  /** Public-facing Better Auth URL (usually same as NEXT_PUBLIC_APP_URL). */
  baseURL: string
}

const sharedSessionOptions: NonNullable<BetterAuthOptions['session']> = {
  additionalFields: {
    activeOrganizationId: {
      type: 'string',
      required: false,
      input: false,
    },
  },
}

type VerifyAuthConfig = BetterAuthOptions & {
  plugins: [ReturnType<typeof oneTimeToken>]
}

/**
 * Minimal Better Auth instance for read-only verification of credentials issued
 * by the main app. It shares the Better Auth schema and secret without loading
 * the main app's billing, email, or lifecycle hooks.
 */
export function createVerifyAuth(options: VerifyAuthOptions): Auth<VerifyAuthConfig> {
  const config: VerifyAuthConfig = {
    baseURL: options.baseURL,
    secret: options.secret,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),
    session: sharedSessionOptions,
    plugins: [
      oneTimeToken({
        expiresIn: 24 * 60,
      }),
    ],
  }

  return betterAuth(config)
}

export type VerifyAuth = ReturnType<typeof createVerifyAuth>
