import type { RiskLevel } from '../risks/risk.types';

export const warningRuleSources = ['GDS', 'VOC', 'MES', '联合预警', '作业许可'] as const;
export type WarningRuleSource = (typeof warningRuleSources)[number];
export const warningRuleScenarios = [
  'gds-level2',
  'voc-overlimit',
  'joint-leak',
  'gds-trend',
  'permit-linkage',
] as const;
export type WarningRuleScenario = (typeof warningRuleScenarios)[number];
export type WarningRulePublishStatus = '草稿' | '待审批' | '已发布';

export interface WarningRuleExpressionItem {
  metric: string;
  operator: '>' | '>=' | '<' | '<=' | '=';
  threshold: string;
  connector: 'AND' | 'OR';
}

export interface WarningRuleConfig {
  name: string;
  source: WarningRuleSource;
  scenario: WarningRuleScenario;
  level: RiskLevel;
  scope: string;
  condition: string;
  duration: string;
  notifyTargets: string[];
  description: string;
  expression: WarningRuleExpressionItem[];
  rolloutPercentage: 25 | 50 | 100;
}

export interface WarningRuleVersion extends WarningRuleConfig {
  id: string;
  version: number;
  publishedAt: string;
  publisherId: string;
  publisher: string;
}

export interface WarningRuleApprovalStep {
  role: 'QHSE 会签' | '生产负责人会签';
  approver: string;
  status: '待审批' | '已通过' | '已驳回';
  approvedAt?: string;
}

export interface WarningRule extends WarningRuleConfig {
  id: string;
  code: string;
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt?: string;
  publishStatus: WarningRulePublishStatus;
  version: number;
  revision: number;
  draft?: WarningRuleConfig;
  versions: WarningRuleVersion[];
  approvalSteps?: WarningRuleApprovalStep[];
  workflowId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarningRuleQuery {
  source?: WarningRuleSource;
  publishStatus?: WarningRulePublishStatus;
  enabled?: boolean;
  keyword?: string;
}

export interface WarningRuleUpdate {
  publishedConfig?: WarningRuleConfig;
  draft?: WarningRuleConfig | null;
  publishStatus?: WarningRulePublishStatus;
  enabled?: boolean;
  workflowId?: string | null;
  newVersion?: WarningRuleVersion;
  updatedAt: string;
}
