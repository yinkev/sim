import 'server-only'

import { cache } from 'react'
import { createAnonymousSession, ensureAnonymousUserExists } from '@/lib/auth/anonymous'
import { isAuthDisabled } from '@/lib/core/config/env-flags'

async function getServerSessionImpl() {
  if (!isAuthDisabled) {
    throw new Error('Anonymous session boundary requires DISABLE_AUTH')
  }

  await ensureAnonymousUserExists()
  return createAnonymousSession()
}

export const getServerSession = cache(getServerSessionImpl)
