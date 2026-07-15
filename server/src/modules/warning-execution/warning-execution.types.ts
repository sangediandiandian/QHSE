import type { RiskLevel } from '../risks/risk.types';

export type MetricValue = string | number | boolean;

export interface WarningSample {
  source: 'GDS' | 'VOC' | 'MES' | '联合预警';
  subjectId: string;
  areaId?: string;
  occurredAt: string;
  metrics: Record<string, MetricValue>;
}

export interface WarningEvaluationState {
  id: string;
  ruleId: string;
  subjectId: string;
  latestMetrics: Record<string, MetricValue>;
  metricTimes: Record<string, string>;
  conditionSince?: string;
  lastEvaluatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarningSignal {
  id: string;
  code: string;
  ruleId: string;
  ruleCode: string;
  subjectId: string;
  areaId?: string;
  source: string;
  level: RiskLevel;
  title: string;
  detail: string;
  occurredAt: string;
  status: 'active' | 'closed';
  createdAt: string;
}

export interface WarningEvaluationResult {
  evaluatedRuleCount: number;
  triggeredSignals: WarningSignal[];
  suppressedRuleIds: string[];
  linkedPermitIds: string[];
}
