import { WorkflowRealtimeBoundary } from '@/app/workspace/[workspaceId]/providers/workflow-realtime-boundary'
import { WorkspaceScopeSync } from '@/app/workspace/[workspaceId]/providers/workspace-scope-sync'
import { ErrorBoundary } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/error'
import { WorkflowNavigationPortal } from '@/app/workspace/[workspaceId]/w/components/sidebar/workflow-navigation-portal'

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkflowRealtimeBoundary>
      <WorkflowNavigationPortal />
      <main className='flex h-full flex-1 flex-col overflow-hidden'>
        <WorkspaceScopeSync />
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </WorkflowRealtimeBoundary>
  )
}
