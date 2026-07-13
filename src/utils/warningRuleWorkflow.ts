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

export function submitWarningRuleForApproval(rule: WarningRule) {
  if (rule.publishStatus !== '草稿' || !rule.draft) return rule;
  return { ...rule, publishStatus: '待审批' as const };
}

export function publishWarningRule(rule: WarningRule, publishedAt: string, publisher: string) {
  if (rule.publishStatus !== '待审批' || !rule.draft) return rule;
  const version = rule.version + 1;
  return {
    ...rule,
    ...rule.draft,
    enabled: rule.version === 0 ? true : rule.enabled,
    publishStatus: '已发布' as const,
    version,
    versions: [...rule.versions, { ...rule.draft, version, publishedAt, publisher }],
    draft: undefined,
  };
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
