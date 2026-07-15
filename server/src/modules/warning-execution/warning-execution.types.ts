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
  status: 'active' | 'acknowledged' | 'processing' | 'closed';
  operations: WarningSignalOperation[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarningSignalOperation {
  id: string;
  action: '确认' | '开始处置' | '关闭';
  operatorId: string;
  operator: string;
  operatedAt: string;
  detail: string;
}

export interface WarningSignalMutation {
  status: WarningSignal['status'];
  operation: WarningSignalOperation;
  updatedAt: string;
}

export interface WarningEvaluationResult {
  evaluatedRuleCount: number;
  triggeredSignals: WarningSignal[];
  suppressedRuleIds: string[];
  linkedPermitIds: string[];
}
