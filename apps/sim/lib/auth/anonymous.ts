import { createLogger } from '@sim/logger'
import { generateId } from '@sim/utils/id'
import postgres from 'postgres'
import { ANONYMOUS_USER, ANONYMOUS_USER_ID } from '@/lib/auth/constants'

export type { AnonymousSession } from '@/lib/auth/anonymous-session'
export { createAnonymousSession } from '@/lib/auth/anonymous-session'

const logger = createLogger('AnonymousAuth')

let anonymousUserEnsured = false
let anonymousUserEnsurePromise: Promise<void> | null = null

async function bootstrapAnonymousUser(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('Missing DATABASE_URL environment variable')

  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 1,
    connect_timeout: 30,
    onnotice: () => {},
  })

  try {
    await sql.begin(async (transaction) => {
      const now = new Date()
      const insertedUsers = await transaction`
        INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
        VALUES (
          ${ANONYMOUS_USER.id},
          ${ANONYMOUS_USER.name},
          ${ANONYMOUS_USER.email},
          ${ANONYMOUS_USER.emailVerified},
          ${ANONYMOUS_USER.image},
          ${now},
          ${now}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `
      if (insertedUsers.length > 0) {
        logger.info('Created anonymous user for DISABLE_AUTH mode')
      }

      const insertedStats = await transaction`
        INSERT INTO user_stats (id, user_id, current_usage_limit)
        VALUES (${generateId()}, ${ANONYMOUS_USER_ID}, ${'10000000000'})
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id
      `
      if (insertedStats.length > 0) {
        logger.info('Created anonymous user stats for DISABLE_AUTH mode')
      }
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/**
 * Ensures the anonymous user and their stats record exist in the database.
 * Called when DISABLE_AUTH is enabled to ensure DB operations work.
 */
export async function ensureAnonymousUserExists(): Promise<void> {
  if (anonymousUserEnsured) return
  anonymousUserEnsurePromise ??= bootstrapAnonymousUser()
  try {
    await anonymousUserEnsurePromise
    anonymousUserEnsured = true
  } catch (error) {
    anonymousUserEnsurePromise = null
    logger.error('Failed to ensure anonymous user exists', { error })
    throw error
  }
}
