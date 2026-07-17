'use client'

import { useParams } from 'next/navigation'
import { IntegrationTabsHeader } from '@/app/workspace/[workspaceId]/integrations/components/integration-tabs-header'

export default function IntegrationsLoading() {
  const { workspaceId } = useParams<{ workspaceId: string }>()

  return (
    <div className='flex h-full flex-col bg-[var(--bg)]'>
      <IntegrationTabsHeader active='integrations' workspaceId={workspaceId} />
      <div className='min-h-0 flex-1 overflow-hidden px-6'>
        <div className='mx-auto flex max-w-[48rem] animate-pulse flex-col gap-7 pb-3'>
          <div className='h-36 rounded-xl bg-[var(--surface-4)]' />
          <div className='h-9 rounded-xl bg-[var(--surface-4)]' />
          <div className='flex flex-col gap-3'>
            <div className='h-3 w-24 rounded bg-[var(--surface-4)]' />
            <div className='h-14 rounded-xl bg-[var(--surface-4)]' />
            <div className='h-14 rounded-xl bg-[var(--surface-4)]' />
          </div>
        </div>
      </div>
    </div>
  )
}
