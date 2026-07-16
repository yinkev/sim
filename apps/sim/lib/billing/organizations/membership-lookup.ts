import { db } from '@sim/db'
import { member } from '@sim/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Get user's current organization membership, if any.
 */
export async function getUserOrganization(
  userId: string
): Promise<{ organizationId: string; role: string; memberId: string } | null> {
  const [memberRecord] = await db
    .select({
      organizationId: member.organizationId,
      role: member.role,
      memberId: member.id,
    })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1)

  return memberRecord || null
}
