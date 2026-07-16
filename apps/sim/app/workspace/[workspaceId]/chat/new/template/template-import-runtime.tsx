'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createLogger } from '@sim/logger'
import { useParams, useRouter } from 'next/navigation'
import { requestJson } from '@/lib/api/client/request'
import { createWorkflowContract } from '@/lib/api/contracts/workflows'
import {
  type LandingWorkflowSeed,
  LandingWorkflowSeedStorage,
} from '@/lib/core/utils/browser-storage'

const logger = createLogger('TemplateImportRuntime')

export function TemplateImportRuntime() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const startedRef = useRef(false)

  const createWorkflowFromLandingSeed = useCallback(
    async (seed: LandingWorkflowSeed): Promise<boolean> => {
      try {
        const { persistImportedWorkflow } = await import('@/lib/workflows/operations/import-export')
        const result = await persistImportedWorkflow({
          content: seed.workflowJson,
          filename: `${seed.workflowName}.json`,
          workspaceId,
          nameOverride: seed.workflowName,
          descriptionOverride: seed.workflowDescription || 'Imported from landing template',
          createWorkflow: async ({ name, description, workspaceId }) => {
            return requestJson(createWorkflowContract, {
              body: {
                name,
                description,
                workspaceId,
                deduplicate: true,
              },
            })
          },
        })

        if (!result?.workflowId) {
          logger.warn('Landing workflow seed did not produce a workflow', {
            templateId: seed.templateId,
          })
          return false
        }

        window.location.href = `/workspace/${workspaceId}/w/${result.workflowId}`
        return true
      } catch (error) {
        logger.error('Error creating workflow from landing workflow seed:', error)
        return false
      }
    },
    [workspaceId]
  )

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const seed = LandingWorkflowSeedStorage.consume()
    if (!seed) {
      router.replace(`/workspace/${workspaceId}/chat/new`)
      return
    }

    void createWorkflowFromLandingSeed(seed).then((succeeded) => {
      if (!succeeded) router.replace(`/workspace/${workspaceId}/chat/new`)
    })
  }, [createWorkflowFromLandingSeed, router, workspaceId])

  return (
    <div className='flex h-full items-center justify-center bg-[var(--bg)]'>
      <div
        className='size-[18px] animate-spin rounded-full border border-[var(--text-tertiary)] border-t-transparent'
        aria-label='Loading task'
      />
    </div>
  )
}
