import type { ReactNode } from 'react'
import {
  Calendar,
  Connections,
  Database,
  Folder as FolderIcon,
  Library,
  Slash,
  Table as TableIcon,
  Task,
  Workflow,
} from '@/components/emcn/icons'
import { getDocumentIcon } from '@/components/icons/document-icons'
import type { ChatContextKind, ChatMessageContext } from '@/app/workspace/[workspaceId]/home/types'

interface RenderIconArgs {
  context: ChatMessageContext
  className: string
}

interface ChatContextKindConfig {
  /** Human label for the kind (used in tooltips / accessible names). */
  label: string
  /** Renders the chip icon. Returns null when no icon should be shown for this kind. */
  renderIcon: (args: RenderIconArgs) => ReactNode | null
}

function renderWorkflowIcon({ className }: RenderIconArgs): ReactNode | null {
  return <Workflow className={className} />
}

/**
 * Renders the lightweight generic integration glyph. The context still carries
 * its canonical block type for message semantics and downstream tool routing.
 */
function renderIntegrationTile({ context, className }: RenderIconArgs): ReactNode | null {
  if (context.kind !== 'integration') return null
  if (!context.blockType) return null
  return <Connections className={className} />
}

/**
 * Single source of truth for the icon and label associated with each
 * {@link ChatContextKind}. The `Record<ChatContextKind, …>` typing forces a
 * compile error whenever a new kind is added to the union without a
 * corresponding entry here, preventing the chip from silently rendering
 * without an icon.
 */
export const CHAT_CONTEXT_KIND_REGISTRY: Record<ChatContextKind, ChatContextKindConfig> = {
  workflow: { label: 'Workflow', renderIcon: renderWorkflowIcon },
  current_workflow: { label: 'Current workflow', renderIcon: renderWorkflowIcon },
  workflow_block: { label: 'Block', renderIcon: renderWorkflowIcon },
  blocks: { label: 'Blocks', renderIcon: () => null },
  knowledge: {
    label: 'Knowledge base',
    renderIcon: ({ className }) => <Database className={className} />,
  },
  table: {
    label: 'Table',
    renderIcon: ({ className }) => <TableIcon className={className} />,
  },
  file: {
    label: 'File',
    renderIcon: ({ context, className }) => {
      const FileDocIcon = getDocumentIcon('', context.label)
      return <FileDocIcon className={className} />
    },
  },
  folder: {
    label: 'Folder',
    renderIcon: ({ className }) => <FolderIcon className={className} />,
  },
  filefolder: {
    label: 'File folder',
    renderIcon: ({ className }) => <FolderIcon className={className} />,
  },
  scheduledtask: {
    label: 'Scheduled task',
    renderIcon: ({ className }) => <Calendar className={className} />,
  },
  past_chat: {
    label: 'Past chat',
    renderIcon: ({ className }) => <Task className={className} />,
  },
  logs: {
    label: 'Logs',
    renderIcon: ({ className }) => <Library className={className} />,
  },
  docs: { label: 'Docs', renderIcon: () => null },
  slash_command: { label: 'Command', renderIcon: () => null },
  integration: { label: 'Integration', renderIcon: renderIntegrationTile },
  skill: {
    label: 'Skill',
    renderIcon: ({ className }) => <Slash className={className} />,
  },
}
