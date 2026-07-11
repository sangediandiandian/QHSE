import type { DashboardData } from '@/types/qhse';
import { withSimulatedGdsAlarm } from './dashboardScenario';

const baseDashboard: DashboardData = {
  updatedAt: 'before',
  metrics: {
    overallRisk: '一般风险',
    onlineUnits: 8,
    gdsOnlineRate: 96.7,
    activeAlarms: 3,
    vocComplianceRate: 98.6,
    mesAnomalies: 2,
    pendingWarnings: 4,
    highRiskPermits: 2,
    deliveryRate: 94.8,
  },
  areas: [
    {
      id: 'area-01',
      code: 'CDU',
      name: '常减压装置',
      shortName: '常减压',
      riskLevel: 'medium',
      status: 'warning',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    },
  ],
  alarms: [],
  trend: [{ label: '08:30', gds: 20, voc: 50, mes: 55 }],
};

describe('withSimulatedGdsAlarm', () => {
  it('生成唯一告警并同步更新风险、指标和趋势', () => {
    const result = withSimulatedGdsAlarm(baseDashboard, '08:40:00', 'updated');

    expect(result.metrics.overallRisk).toBe('较大风险');
    expect(result.metrics.activeAlarms).toBe(4);
    expect(result.areas[0]).toMatchObject({ riskLevel: 'critical', status: 'alarm' });
    expect(result.alarms[0]).toMatchObject({ id: 'evt-simulated', value: '45% LEL' });
    expect(result.trend[0]).toMatchObject({ gds: 45, mes: 71 });
  });

  it('重复触发不会重复生成事件', () => {
    const first = withSimulatedGdsAlarm(baseDashboard, '08:40:00', 'updated');
    expect(withSimulatedGdsAlarm(first, '08:41:00', 'updated-again')).toBe(first);
  });
});
