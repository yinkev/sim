'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CircleInfo, Home } from '@/components/emcn/icons'
import { ErrorShell } from '@/app/workspace/[workspaceId]/components/error'

export default function WorkspaceNotFound() {
  const router = useRouter()
  const { workspaceId } = useParams<{ workspaceId?: string }>()
  const homeHref = workspaceId ? `/workspace/${workspaceId}/home` : '/'

  return (
    <ErrorShell
      title='Page not found'
      description="The page you're looking for doesn't exist or has been moved. Head back to your workspace to keep building."
      icon={<CircleInfo className='size-[22px]' />}
    >
      <button
        type='button'
        onClick={() => router.back()}
        className='inline-flex items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--surface-4)] px-2 py-1.5 font-medium text-[12px] text-[var(--text-secondary)]'
      >
        <ArrowLeft className='mr-1.5 size-[14px]' />
        Go back
      </button>
      <a
        href={homeHref}
        className='inline-flex items-center justify-center rounded-[5px] bg-[var(--text-primary)] px-2 py-1.5 font-medium text-[12px] text-[var(--text-inverse)]'
      >
        <Home className='mr-1.5 size-[14px]' />
        Return home
      </a>
    </ErrorShell>
  )
}
