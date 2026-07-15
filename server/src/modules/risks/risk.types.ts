export const riskLevels = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = typeof riskLevels[number];

export interface RiskDynamicFactor {
  source: 'GDS' | 'VOC' | 'MES' | '作业许可' | '隐患';
  label: string;
  impact: 'up' | 'watch';
  status: string;
}

export interface RiskAssessment {
  id: string;
  assessorId: string;
  method: 'LEC';
  likelihood: number;
  exposure: number;
  consequence: number;
  score: number;
  level: RiskLevel;
  assessor: string;
  assessedAt: Date;
  basis: string;
}

export interface RiskControl {
  id: string;
  content: string;
  owner: string;
  status: '有效' | '待验证';
  updatedAt: Date;
}

export interface RiskUnit {
  id: string;
  code: string;
  name: string;
  parentName: string;
  areaId: string;
  areaName: string;
  ownerDepartment: string;
  owner: string;
  medium: string;
  accidentTypes: string[];
  staticLevel: RiskLevel;
  currentLevel: RiskLevel;
  controls: string[];
  linkedGds: number;
  linkedVoc: number;
  linkedMes: number;
  linkedPlans: number;
  dynamicFactors: RiskDynamicFactor[];
  assessments: RiskAssessment[];
  controlRecords: RiskControl[];
  version: number;
  updatedAt: Date;
}

export interface RiskQuery {
  areaId?: string;
  areaIds?: string[];
  level?: RiskLevel;
  keyword?: string;
}
