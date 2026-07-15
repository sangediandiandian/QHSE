export const hazardStatuses = ['待整改', '整改中', '待验收', '已关闭'] as const;
export type HazardStatus = (typeof hazardStatuses)[number];

export const hazardLevels = ['一般', '较大', '重大'] as const;
export type HazardLevel = (typeof hazardLevels)[number];

export const hazardSources = ['现场检查', '预警转化', '专项检查', '复盘整改'] as const;
export type HazardSource = (typeof hazardSources)[number];

export const hazardEvidenceCategories = ['整改前', '整改过程', '整改完成'] as const;
export type HazardEvidenceCategory = (typeof hazardEvidenceCategories)[number];

export type HazardAction = '上报' | '开始整改' | '提交验收' | '验收关闭' | '挂牌督办' | '解除挂牌';

export interface HazardEvidence {
  id: string;
  name: string;
  category: HazardEvidenceCategory;
  uploaderId: string;
  uploader: string;
  uploadedAt: string;
  note?: string;
}

export interface HazardOperation {
  id: string;
  action: HazardAction;
  operatorId: string;
  operator: string;
  operatedAt: string;
  detail: string;
}

export interface Hazard {
  id: string;
  code: string;
  title: string;
  areaId: string;
  areaName: string;
  level: HazardLevel;
  source: HazardSource;
  category: string;
  ownerDepartment: string;
  owner: string;
  discoveredAt: string;
  deadline: string;
  status: HazardStatus;
  riskUnitId: string;
  overdue: boolean;
  recurrenceCount: number;
  description: string;
  measures: string[];
  supervised: boolean;
  acceptanceOpinion?: string;
  evidence: HazardEvidence[];
  operations: HazardOperation[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface HazardQuery {
  status?: HazardStatus;
  level?: HazardLevel;
  areaId?: string;
  areaIds?: string[];
  keyword?: string;
  overdue?: boolean;
  supervised?: boolean;
}

export interface HazardMutation {
  status?: HazardStatus;
  supervised?: boolean;
  acceptanceOpinion?: string;
  evidence?: HazardEvidence;
  operation?: HazardOperation;
  updatedAt: string;
}
