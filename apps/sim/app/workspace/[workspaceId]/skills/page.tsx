import { Suspense } from 'react'
import type { Metadata } from 'next'
import SkillsLoading from '@/app/workspace/[workspaceId]/skills/loading'
import { Skills } from '@/app/workspace/[workspaceId]/skills/skills'

export const metadata: Metadata = {
  title: 'Skills',
}

/**
 * Skills page entry. `Skills` reads URL query params via nuqs (which uses
 * `useSearchParams` internally), so it must sit under a Suspense boundary. The
 * fallback renders the real page chrome (background + tab header) so a suspend
 * never shows a blank frame.
 */
export default function SkillsPage() {
  return (
    <Suspense fallback={<SkillsLoading />}>
      <Skills />
    </Suspense>
  )
}
