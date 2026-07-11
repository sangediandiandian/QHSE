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
    gdsPoints: current.gdsPoints.map((point) =>
      point.id === 'gds-101'
        ? {
            ...point,
            currentValue: 45,
            alarmStatus: 'level2' as const,
            trend: [8, 12, 18, 26, 36, 45],
          }
        : point,
    ),
  };
}

export function withAlarmStatus(
  current: DashboardData,
  eventId: string,
  status: '已确认' | '处置中',
) {
  return {
    ...current,
    alarms: current.alarms.map((alarm) => (alarm.id === eventId ? { ...alarm, status } : alarm)),
    metrics: {
      ...current.metrics,
      pendingWarnings:
        status === '已确认'
          ? Math.max(0, current.metrics.pendingWarnings - 1)
          : current.metrics.pendingWarnings,
    },
  };
}

export function withSimulatedVocAlarm(
  current: DashboardData,
  occurredAt: string,
  updatedAt: string,
) {
  if (current.alarms.some((alarm) => alarm.id === 'evt-voc-simulated')) return current;

  return {
    ...current,
    updatedAt,
    metrics: {
      ...current.metrics,
      activeAlarms: current.metrics.activeAlarms + 1,
      pendingWarnings: current.metrics.pendingWarnings + 1,
      vocComplianceRate: 87.5,
    },
    alarms: [
      {
        id: 'evt-voc-simulated', code: 'W20260711005', title: 'RTO 出口 VOC 连续超限',
        source: 'VOC' as const, areaId: 'area-04', areaName: '硫磺回收装置',
        level: 'high' as const, value: '86 mg/m³', occurredAt, status: '待确认' as const,
      },
      ...current.alarms,
    ],
    trend: current.trend.map((point, index) =>
      index === current.trend.length - 1 ? { ...point, voc: 86, mes: 78 } : point,
    ),
    vocPoints: current.vocPoints.map((point) => point.id === 'voc-stack-01'
      ? { ...point, currentValue: 86, status: 'exceeded' as const, trend: [38, 46, 55, 66, 77, 86] }
      : point),
    vocFacilities: current.vocFacilities.map((facility) => facility.id === 'facility-rto-01'
      ? {
          ...facility, outletValue: 86, efficiency: 62.1, temperature: 641,
          fanStatus: '故障' as const, status: 'fault' as const,
        }
      : facility),
  };
}

export function withSimulatedJointAlarm(
  current: DashboardData,
  occurredAt: string,
  updatedAt: string,
) {
  if (current.alarms.some((alarm) => alarm.id === 'evt-joint-simulated')) return current;

  return {
    ...current,
    updatedAt,
    metrics: {
      ...current.metrics,
      overallRisk: '重大风险' as const,
      activeAlarms: current.metrics.activeAlarms + 1,
      pendingWarnings: current.metrics.pendingWarnings + 1,
      mesAnomalies: current.metrics.mesAnomalies + 2,
    },
    areas: current.areas.map((area) => area.id === 'area-01'
      ? { ...area, riskLevel: 'critical' as const, status: 'alarm' as const }
      : area),
    alarms: [
      {
        id: 'evt-joint-simulated', code: 'W20260711006',
        title: 'GDS 与 MES 联合预警：疑似介质泄漏', source: '联合预警' as const,
        areaId: 'area-01', areaName: '常减压装置', level: 'critical' as const,
        value: '36% LEL / 2.68 MPa', occurredAt, status: '待确认' as const,
      },
      ...current.alarms,
    ],
    mesTags: current.mesTags.map((tag) => {
      if (tag.id === 'mes-pt-101') return { ...tag, currentValue: 2.68, status: 'alarm' as const, trend: [2.18, 2.24, 2.31, 2.42, 2.55, 2.68] };
      if (tag.id === 'mes-ft-101') return { ...tag, currentValue: 68, status: 'alarm' as const, trend: [102, 98, 91, 83, 75, 68] };
      return tag;
    }),
    mesUnits: current.mesUnits.map((unit) => unit.id === 'mes-unit-01'
      ? { ...unit, load: 72, operatingMode: '异常降负荷', status: 'alarm' as const }
      : unit),
    gdsPoints: current.gdsPoints.map((point) => point.id === 'gds-101'
      ? { ...point, currentValue: 36, alarmStatus: 'level1' as const, trend: [8, 11, 16, 22, 29, 36] }
      : point),
    trend: current.trend.map((point, index) => index === current.trend.length - 1
      ? { ...point, gds: 36, mes: 84 }
      : point),
  };
}
