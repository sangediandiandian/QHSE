import type { DashboardData } from '@/types/qhse';
import { isWarningScenarioEnabled, withWarningRuleTriggered } from './warningRules';

const dashboard = {
  warningRules: [{
    id: 'rule-1', code: 'GDS_L2_01', name: 'GDS 二级报警', source: 'GDS',
    scenario: 'gds-level2', level: 'critical', scope: '全厂', condition: '达到二级阈值',
    duration: '即时', notifyTargets: ['岗位'], enabled: true, triggerCount: 2,
    description: '测试规则',
  }],
} as unknown as DashboardData;

describe('warning rules', () => {
  it('仅启用规则允许对应场景触发', () => {
    expect(isWarningScenarioEnabled(dashboard, 'gds-level2')).toBe(true);
    expect(isWarningScenarioEnabled(dashboard, 'voc-overlimit')).toBe(false);
    expect(isWarningScenarioEnabled({ ...dashboard, warningRules: [{ ...dashboard.warningRules[0], enabled: false }] }, 'gds-level2')).toBe(false);
  });

  it('触发后更新次数与时间', () => {
    expect(withWarningRuleTriggered(dashboard, 'gds-level2', '10:00:00').warningRules[0]).toMatchObject({
      triggerCount: 3,
      lastTriggeredAt: '10:00:00',
    });
  });
});
