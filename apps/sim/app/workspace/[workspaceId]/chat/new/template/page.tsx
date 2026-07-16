import type { Metadata } from 'next'
import { TemplateImportRuntime } from './template-import-runtime'

export const metadata: Metadata = {
  title: 'New chat',
}

export default function TemplateImportPage() {
  return <TemplateImportRuntime />
}
