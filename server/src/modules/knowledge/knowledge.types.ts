export const knowledgeSourceTypes = ['event_review', 'hazard', 'emergency_plan'] as const;
export type KnowledgeSourceType = (typeof knowledgeSourceTypes)[number];

export interface KnowledgeSearchItem {
  id: string;
  type: KnowledgeSourceType;
  code: string;
  title: string;
  summary: string;
  highlights: string[];
  areaId?: string;
  areaName?: string;
  status: string;
  updatedAt: string;
  score: number;
}

export interface KnowledgeSearchResult {
  keyword: string;
  total: number;
  items: KnowledgeSearchItem[];
}
