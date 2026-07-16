export const subscriptionKeys = {
  all: ['subscription'] as const,
  users: () => [...subscriptionKeys.all, 'user'] as const,
  user: (includeOrg?: boolean) => [...subscriptionKeys.users(), { includeOrg }] as const,
  usage: () => [...subscriptionKeys.all, 'usage'] as const,
  invoicesAll: () => [...subscriptionKeys.all, 'invoices'] as const,
  invoices: (context: 'user' | 'organization' = 'user', organizationId?: string) =>
    [...subscriptionKeys.invoicesAll(), context, organizationId ?? ''] as const,
}
