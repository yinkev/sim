/** Returns no organization branding when authentication is disabled. */
export async function getOrgWhitelabelSettings(_organizationId: string): Promise<null> {
  return null
}
