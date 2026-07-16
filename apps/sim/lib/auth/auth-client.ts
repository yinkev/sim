import { ssoClient } from '@better-auth/sso/client'
import { stripeClient } from '@better-auth/stripe/client'
import {
  adminClient,
  customSessionClient,
  emailOTPClient,
  genericOAuthClient,
  organizationClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type { auth } from '@/lib/auth'
import { env } from '@/lib/core/config/env'
import { isBillingEnabled, isOrganizationsEnabled } from '@/lib/core/config/env-flags'
import { getBaseUrl, getBrowserOrigin } from '@/lib/core/utils/urls'

export { useSession } from '@/app/_shell/providers/use-session'

function getAuthBaseUrl(): string {
  return getBrowserOrigin() ?? getBaseUrl()
}

export const client = createAuthClient({
  baseURL: getAuthBaseUrl(),
  plugins: [
    adminClient(),
    emailOTPClient(),
    genericOAuthClient(),
    customSessionClient<typeof auth>(),
    ...(isBillingEnabled
      ? [
          stripeClient({
            subscription: true, // Enable subscription management
          }),
        ]
      : []),
    ...(isOrganizationsEnabled ? [organizationClient()] : []),
    ...(env.NEXT_PUBLIC_SSO_ENABLED ? [ssoClient()] : []),
  ],
})

export const useActiveOrganization = isOrganizationsEnabled
  ? client.useActiveOrganization
  : () => ({ data: undefined, isPending: false, error: null })

export const useSubscription = () => {
  return {
    list: client.subscription?.list,
    upgrade: client.subscription?.upgrade,
    cancel: client.subscription?.cancel,
    restore: client.subscription?.restore,
  }
}

const { signIn, signUp, signOut } = client
export { signOut }
