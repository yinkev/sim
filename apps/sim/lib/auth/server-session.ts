import 'server-only'

import { cache } from 'react'
import { createVerifyAuth } from '@sim/auth/verify'
import { headers } from 'next/headers'
import { createAnonymousSession, ensureAnonymousUserExists } from '@/lib/auth/anonymous'
import { env } from '@/lib/core/config/env'
import { isAuthDisabled } from '@/lib/core/config/env-flags'
import { getBaseUrl } from '@/lib/core/utils/urls'

const sessionAuth = createVerifyAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: getBaseUrl(),
})

async function getServerSessionImpl() {
  if (isAuthDisabled) {
    await ensureAnonymousUserExists()
    return createAnonymousSession()
  }

  return sessionAuth.api.getSession({
    headers: await headers(),
    query: {
      disableCookieCache: true,
      disableRefresh: true,
    },
  })
}

export const getServerSession = cache(getServerSessionImpl)
