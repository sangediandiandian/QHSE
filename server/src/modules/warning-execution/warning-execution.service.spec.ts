/** @jest-environment node */

import { InMemoryWorkPermitRepository } from '../work-permits/in-memory-work-permit.repository';
import { WorkPermitService } from '../work-permits/work-permit.service';
import { InMemoryWorkflowRepository } from '../workflows/in-memory-workflow.repository';
import { WorkflowService } from '../workflows/workflow.service';
import { InMemoryWarningRuleRepository } from '../warning-rules/in-memory-warning-rule.repository';
import { WarningRuleService } from '../warning-rules/warning-rule.service';
import { InMemoryWarningExecutionRepository } from './in-memory-warning-execution.repository';
import { WarningExecutionService } from './warning-execution.service';

function createFixture() {
  let sequence = 0;
  const createId = () => `execution-${String(++sequence).padStart(4, '0')}`;
  const rules = new WarningRuleService(
    new InMemoryWarningRuleRepository(),
    new WorkflowService(new InMemoryWorkflowRepository(), { createId }),
    { createId },
  );
  const permits = new WorkPermitService(new InMemoryWorkPermitRepository(), { createId });
  const execution = new WarningExecutionService(
    new InMemoryWarningExecutionRepository(),
    rules,
    permits,
    { createId, suppressionMs: 5 * 60 * 1000 },
  );
  return { execution, rules, permits };
}

describe('WarningExecutionService', () => {
  test('即时阈值生成信号并联动作业票暂停建议', async () => {
    const { execution, permits } = createFixture();
    const result = await execution.evaluate({
      source: 'GDS',
      subjectId: 'GDS-101',
      areaId: 'area-02',
      occurredAt: '2026-07-15T08:00:00.000Z',
      metrics: { 'GDS.currentValue': 55 },
    });
    expect(result).toMatchObject({ evaluatedRuleCount: 3, linkedPermitIds: ['permit-001'] });
    expect(result.triggeredSignals).toHaveLength(1);
    expect(result.triggeredSignals[0]).toMatchObject({ ruleId: 'rule-001', level: 'critical' });
    await expect(permits.get('permit-001')).resolves.toMatchObject({ status: '建议暂停' });
  });

  test('抑制窗口内不重复生成同一规则与对象信号', async () => {
    const { execution } = createFixture();
    const sample = {
      source: 'GDS' as const,
      subjectId: 'GDS-101',
      areaId: 'area-02',
      occurredAt: '2026-07-15T08:00:00.000Z',
      metrics: { 'GDS.currentValue': 55 },
    };
    await execution.evaluate(sample);
    const repeated = await execution.evaluate({
      ...sample,
      occurredAt: '2026-07-15T08:01:00.000Z',
    });
    expect(repeated.triggeredSignals).toHaveLength(0);
    expect(repeated.suppressedRuleIds).toContain('rule-001');
    await expect(execution.listSignals()).resolves.toHaveLength(1);
  });

  test('连续时间达到后才触发趋势规则', async () => {
    const { execution } = createFixture();
    const base = {
      source: 'GDS' as const,
      subjectId: 'GDS-TREND-01',
      areaId: 'area-03',
      metrics: { 'GDS.currentValue': 20 },
    };
    const first = await execution.evaluate({ ...base, occurredAt: '2026-07-15T08:00:00.000Z' });
    expect(first.triggeredSignals).toHaveLength(0);
    const ready = await execution.evaluate({ ...base, occurredAt: '2026-07-15T08:05:00.000Z' });
    expect(ready.triggeredSignals.map((signal) => signal.ruleId)).toEqual(['rule-004']);
  });

  test('联合指标在时间窗口内满足时触发联合预警', async () => {
    const { execution } = createFixture();
    const result = await execution.evaluate({
      source: '联合预警',
      subjectId: 'FCC-P208',
      areaId: 'area-02',
      occurredAt: '2026-07-15T08:00:00.000Z',
      metrics: { 'GDS.trend': 'up', 'MES.pressure': 'critical' },
    });
    expect(result.triggeredSignals).toHaveLength(1);
    expect(result.triggeredSignals[0]).toMatchObject({ ruleId: 'rule-003', level: 'critical' });
  });

  test('规则触发统计独立更新且不改变配置修订号', async () => {
    const { execution, rules } = createFixture();
    await execution.evaluate({
      source: 'GDS',
      subjectId: 'GDS-102',
      areaId: 'area-01',
      occurredAt: '2026-07-15T08:00:00.000Z',
      metrics: { 'GDS.currentValue': 55 },
    });
    await expect(rules.get('rule-001')).resolves.toMatchObject({ triggerCount: 13, revision: 1 });
  });
});
