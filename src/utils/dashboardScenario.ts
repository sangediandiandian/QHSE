import type { DashboardData } from '@/types/qhse';

export function withSimulatedGdsAlarm(
  current: DashboardData,
  occurredAt: string,
  updatedAt: string,
) {
  if (current.alarms.some((alarm) => alarm.id === 'evt-simulated')) return current;

  return {
    ...current,
    updatedAt,
    metrics: {
      ...current.metrics,
      overallRisk: '较大风险' as const,
      activeAlarms: current.metrics.activeAlarms + 1,
      pendingWarnings: current.metrics.pendingWarnings + 1,
    },
    areas: current.areas.map((area) =>
      area.id === 'area-01'
        ? { ...area, riskLevel: 'critical' as const, status: 'alarm' as const }
        : area,
    ),
    alarms: [
      {
        id: 'evt-simulated',
        code: 'W20260711004',
        title: 'GDS-101 可燃气体二级报警',
        source: 'GDS' as const,
        areaId: 'area-01',
        areaName: '常减压装置',
        level: 'critical' as const,
        value: '45% LEL',
        occurredAt,
        status: '待确认' as const,
      },
      ...current.alarms,
    ],
    trend: current.trend.map((point, index) =>
      index === current.trend.length - 1 ? { ...point, gds: 45, mes: 71 } : point,
    ),
  };
}
