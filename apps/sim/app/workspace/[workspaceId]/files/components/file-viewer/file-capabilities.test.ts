/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/uploads/utils/file-utils', () => ({
  getFileExtension: (filename: string): string => filename.split('.').pop()?.toLowerCase() ?? '',
}))

vi.mock('@/lib/uploads/utils/validation', () => ({
  SUPPORTED_CODE_EXTENSIONS: ['js', 'ts', 'py'],
}))

vi.mock('@/app/workspace/[workspaceId]/files/components/file-viewer/file-category', () => ({
  resolveFileCategory: (type: string) =>
    type.startsWith('text/') ? 'text-editable' : 'unsupported',
}))

import {
  isCsvStreamOnly,
  isMarkdownFile,
  isPreviewable,
  isTextEditable,
  resolvePreviewType,
} from './file-capabilities'

describe('file capabilities', () => {
  it('resolves rich previews by MIME type or extension', () => {
    expect(resolvePreviewType('text/markdown', 'notes.txt')).toBe('markdown')
    expect(resolvePreviewType(null, 'diagram.mmd')).toBe('mermaid')
    expect(resolvePreviewType(null, 'plain.txt')).toBeNull()
  })

  it('preserves list and toolbar capability decisions', () => {
    expect(isTextEditable({ type: 'text/plain', name: 'notes.txt' })).toBe(true)
    expect(isPreviewable({ type: 'text/html', name: 'page.html' })).toBe(true)
    expect(isMarkdownFile({ type: '', name: 'README.md' })).toBe(true)
    expect(isPreviewable({ type: 'application/pdf', name: 'report.pdf' })).toBe(false)
  })

  it('streams only CSV files above the inline editing limit', () => {
    expect(isCsvStreamOnly({ type: 'text/csv', name: 'small.csv', size: 5 * 1024 * 1024 })).toBe(
      false
    )
    expect(
      isCsvStreamOnly({ type: 'text/csv', name: 'large.csv', size: 5 * 1024 * 1024 + 1 })
    ).toBe(true)
    expect(isCsvStreamOnly({ type: 'text/plain', name: 'large.txt', size: 10 * 1024 * 1024 })).toBe(
      false
    )
  })
})
