import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  type KnowledgeBaseData,
  type KnowledgeScope,
  listKnowledgeBasesContract,
} from '@/lib/api/contracts/knowledge'

type KnowledgeQueryScope = KnowledgeScope

export const knowledgeKeys = {
  all: ['knowledge'] as const,
  lists: () => [...knowledgeKeys.all, 'list'] as const,
  list: (workspaceId?: string, scope: KnowledgeQueryScope = 'active') =>
    [...knowledgeKeys.lists(), workspaceId ?? 'all', scope] as const,
  details: () => [...knowledgeKeys.all, 'detail'] as const,
  detail: (knowledgeBaseId?: string) =>
    [...knowledgeKeys.details(), knowledgeBaseId ?? ''] as const,
  tagDefinitions: (knowledgeBaseId: string) =>
    [...knowledgeKeys.detail(knowledgeBaseId), 'tagDefinitions'] as const,
  tagUsage: (knowledgeBaseId: string) =>
    [...knowledgeKeys.detail(knowledgeBaseId), 'tagUsage'] as const,
  documents: (knowledgeBaseId: string, paramsKey: string) =>
    [...knowledgeKeys.detail(knowledgeBaseId), 'documents', paramsKey] as const,
  document: (knowledgeBaseId: string, documentId: string) =>
    [...knowledgeKeys.detail(knowledgeBaseId), 'document', documentId] as const,
  documentTagDefinitions: (knowledgeBaseId: string, documentId: string) =>
    [...knowledgeKeys.document(knowledgeBaseId, documentId), 'tagDefinitions'] as const,
  chunks: (knowledgeBaseId: string, documentId: string, paramsKey: string) =>
    [...knowledgeKeys.document(knowledgeBaseId, documentId), 'chunks', paramsKey] as const,
  chunkSearch: (knowledgeBaseId: string, documentId: string, searchKey: string) =>
    [...knowledgeKeys.document(knowledgeBaseId, documentId), 'search', searchKey] as const,
}

export async function fetchKnowledgeBases(
  workspaceId?: string,
  scope: KnowledgeQueryScope = 'active',
  signal?: AbortSignal
): Promise<KnowledgeBaseData[]> {
  const result = await requestJson(listKnowledgeBasesContract, {
    query: { workspaceId, scope },
    signal,
  })

  return result.data
}

export function useKnowledgeBasesQuery(
  workspaceId?: string,
  options?: {
    enabled?: boolean
    scope?: KnowledgeQueryScope
  }
) {
  const scope = options?.scope ?? 'active'
  return useQuery({
    queryKey: knowledgeKeys.list(workspaceId, scope),
    queryFn: ({ signal }) => fetchKnowledgeBases(workspaceId, scope, signal),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
