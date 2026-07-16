'use client'

import { useEffect } from 'react'
import { createLogger } from '@sim/logger'
import { useParams, useRouter } from 'next/navigation'
import { useWorkflows } from '@/hooks/queries/workflow-list'

const logger = createLogger('WorkflowsPage')

export default function WorkflowsPage() {
  const router = useRouter()
  const params = useParams()
  const workspaceId = params.workspaceId as string

  const { data: workflows = [], isLoading, isError, isPlaceholderData } = useWorkflows(workspaceId)

  useEffect(() => {
    if (isLoading || isPlaceholderData) return

    if (isError) {
      logger.error('Failed to load workflows for workspace')
      return
    }

    const workspaceWorkflows = workflows.filter((workflow) => workflow.workspaceId === workspaceId)

    if (workspaceWorkflows.length > 0) {
      router.replace(`/workspace/${workspaceId}/w/${workspaceWorkflows[0].id}`)
    }
  }, [isLoading, isPlaceholderData, workflows, workspaceId, router, isError])

  return (
    <div className='flex h-full w-full items-center justify-center bg-[var(--bg)]'>
      <div
        className='size-[18px] animate-spin rounded-full'
        style={{
          background:
            'conic-gradient(from 0deg, hsl(var(--muted-foreground)) 0deg 120deg, transparent 120deg 180deg, hsl(var(--muted-foreground)) 180deg 300deg, transparent 300deg 360deg)',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 1.5px), black calc(100% - 1.5px))',
          WebkitMask:
            'radial-gradient(farthest-side, transparent calc(100% - 1.5px), black calc(100% - 1.5px))',
        }}
      />
    </div>
  )
}
