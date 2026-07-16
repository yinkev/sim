/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { useUserPermissionConfig } from '@/ee/access-control/hooks/use-user-permission-config-disabled'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('disabled-auth user permission config', () => {
  it('returns the unrestricted fallback without issuing a query', () => {
    expect(useUserPermissionConfig('workspace-1')).toEqual({
      data: undefined,
      isLoading: false,
    })
  })

  it('aliases only the focused user-permission query seam', () => {
    const config = readSource('../../../next.config.ts')
    const permissionConfig = readSource('../../../hooks/use-permission-config.ts')
    const disabledHook = readSource('./use-user-permission-config-disabled.ts')

    expect(config).toContain("'@/ee/access-control/hooks/use-user-permission-config':")
    expect(config).toContain("'@/ee/access-control/hooks/use-user-permission-config-disabled'")
    expect(permissionConfig).toContain('@/ee/access-control/hooks/use-user-permission-config')
    expect(disabledHook).not.toContain('@tanstack/react-query')
    expect(disabledHook).not.toContain('/api/permission-groups/user')
  })
})
