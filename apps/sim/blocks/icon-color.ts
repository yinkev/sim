import type { ComponentType, CSSProperties } from 'react'
import { stripVersionSuffix } from '@sim/utils/string'
import { SimDeploymentsIcon } from '@/components/icons'
import { ICON_COLOR_BY_BLOCK_TYPE } from '@/lib/integrations/icon-colors'
import { blockTypeToIconMap } from '@/lib/integrations/icon-mapping'

/** A brand icon component that accepts standard styling props. */
export type StyleableIcon = ComponentType<{ className?: string; style?: CSSProperties }>

let iconColorByComponent: Map<StyleableIcon, string> | null = null

function getIconColorMap(): Map<StyleableIcon, string> {
  if (iconColorByComponent) return iconColorByComponent

  const iconByType = new Map<string, StyleableIcon>()
  for (const [blockType, icon] of Object.entries(blockTypeToIconMap)) {
    iconByType.set(blockType, icon)
    iconByType.set(stripVersionSuffix(blockType), icon)
  }
  iconByType.set('deployments', SimDeploymentsIcon)

  const colors = new Map<StyleableIcon, string>()
  for (const [blockType, color] of Object.entries(ICON_COLOR_BY_BLOCK_TYPE)) {
    const icon = iconByType.get(blockType) ?? iconByType.get(stripVersionSuffix(blockType))
    if (icon) colors.set(icon, color)
  }

  iconColorByComponent = colors
  return colors
}

/** Returns the theme-safe brand color for a bare SVG icon, when one is defined. */
export function getBareIconStyle(icon: StyleableIcon): CSSProperties | undefined {
  const color = getIconColorMap().get(icon)
  return color ? { color } : undefined
}
