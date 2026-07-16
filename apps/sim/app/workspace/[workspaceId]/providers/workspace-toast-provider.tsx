'use client'

import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/emcn'

export function WorkspaceToastProvider({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
