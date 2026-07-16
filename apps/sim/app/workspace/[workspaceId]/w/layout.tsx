import { GlobalCommandsProvider } from '@/app/workspace/[workspaceId]/providers/global-commands-provider'
import { WorkspaceToastProvider } from '@/app/workspace/[workspaceId]/providers/workspace-toast-provider'

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceToastProvider>
      <GlobalCommandsProvider>{children}</GlobalCommandsProvider>
    </WorkspaceToastProvider>
  )
}
