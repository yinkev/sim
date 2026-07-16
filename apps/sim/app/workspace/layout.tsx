interface WorkspaceRootLayoutProps {
  children: React.ReactNode
}

export default function WorkspaceRootLayout({ children }: WorkspaceRootLayoutProps) {
  return <div className='workspace-root'>{children}</div>
}
