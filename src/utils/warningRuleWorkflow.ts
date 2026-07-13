import type {
  WarningRule,
  WarningRuleConfig,
  WarningRuleDraftInput,
} from '@/types/qhse';

function toConfig(input: WarningRuleDraftInput | WarningRuleConfig): WarningRuleConfig {
  return {
    name: input.name,
    source: input.source,
    scenario: input.scenario,
    level: input.level,
    scope: input.scope,
    condition: input.condition,
    duration: input.duration,
    notifyTargets: input.notifyTargets,
    description: input.description,
    expression: input.expression,
    rolloutPercentage: input.rolloutPercentage ?? 100,
  };
}

export function getWarningRuleDisplayConfig(rule: WarningRule) {
  return rule.draft ?? toConfig(rule);
}

export function saveWarningRuleDraft(
  rules: WarningRule[],
  ruleId: string,
  input: WarningRuleDraftInput,
) {
  const config = toConfig(input);
  const existing = rules.find((rule) => rule.id === ruleId);
  if (existing) {
    return rules.map((rule) => rule.id === ruleId ? {
      ...rule,
      publishStatus: '草稿' as const,
      draft: config,
    } : rule);
  }
  return [...rules, {
    id: ruleId,
    code: input.code,
    ...config,
    enabled: false,
    triggerCount: 0,
    publishStatus: '草稿' as const,
    version: 0,
    draft: config,
    versions: [],
  }];
}

export function submitWarningRuleForApproval(rule: WarningRule): WarningRule {
  if (rule.publishStatus !== '草稿' || !rule.draft) return rule;
  return {
    ...rule,
    publishStatus: '待审批' as const,
    approvalSteps: [
      { role: 'QHSE 会签', approver: '赵磊', status: '待审批' as const },
      { role: '生产负责人会签', approver: '陈涛', status: '待审批' as const },
    ],
  };
}

export function approveWarningRuleStep(rule: WarningRule, approver: string, approvedAt: string) {
  if (rule.publishStatus !== '待审批') return rule;
  let approved = false;
  const approvalSteps = (rule.approvalSteps ?? []).map((step) => {
    if (approved || step.status === '已通过') return step;
    approved = true;
    return { ...step, approver, approvedAt, status: '已通过' as const };
  });
  return { ...rule, approvalSteps };
}

export function isWarningRuleFullyApproved(rule: WarningRule) {
  return Boolean(rule.approvalSteps?.length) && rule.approvalSteps!.every((step) => step.status === '已通过');
}

export function publishWarningRule(rule: WarningRule, publishedAt: string, publisher: string) {
  if (rule.publishStatus !== '待审批' || !rule.draft || !isWarningRuleFullyApproved(rule)) return rule;
  const version = rule.version + 1;
  return {
    ...rule,
    ...rule.draft,
    enabled: rule.version === 0 ? true : rule.enabled,
    publishStatus: '已发布' as const,
    version,
    versions: [...rule.versions, { ...rule.draft, version, publishedAt, publisher }],
    draft: undefined,
    approvalSteps: undefined,
  };
}

export function findWarningRuleConflicts(rules: WarningRule[], candidate: WarningRuleConfig, ruleId?: string) {
  const condition = candidate.expression?.length
    ? candidate.expression.map((item) => `${item.metric}${item.operator}${item.threshold}`).join('|')
    : candidate.condition.trim();
  return rules.filter((rule) => {
    if (rule.id === ruleId || rule.publishStatus !== '已发布' || !rule.enabled) return false;
    const runningCondition = rule.expression?.length
      ? rule.expression.map((item) => `${item.metric}${item.operator}${item.threshold}`).join('|')
      : rule.condition.trim();
    return rule.source === candidate.source && rule.scope === candidate.scope && runningCondition === condition;
  });
}

export function rollbackWarningRule(rule: WarningRule, version: number) {
  const target = rule.versions.find((item) => item.version === version);
  if (!target) return rule;
  return {
    ...rule,
    publishStatus: '草稿' as const,
    draft: toConfig(target),
  };
}
