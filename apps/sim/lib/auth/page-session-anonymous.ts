import 'server-only'

import { cache } from 'react'
import { createAnonymousSession } from '@/lib/auth/anonymous-session'

export const getPageSession = cache(async () => createAnonymousSession())
