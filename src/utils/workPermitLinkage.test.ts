import type { WarningRule, WarningSignal, WorkPermit } from '@/types/qhse';
import { getWorkPermitLinkageSummary, isWorkPermitLinkageEnabled } from './workPermitLinkage';

const permit = (id: string, areaId: string, status: WorkPermit['status']): WorkPermit =>
  ({
    id,
    areaId,
    status,
  }) as WorkPermit;

const signal = (
  id: string,
  areaId: string,
  level: WarningSignal['level'],
  status: WarningSignal['status'] = 'active',
): WarningSignal =>
  ({
    id,
    areaId,
    level,
    status,
  }) as WarningSignal;

describe('work permit linkage view', () => {
  test('只使用未关闭的较大及以上预警识别候选票证', () => {
    const summary = getWorkPermitLinkageSummary(
      [
        permit('operating-linked', 'area-02', '作业中'),
        permit('operating-safe', 'area-03', '作业中'),
        permit('recommended', 'area-02', '建议暂停'),
        permit('paused', 'area-02', '已暂停'),
      ],
      [
        signal('critical', 'area-02', 'critical'),
        signal('medium', 'area-03', 'medium'),
        signal('closed', 'area-03', 'high', 'closed'),
      ],
    );

    expect(summary).toEqual({
      activeSignalCount: 1,
      candidatePermitIds: ['operating-linked'],
      recommendedPermitIds: ['recommended'],
      pausedPermitIds: ['paused'],
    });
  });

  test('只有已发布且启用的作业许可联动规则才开放联动状态', () => {
    const rule = {
      source: '作业许可',
      scenario: 'permit-linkage',
      publishStatus: '已发布',
      enabled: true,
    } as WarningRule;

    expect(isWorkPermitLinkageEnabled([rule])).toBe(true);
    expect(isWorkPermitLinkageEnabled([{ ...rule, enabled: false }])).toBe(false);
    expect(isWorkPermitLinkageEnabled([{ ...rule, publishStatus: '草稿' }])).toBe(false);
    expect(isWorkPermitLinkageEnabled([{ ...rule, scenario: 'gds-level2' }])).toBe(false);
  });
});
