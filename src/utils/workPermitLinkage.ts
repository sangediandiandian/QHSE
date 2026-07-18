import type { WarningRule, WarningSignal, WorkPermit } from '@/types/qhse';

export function isWorkPermitLinkageEnabled(rules: WarningRule[]) {
  return rules.some(
    (rule) =>
      rule.source === '作业许可' &&
      rule.scenario === 'permit-linkage' &&
      rule.publishStatus === '已发布' &&
      rule.enabled,
  );
}

export function getWorkPermitLinkageSummary(permits: WorkPermit[], signals: WarningSignal[]) {
  const activeSignals = signals.filter(
    (signal) =>
      signal.status !== 'closed' &&
      Boolean(signal.areaId) &&
      ['high', 'critical'].includes(signal.level),
  );
  const affectedAreaIds = new Set(activeSignals.map((signal) => signal.areaId));

  return {
    activeSignalCount: activeSignals.length,
    candidatePermitIds: permits
      .filter((permit) => permit.status === '作业中' && affectedAreaIds.has(permit.areaId))
      .map((permit) => permit.id),
    recommendedPermitIds: permits
      .filter((permit) => permit.status === '建议暂停')
      .map((permit) => permit.id),
    pausedPermitIds: permits
      .filter((permit) => permit.status === '已暂停')
      .map((permit) => permit.id),
  };
}
