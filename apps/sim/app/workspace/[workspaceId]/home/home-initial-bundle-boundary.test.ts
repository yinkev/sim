import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('home initial bundle boundaries', () => {
  it('does not import the executable block registry for presentation metadata', () => {
    const sources = [
      readSource('../../../../blocks/icon-color.ts'),
      readSource('../../../../blocks/integration-matcher.ts'),
      readSource('components/chat-context-kind-registry/chat-context-kind-registry.tsx'),
      readSource('components/suggested-actions/suggested-actions.tsx'),
    ]

    for (const source of sources) {
      expect(source).not.toContain('@/blocks/registry')
    }
  })

  it('does not pull home component and hook barrels into the landing route', () => {
    const home = readSource('home.tsx')

    expect(home).not.toMatch(/from ['"]\.\/components['"]/)
    expect(home).not.toMatch(/from ['"]\.\/hooks['"]/)
  })

  it('keeps the empty landing route separate from the chat runtime', () => {
    const home = readSource('home.tsx')

    expect(home).not.toContain("from './hooks/use-chat'")
    expect(home).not.toMatch(/\buseChat\s*\(/)
    expect(home).not.toContain('./components/user-input')
    expect(home).not.toContain('./components/chat-surface-context')
    expect(home).not.toContain('@/hooks/use-oauth-return')
    expect(home).not.toContain('home-runtime')
  })

  it('promotes landing interaction through a route-owned runtime', () => {
    const home = readSource('home.tsx')
    const chatPage = readSource('../chat/[chatId]/page.tsx')
    const newChatPage = readSource('../chat/new/page.tsx')
    const newChatRuntime = readSource('../chat/new/new-chat-runtime.tsx')
    const templatePage = readSource('../chat/new/template/page.tsx')
    const templateRuntime = readSource('../chat/new/template/template-import-runtime.tsx')
    const resourceContent = readSource(
      'components/mothership-view/components/resource-content/resource-content.tsx'
    )

    expect(home).toContain('/chat/new')
    expect(home).toContain('/chat/new/template')
    expect(home).toContain('LandingWorkflowSeedStorage.hasSeed()')
    expect(chatPage).toContain('HomeRuntime')
    expect(newChatPage).toContain('NewChatRuntime')
    expect(templatePage).toContain('TemplateImportRuntime')
    expect(newChatRuntime).not.toContain('HomeRuntime')
    expect(newChatRuntime).not.toContain('useChat(')
    expect(newChatRuntime).not.toContain('LandingWorkflowSeedStorage')
    expect(newChatRuntime).toContain('startNewChatHandoff({')
    expect(newChatRuntime).toContain('router.replace(')
    expect(newChatRuntime).toMatch(/\/chat\/\$\{chatId\}/)
    expect(templateRuntime).toContain('LandingWorkflowSeedStorage.consume()')
    expect(templateRuntime).toMatch(
      /router\.replace\(`\/workspace\/\$\{workspaceId\}\/chat\/new`\)/
    )
    expect(resourceContent).toContain('ProviderModelsLoader')
  })

  it('loads workflow execution infrastructure only when a workflow tool needs it', () => {
    const useChat = readSource('hooks/use-chat.ts')

    expect(useChat).not.toMatch(
      /^import .*run-tool-execution|^import \{[\s\S]*?\} from ['"]@\/lib\/copilot\/tools\/client\/run-tool-execution['"]/m
    )
    expect(useChat).not.toMatch(/^import .*useWorkflowRegistry/m)
    expect(useChat).not.toMatch(/^import .*useExecutionStore/m)
    expect(useChat).not.toMatch(/^import .*useTerminalConsoleStore/m)
    expect(useChat).not.toMatch(/^import .*useExecutionStream/m)
  })

  it('loads workflow import machinery only for a landing workflow seed', () => {
    const runtime = readSource('home-runtime.tsx')
    const newChatRuntime = readSource('../chat/new/new-chat-runtime.tsx')
    const templateRuntime = readSource('../chat/new/template/template-import-runtime.tsx')

    expect(runtime).not.toMatch(/^import .*persistImportedWorkflow/m)
    expect(runtime).not.toContain("import('@/lib/workflows/operations/import-export')")
    expect(newChatRuntime).not.toContain("import('@/lib/workflows/operations/import-export')")
    expect(templateRuntime).toContain("import('@/lib/workflows/operations/import-export')")
  })

  it('keeps chat composer imports off registry-reaching barrels', () => {
    const runtime = readSource('home-runtime.tsx')
    const useChat = readSource('hooks/use-chat.ts')
    const handleToolEvent = readSource('hooks/stream/handle-tool-event.ts')
    const promptEditor = readSource(
      'components/user-input/components/prompt-editor/use-prompt-editor.ts'
    )
    const resourceDropdown = readSource(
      'components/mothership-view/components/add-resource-dropdown/add-resource-dropdown.tsx'
    )
    const resourceContent = readSource(
      'components/mothership-view/components/resource-content/resource-content.tsx'
    )
    const specialTags = readSource(
      'components/message-content/components/special-tags/special-tags.tsx'
    )

    expect(useChat).toContain('@/hooks/queries/utils/workflow-keys')
    expect(useChat).not.toContain("from '@/hooks/queries/workflows'")
    expect(handleToolEvent).toContain('@/hooks/queries/utils/workflow-keys')
    expect(handleToolEvent).not.toContain("from '@/hooks/queries/workflows'")
    expect(promptEditor).not.toMatch(/user-input\/hooks['"]$/m)
    expect(resourceDropdown).toContain('export function formatCompactLogDate')
    expect(resourceDropdown).not.toContain('@/app/workspace/[workspaceId]/logs/format-date')
    expect(resourceDropdown).not.toContain('@/app/workspace/[workspaceId]/logs/utils')
    expect(resourceDropdown).toContain('@/hooks/queries/workflow-list')
    expect(resourceDropdown).toContain('@/hooks/queries/workspace-file-list')
    expect(resourceDropdown).toContain('@/hooks/queries/mothership-chat-list')
    expect(resourceDropdown).not.toContain("from '@/hooks/queries/mothership-chats'")
    expect(specialTags).toContain('@/hooks/queries/workflow-list')
    expect(specialTags).not.toContain("from '@/hooks/queries/workflows'")
    expect(runtime).not.toContain('ProviderModelsLoader')
    expect(resourceContent).toContain('ProviderModelsLoader')
  })

  it('keeps chat integration mentions on compact metadata and generic icons', () => {
    const matcher = readSource('../../../../blocks/integration-mention-matcher.ts')
    const userInput = readSource('components/user-input/user-input.tsx')
    const autoMention = readSource(
      '../w/[workflowId]/components/panel/components/copilot/components/user-input/hooks/use-integration-auto-mention.ts'
    )
    const userMessage = readSource('components/user-message-content/user-message-content.tsx')
    const resourceDropdown = readSource(
      'components/mothership-view/components/add-resource-dropdown/add-resource-dropdown.tsx'
    )
    const resourceRegistry = readSource(
      'components/mothership-view/components/resource-registry/resource-registry.tsx'
    )
    const contextRegistry = readSource(
      'components/chat-context-kind-registry/chat-context-kind-registry.tsx'
    )
    const skillsMenu = readSource(
      'components/user-input/components/skills-menu-dropdown/skills-menu-dropdown.tsx'
    )
    const lightweightSources = [
      matcher,
      userInput,
      autoMention,
      userMessage,
      resourceDropdown,
      resourceRegistry,
      contextRegistry,
      skillsMenu,
    ]

    expect(matcher).toContain('@/lib/integrations/integration-mention-catalog.json')
    expect(resourceDropdown).toContain('listIntegrationMentions')
    expect(resourceRegistry).toContain('<Connections')
    expect(contextRegistry).toContain('<Connections')
    expect(contextRegistry).toContain('<Slash')
    expect(skillsMenu).toContain('<Slash')

    for (const source of lightweightSources) {
      expect(source).not.toContain('@/lib/integrations/client-catalog')
      expect(source).not.toContain('@/lib/integrations/icon-mapping')
      expect(source).not.toContain('@/lib/integrations/integrations.json')
      expect(source).not.toMatch(/from ['"]@\/components\/icons['"]/)
    }
  })
})
