import type { DashboardData, WarningRuleScenario } from '@/types/qhse';

export function isWarningScenarioEnabled(
  dashboard: DashboardData,
  scenario: WarningRuleScenario,
) {
  return dashboard.warningRules.some((rule) => rule.scenario === scenario && rule.enabled);
}

export function withWarningRuleTriggered(
  dashboard: DashboardData,
  scenario: WarningRuleScenario,
  triggeredAt: string,
) {
  return {
    ...dashboard,
    warningRules: dashboard.warningRules.map((rule) =>
      rule.scenario === scenario && rule.enabled
        ? {
            ...rule,
            triggerCount: rule.triggerCount + 1,
            lastTriggeredAt: triggeredAt,
          }
        : rule,
    ),
  };
}
