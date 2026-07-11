import type { DashboardData } from '@/types/qhse';
import { withAlarmStatus, withSimulatedGdsAlarm } from './dashboardScenario';

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
  gdsPoints: [
    {
      id: 'gds-101', code: 'GDS-101', name: '泵区探测器', areaId: 'area-01',
      areaName: '常减压装置', equipmentName: 'P-101 机泵', gasType: '可燃气体',
      currentValue: 8, unit: '%LEL', alarmLevel1: 25, alarmLevel2: 40,
      onlineStatus: 'online', alarmStatus: 'normal', trend: [4, 5, 6, 8],
    },
  ],
};

describe('withSimulatedGdsAlarm', () => {
  it('生成唯一告警并同步更新风险、指标和趋势', () => {
    const result = withSimulatedGdsAlarm(baseDashboard, '08:40:00', 'updated');

    expect(result.metrics.overallRisk).toBe('较大风险');
    expect(result.metrics.activeAlarms).toBe(4);
    expect(result.areas[0]).toMatchObject({ riskLevel: 'critical', status: 'alarm' });
    expect(result.alarms[0]).toMatchObject({ id: 'evt-simulated', value: '45% LEL' });
    expect(result.trend[0]).toMatchObject({ gds: 45, mes: 71 });
    expect(result.gdsPoints[0]).toMatchObject({ currentValue: 45, alarmStatus: 'level2' });
  });

  it('重复触发不会重复生成事件', () => {
    const first = withSimulatedGdsAlarm(baseDashboard, '08:40:00', 'updated');
    expect(withSimulatedGdsAlarm(first, '08:41:00', 'updated-again')).toBe(first);
  });

  it('确认事件时只更新目标事件并减少待确认数量', () => {
    const dashboard = {
      ...baseDashboard,
      alarms: [{
        id: 'evt-1', code: 'W001', title: '测试事件', source: 'GDS' as const,
        areaId: 'area-01', areaName: '常减压装置', level: 'high' as const,
        value: '38% LEL', occurredAt: '08:30:00', status: '待确认' as const,
      }],
    };
    const result = withAlarmStatus(dashboard, 'evt-1', '已确认');

    expect(result.alarms[0].status).toBe('已确认');
    expect(result.metrics.pendingWarnings).toBe(3);
  });
});
