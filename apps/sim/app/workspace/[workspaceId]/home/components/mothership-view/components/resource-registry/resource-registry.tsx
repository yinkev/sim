'use client'

import type { ElementType, ReactNode } from 'react'
import {
  Calendar,
  Connections,
  Database,
  File as FileIcon,
  Folder as FolderIcon,
  Library,
  Table as TableIcon,
  Task,
  TerminalWindow,
  Workflow,
} from '@/components/emcn/icons'
import { getDocumentIcon } from '@/components/icons/document-icons'
import { cn } from '@/lib/core/utils/cn'
import type {
  MothershipResource,
  MothershipResourceType,
} from '@/app/workspace/[workspaceId]/home/types'

interface DropdownItemRenderProps {
  item: { id: string; name: string; [key: string]: unknown }
}

export interface ResourceTypeConfig {
  type: MothershipResourceType
  label: string
  icon: ElementType
  renderTabIcon: (resource: MothershipResource, className: string) => ReactNode
  renderDropdownItem: (props: DropdownItemRenderProps) => ReactNode
}

function WorkflowDropdownItem({ item }: DropdownItemRenderProps) {
  return (
    <>
      <Workflow className='size-[14px] flex-shrink-0 text-[var(--text-icon)]' />
      <span className='truncate'>{item.name}</span>
    </>
  )
}

function DefaultDropdownItem({ item }: DropdownItemRenderProps) {
  return <span className='truncate'>{item.name}</span>
}

function FileDropdownItem({ item }: DropdownItemRenderProps) {
  const DocIcon = getDocumentIcon('', item.name)
  return (
    <>
      <DocIcon className='size-[14px] flex-shrink-0 text-[var(--text-icon)]' />
      <span className='truncate'>{item.name}</span>
    </>
  )
}

function IconDropdownItem({ item, icon: Icon }: DropdownItemRenderProps & { icon: ElementType }) {
  return (
    <>
      <Icon className='size-[14px] flex-shrink-0 text-[var(--text-icon)]' />
      <span className='truncate'>{item.name}</span>
    </>
  )
}

/**
 * Renders integration mention candidates with the lightweight generic icon.
 */
function IntegrationDropdownItem({ item }: DropdownItemRenderProps) {
  return (
    <>
      <Connections className='size-[14px] flex-shrink-0 text-[var(--text-icon)]' />
      <span className='truncate'>{item.name}</span>
    </>
  )
}

function LogDropdownItem({ item }: DropdownItemRenderProps) {
  const workflowName = (item.workflowName as string) ?? item.name
  const time = (item.time as string) ?? ''
  return (
    <>
      <Workflow className='size-[14px] flex-shrink-0 text-[var(--text-icon)]' />
      <span className='truncate'>{workflowName}</span>
      {time && (
        <span className='ml-auto flex-shrink-0 text-[var(--text-tertiary)] text-caption'>
          {time}
        </span>
      )}
    </>
  )
}

export const RESOURCE_REGISTRY: Record<MothershipResourceType, ResourceTypeConfig> = {
  generic: {
    type: 'generic',
    label: 'Results',
    icon: TerminalWindow,
    renderTabIcon: (_resource, className) => (
      <TerminalWindow className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <DefaultDropdownItem {...props} />,
  },
  workflow: {
    type: 'workflow',
    label: 'Workflows',
    icon: Workflow,
    renderTabIcon: (_resource, className) => (
      <Workflow className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <WorkflowDropdownItem {...props} />,
  },
  table: {
    type: 'table',
    label: 'Tables',
    icon: TableIcon,
    renderTabIcon: (_resource, className) => (
      <TableIcon className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <IconDropdownItem {...props} icon={TableIcon} />,
  },
  file: {
    type: 'file',
    label: 'Files',
    icon: FileIcon,
    renderTabIcon: (resource, className) => {
      const DocIcon = getDocumentIcon('', resource.title)
      return <DocIcon className={cn(className, 'text-[var(--text-icon)]')} />
    },
    renderDropdownItem: (props) => <FileDropdownItem {...props} />,
  },
  knowledgebase: {
    type: 'knowledgebase',
    label: 'Knowledge Bases',
    icon: Database,
    renderTabIcon: (_resource, className) => (
      <Database className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <IconDropdownItem {...props} icon={Database} />,
  },
  folder: {
    type: 'folder',
    label: 'Folders',
    icon: FolderIcon,
    renderTabIcon: (_resource, className) => (
      <FolderIcon className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <IconDropdownItem {...props} icon={FolderIcon} />,
  },
  filefolder: {
    type: 'filefolder',
    label: 'File Folders',
    icon: FolderIcon,
    renderTabIcon: (_resource, className) => (
      <FolderIcon className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <IconDropdownItem {...props} icon={FolderIcon} />,
  },
  task: {
    type: 'task',
    label: 'Chats',
    icon: Task,
    renderTabIcon: (_resource, className) => (
      <Task className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <DefaultDropdownItem {...props} />,
  },
  scheduledtask: {
    type: 'scheduledtask',
    label: 'Scheduled Tasks',
    icon: Calendar,
    renderTabIcon: (_resource, className) => (
      <Calendar className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <IconDropdownItem {...props} icon={Calendar} />,
  },
  log: {
    type: 'log',
    label: 'Logs',
    icon: Library,
    renderTabIcon: (_resource, className) => (
      <Library className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <LogDropdownItem {...props} />,
  },
  integration: {
    type: 'integration',
    label: 'Integrations',
    icon: Connections,
    renderTabIcon: (_resource, className) => (
      <Connections className={cn(className, 'text-[var(--text-icon)]')} />
    ),
    renderDropdownItem: (props) => <IntegrationDropdownItem {...props} />,
  },
} as const

export const RESOURCE_TYPES = Object.values(RESOURCE_REGISTRY)

export function getResourceConfig(type: MothershipResourceType): ResourceTypeConfig {
  return RESOURCE_REGISTRY[type]
}
