import type { KnowledgeSearchQuery, KnowledgeSearchResult } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export async function searchKnowledge(params: KnowledgeSearchQuery) {
  const response = await request<ApiResponse<KnowledgeSearchResult>>('/api/v1/knowledge/search', {
    method: 'GET',
    params,
  });
  return response.data;
}
