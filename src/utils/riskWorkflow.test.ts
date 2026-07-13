import type { RiskUnit } from '@/types/qhse';
import { assessRiskUnit, getLecRiskLevel, saveRiskControls } from './riskWorkflow';

const unit = {
  id: 'risk-1', code: 'RU-01', name: '泵区', parentName: '一号装置', areaId: 'area-1', areaName: '一号装置',
  ownerDepartment: '运行部', owner: '李强', medium: '油气', accidentTypes: ['泄漏'], staticLevel: 'high',
  currentLevel: 'high', controls: ['巡检'], linkedGds: 1, linkedVoc: 0, linkedMes: 1, linkedPlans: 1, dynamicFactors: [],
} as RiskUnit;

describe('riskWorkflow', () => {
  test('LEC 分值映射风险等级', () => {
    expect(getLecRiskLevel(50)).toBe('low');
    expect(getLecRiskLevel(100)).toBe('medium');
    expect(getLecRiskLevel(200)).toBe('high');
    expect(getLecRiskLevel(400)).toBe('critical');
  });

  test('风险评估更新实时等级并保留评估记录', () => {
    const next = assessRiskUnit(unit, { likelihood: 10, exposure: 6, consequence: 7, assessor: '赵磊', basis: '现场复核' }, 'assessment-1', '2026-07-14 09:00:00');
    expect(next).toMatchObject({ currentLevel: 'critical' });
    expect(next.assessments?.[0]).toMatchObject({ score: 420, level: 'critical', method: 'LEC' });
  });

  test('维护管控措施同时生成责任和有效性记录', () => {
    const next = saveRiskControls(unit, [{ content: '  每班巡检  ', owner: '李强', status: '有效' }], '2026-07-14 09:10:00');
    expect(next.controls).toEqual(['每班巡检']);
    expect(next.controlRecords?.[0]).toMatchObject({ owner: '李强', status: '有效' });
  });
});
