import { WorkspaceToastProvider } from '@/app/workspace/[workspaceId]/providers/workspace-toast-provider'

export default function TablesLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceToastProvider>{children}</WorkspaceToastProvider>
}
