/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  listIntegrationMentions,
  useFolders,
  useKnowledgeBasesQuery,
  useLogsList,
  useMothershipChats,
  useWorkspaceFileFolders,
  useWorkspaceFiles,
  useWorkspaceSchedules,
  useTablesList,
  useWorkflows,
} = vi.hoisted(() => ({
  listIntegrationMentions: vi.fn(() => [
    { blockType: 'google_sheets_v2', name: 'Google Sheets' },
    { blockType: 'slack', name: 'Slack' },
  ]),
  useFolders: vi.fn(() => ({ data: [] })),
  useKnowledgeBasesQuery: vi.fn(() => ({ data: [] })),
  useLogsList: vi.fn(() => ({ data: { pages: [] } })),
  useMothershipChats: vi.fn(() => ({ data: [] })),
  useWorkspaceFileFolders: vi.fn(() => ({ data: [] })),
  useWorkspaceFiles: vi.fn(() => ({ data: [] })),
  useWorkspaceSchedules: vi.fn(() => ({ data: [] })),
  useTablesList: vi.fn(() => ({ data: [] })),
  useWorkflows: vi.fn(() => ({ data: [] })),
}))

vi.mock('@/components/emcn', () => ({
  Button: 'button',
  DropdownMenu: 'div',
  DropdownMenuContent: 'div',
  DropdownMenuItem: 'div',
  DropdownMenuSearchInput: 'input',
  DropdownMenuSub: 'div',
  DropdownMenuSubContent: 'div',
  DropdownMenuSubTrigger: 'button',
  DropdownMenuTrigger: 'button',
  Tooltip: { Content: 'div', Root: 'div', Trigger: 'button' },
}))
vi.mock('@/components/emcn/icons', () => ({ Folder: 'svg', Plus: 'svg', Workflow: 'svg' }))
vi.mock(
  '@/app/workspace/[workspaceId]/home/components/mothership-view/components/resource-registry',
  () => ({ getResourceConfig: vi.fn() })
)
vi.mock(
  '@/app/workspace/[workspaceId]/home/components/mothership-view/components/resource-tabs/resource-tab-controls',
  () => ({ RESOURCE_TAB_ICON_BUTTON_CLASS: '', RESOURCE_TAB_ICON_CLASS: '' })
)
vi.mock('@/blocks/integration-mention-matcher', () => ({ listIntegrationMentions }))
vi.mock('@/hooks/queries/folder-list', () => ({ useFolders }))
vi.mock('@/hooks/queries/kb/knowledge-list', () => ({ useKnowledgeBasesQuery }))
vi.mock('@/hooks/queries/log-list', () => ({ useLogsList }))
vi.mock('@/hooks/queries/mothership-chat-list', () => ({ useMothershipChats }))
vi.mock('@/hooks/queries/schedule-list', () => ({ useWorkspaceSchedules }))
vi.mock('@/hooks/queries/table-list', () => ({ useTablesList }))
vi.mock('@/hooks/queries/workflow-list', () => ({ useWorkflows }))
vi.mock('@/hooks/queries/workspace-file-folders', () => ({ useWorkspaceFileFolders }))
vi.mock('@/hooks/queries/workspace-file-list', () => ({ useWorkspaceFiles }))

import {
  formatCompactLogDate,
  useAvailableResources,
} from '@/app/workspace/[workspaceId]/home/components/mothership-view/components/add-resource-dropdown/add-resource-dropdown'

let availableResources: ReturnType<typeof useAvailableResources> = []

function Harness({ enabled }: { enabled: boolean }) {
  availableResources = useAvailableResources(
    'workspace-1',
    new Set(['integration:slack']),
    undefined,
    { enabled }
  )
  return null
}

describe('available resources query intent', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    availableResources = []
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('forwards one intent gate to every resource list query', async () => {
    await act(async () => root.render(<Harness enabled={false} />))

    expect(useWorkflows).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
    expect(useTablesList).toHaveBeenLastCalledWith('workspace-1', 'active', { enabled: false })
    expect(useWorkspaceFiles).toHaveBeenLastCalledWith('workspace-1', 'active', { enabled: false })
    expect(useKnowledgeBasesQuery).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
    expect(useFolders).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
    expect(useWorkspaceFileFolders).toHaveBeenLastCalledWith('workspace-1', 'active', {
      enabled: false,
    })
    expect(useMothershipChats).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
    expect(useWorkspaceSchedules).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
    expect(useLogsList).toHaveBeenLastCalledWith('workspace-1', expect.any(Object), {
      enabled: false,
    })

    await act(async () => root.render(<Harness enabled />))
    expect(useWorkflows).toHaveBeenLastCalledWith('workspace-1', { enabled: true })
    expect(useLogsList).toHaveBeenLastCalledWith('workspace-1', expect.any(Object), {
      enabled: true,
    })
  })

  it('keeps compact integration mentions selectable without visual catalog metadata', async () => {
    await act(async () => root.render(<Harness enabled />))

    expect(availableResources.find(({ type }) => type === 'integration')).toEqual({
      type: 'integration',
      items: [
        { id: 'google_sheets_v2', name: 'Google Sheets', isOpen: false },
        { id: 'slack', name: 'Slack', isOpen: true },
      ],
    })
  })

  it('formats compact log dates without the logs date-formatting graph', () => {
    const localDate = new Date(2026, 0, 2, 3, 4, 5)

    expect(formatCompactLogDate(localDate.toISOString())).toBe('Jan 2 03:04:05')
  })
})
