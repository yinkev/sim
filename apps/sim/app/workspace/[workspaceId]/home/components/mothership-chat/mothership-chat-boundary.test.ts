import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('mothership chat bundle boundary', () => {
  it('uses leaf message actions and chat icon modules', () => {
    const mothershipChat = readSource('mothership-chat.tsx')
    const messageContentUtils = readSource('../message-content/utils.ts')
    const chatIcons = readSource('../../../../../../components/icons/chat-icons.tsx')
    const iconCompatibilityBarrel = readSource('../../../../../../components/icons.tsx')

    expect(mothershipChat).toContain(
      '@/app/workspace/[workspaceId]/components/message-actions/message-actions'
    )
    expect(mothershipChat).not.toContain("from '@/app/workspace/[workspaceId]/components'")
    expect(messageContentUtils).toContain("from '@/components/icons/chat-icons'")
    expect(messageContentUtils).not.toContain("from '@/components/icons'")

    for (const iconName of ['AgentIcon', 'ImageIcon', 'TTSIcon', 'VideoIcon']) {
      expect(chatIcons).toContain(`export function ${iconName}`)
      expect(iconCompatibilityBarrel).not.toContain(`export function ${iconName}`)
    }
    expect(iconCompatibilityBarrel).toContain(
      "export { AgentIcon, ImageIcon, TTSIcon, VideoIcon } from '@/components/icons/chat-icons'"
    )
  })
})
