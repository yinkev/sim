import type { ComponentType, CSSProperties, SVGProps } from 'react'
import {
  BookOpen,
  Bug,
  Calendar,
  Card,
  ClipboardList,
  File,
  Mail,
  Search,
  Send,
  ShieldCheck,
  Table,
  Users,
} from '@/components/emcn/icons'
import {
  CirclebackIcon,
  EnrichmentIcon,
  MailServerIcon,
  RssIcon,
  SpotifyIcon,
} from '@/components/icons'
import homeSuggestionsJson from '@/lib/integrations/home-suggestions.json'
import { blockTypeToIconMap } from '@/lib/integrations/icon-mapping'
import type { ModuleTag } from '@/blocks/types'

export type HomeSuggestionIcon = ComponentType<
  SVGProps<SVGSVGElement> & { className?: string; style?: CSSProperties }
>

export interface HomeSuggestion {
  id: string
  blockType: string
  label: string
  prompt: string
  icon: HomeSuggestionIcon
  modules: readonly ModuleTag[]
  featured: boolean
  popular: boolean
}

type SerializedHomeSuggestion = {
  id: string
  blockType: string
  label: string
  prompt: string
  modules: string[]
  featured: boolean
  popular: boolean
  iconType?: string
  iconName?: string
}

const standaloneIcons: Readonly<Record<string, HomeSuggestionIcon>> = {
  BookOpen,
  Bug,
  Calendar,
  Card,
  CirclebackIcon,
  ClipboardList,
  EnrichmentIcon,
  File,
  Mail,
  MailServerIcon,
  RssIcon,
  Search,
  Send,
  ShieldCheck,
  SpotifyIcon,
  Table,
  Users,
}

function resolveSuggestionIcon(suggestion: SerializedHomeSuggestion): HomeSuggestionIcon {
  const icon = suggestion.iconType
    ? blockTypeToIconMap[suggestion.iconType]
    : suggestion.iconName
      ? standaloneIcons[suggestion.iconName]
      : undefined

  if (!icon) {
    throw new Error(`Missing home suggestion icon for ${suggestion.id}`)
  }
  return icon
}

export const HOME_SUGGESTIONS: readonly HomeSuggestion[] = (
  homeSuggestionsJson.suggestions as SerializedHomeSuggestion[]
).map((suggestion) => ({
  id: suggestion.id,
  blockType: suggestion.blockType,
  label: suggestion.label,
  prompt: suggestion.prompt,
  icon: resolveSuggestionIcon(suggestion),
  modules: suggestion.modules as ModuleTag[],
  featured: suggestion.featured,
  popular: suggestion.popular,
}))
