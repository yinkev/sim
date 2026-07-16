import { getEnv, isTruthy } from '@/lib/core/config/env'

export const isBillingEnabled = isTruthy(getEnv('NEXT_PUBLIC_BILLING_ENABLED'))
