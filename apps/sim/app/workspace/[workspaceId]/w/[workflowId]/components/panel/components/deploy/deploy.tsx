'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import { Button, Tooltip } from '@/components/emcn'
import {
  useChangeDetection,
  useDeployment,
  useDeployReadiness,
} from '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/deploy/hooks'
import { useCurrentWorkflow } from '@/app/workspace/[workspaceId]/w/[workflowId]/hooks/use-current-workflow'
import { useDeployedWorkflowState, useDeploymentInfo } from '@/hooks/queries/deployments'
import type { WorkspaceUserPermissions } from '@/hooks/use-user-permissions'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'

const LazyDeployModal = lazy(() =>
  import(
    '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/deploy/components/deploy-modal/deploy-modal'
  ).then((mod) => ({ default: mod.DeployModal }))
)

type DeployModalTab = 'general' | 'api' | 'chat' | 'mcp' | 'a2a'

interface DeployModalRequest {
  tab?: DeployModalTab
  version: number
}

const DEPLOY_MODAL_TABS = new Set<DeployModalTab>(['general', 'api', 'chat', 'mcp', 'a2a'])

function isDeployModalTab(value: unknown): value is DeployModalTab {
  return typeof value === 'string' && DEPLOY_MODAL_TABS.has(value as DeployModalTab)
}

interface DeployProps {
  activeWorkflowId: string | null
  userPermissions: WorkspaceUserPermissions
  className?: string
  disabled?: boolean
}

export function Deploy({
  activeWorkflowId,
  userPermissions,
  className,
  disabled = false,
}: DeployProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalRequest, setModalRequest] = useState<DeployModalRequest | null>(null)
  const hydrationPhase = useWorkflowRegistry((state) => state.hydration.phase)
  const isRegistryLoading = hydrationPhase === 'idle' || hydrationPhase === 'state-loading'
  const { hasBlocks } = useCurrentWorkflow()

  const { data: deploymentInfo } = useDeploymentInfo(activeWorkflowId, {
    enabled: !isRegistryLoading,
  })
  const isDeployed = deploymentInfo?.isDeployed ?? false

  const isDeployedStateEnabled = Boolean(activeWorkflowId) && isDeployed && !isRegistryLoading
  const {
    data: deployedStateData,
    isLoading: isLoadingDeployedState,
    isFetching: isFetchingDeployedState,
  } = useDeployedWorkflowState(activeWorkflowId, { enabled: isDeployedStateEnabled })
  const deployedState = isDeployedStateEnabled ? (deployedStateData ?? null) : null
  const deployReadiness = useDeployReadiness(activeWorkflowId)

  const { changeDetected, isChangeDetectionSettling } = useChangeDetection({
    workflowId: activeWorkflowId,
    deployedState,
    isLoadingDeployedState: isLoadingDeployedState || isFetchingDeployedState,
  })
  const isDeploymentSettling = isChangeDetectionSettling || deployReadiness.isSyncing

  const { isDeploying, handleDeployClick } = useDeployment({
    workflowId: activeWorkflowId,
    isDeployed,
    deployReadiness,
  })

  useEffect(() => {
    const handleOpenDeployModal = (event: Event) => {
      const requestedTab = (event as CustomEvent<{ tab?: unknown }>).detail?.tab
      setModalRequest((current) => ({
        tab: isDeployModalTab(requestedTab) ? requestedTab : undefined,
        version: (current?.version ?? 0) + 1,
      }))
      setIsModalOpen(true)
    }

    window.addEventListener('open-deploy-modal', handleOpenDeployModal)
    return () => window.removeEventListener('open-deploy-modal', handleOpenDeployModal)
  }, [])

  const isEmpty = !hasBlocks()
  const canDeploy = userPermissions.canAdmin
  const isDisabled =
    disabled ||
    isDeploying ||
    !canDeploy ||
    isEmpty ||
    (!isDeployed && deployReadiness.isBlocked && !deployReadiness.isSyncing)

  const onDeployClick = async () => {
    if (disabled || !canDeploy || !activeWorkflowId) return

    if (isDeploymentSettling) {
      setModalRequest(null)
      setIsModalOpen(true)
      return
    }

    const result = await handleDeployClick()
    if (result.shouldOpenModal) {
      setModalRequest(null)
      setIsModalOpen(true)
    }
  }

  const getTooltipText = () => {
    if (isEmpty) {
      return 'Cannot deploy an empty workflow'
    }
    if (!canDeploy) {
      return 'Admin permissions required'
    }
    if (disabled) {
      return 'Workflow is locked'
    }
    if (isDeploying) {
      return 'Deploying...'
    }
    if (isChangeDetectionSettling) {
      return 'Syncing deployment state...'
    }
    if (deployReadiness.isBlocked && !isDeployed) {
      return deployReadiness.tooltip
    }
    if (changeDetected) {
      return 'Update deployment'
    }
    if (isDeployed) {
      return 'Active deployment'
    }
    return 'Deploy workflow'
  }

  const getButtonLabel = () => {
    if (changeDetected) {
      return 'Update'
    }
    if (isDeployed) {
      return 'Live'
    }
    return 'Deploy'
  }

  return (
    <>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span>
            <Button
              className='h-[30px] gap-1.5 px-2.5'
              variant={
                isRegistryLoading ? 'active' : changeDetected || !isDeployed ? 'tertiary' : 'active'
              }
              onClick={onDeployClick}
              disabled={isRegistryLoading || isDisabled}
            >
              {getButtonLabel()}
            </Button>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content>{getTooltipText()}</Tooltip.Content>
      </Tooltip.Root>

      {isModalOpen && (
        <Suspense fallback={null}>
          <LazyDeployModal
            key={modalRequest?.version ?? 0}
            open
            onOpenChange={(open) => {
              setIsModalOpen(open)
              if (!open) setModalRequest(null)
            }}
            workflowId={activeWorkflowId}
            isDeployed={isDeployed}
            needsRedeployment={changeDetected}
            deployedState={deployedState}
            isLoadingDeployedState={isLoadingDeployedState || isFetchingDeployedState}
            deployReadiness={deployReadiness}
            isDeploymentSettling={isDeploymentSettling}
            initialTab={modalRequest?.tab}
          />
        </Suspense>
      )}
    </>
  )
}
