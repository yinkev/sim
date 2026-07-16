/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('API session boundary', () => {
  it('delegates session reads to the minimal server verifier', () => {
    const source = readSource('api-session.ts')

    expect(source).toContain('@/lib/auth/server-session')
    expect(source).toContain('getServerSession as getSession')
    expect(source).not.toContain("from '@/lib/auth'")
    expect(source).not.toContain("from '@/lib/auth/auth'")
  })

  it('keeps initial Studio API routes and shared middleware off the full auth barrel', () => {
    const sources = [
      readSource('../../app/api/settings/allowed-integrations/route.ts'),
      readSource('../../app/api/users/me/settings/route.ts'),
      readSource('../../app/api/permission-groups/user/route.ts'),
      readSource('../../app/api/workspaces/[id]/environment/route.ts'),
      readSource('../../app/api/folders/route.ts'),
      readSource('../../app/api/knowledge/route.ts'),
      readSource('../../app/api/workspaces/[id]/files/route.ts'),
      readSource('../../app/api/workspaces/route.ts'),
      readSource('../../app/api/environment/route.ts'),
      readSource('hybrid.ts'),
      readSource('../events/sse-endpoint.ts'),
      readSource('../workflows/utils.ts'),
      readSource('../copilot/request/http.ts'),
      readSource('../copilot/chat/post.ts'),
    ]

    for (const source of sources) {
      expect(source).not.toMatch(/from ['"]@\/lib\/auth['"]/)
    }
  })
})
