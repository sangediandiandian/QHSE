import type { DashboardData } from '@/types/qhse';
import {
  withAlarmStatus,
  withCommunicationConfirmation,
  withCommunicationEscalation,
  withSimulatedGdsAlarm,
  withSimulatedJointAlarm,
  withSimulatedVocAlarm,
} from './dashboardScenario';

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
  vocPoints: [{
    id: 'voc-stack-01', code: 'VOC-EX-01', name: 'RTO 一号排口', pointType: '有组织排口',
    areaId: 'area-04', areaName: '硫磺回收装置', pollutantType: '非甲烷总烃',
    currentValue: 38, limitValue: 60, flowValue: 18500, facilityId: 'facility-rto-01',
    status: 'normal', trend: [20, 25, 31, 38],
  }],
  vocFacilities: [{
    id: 'facility-rto-01', code: 'RTO-01', name: '一号蓄热式氧化炉', processType: 'RTO',
    areaName: '硫磺回收装置', inletValue: 286, outletValue: 38, efficiency: 86.7,
    temperature: 782, fanStatus: '运行', valveStatus: '开启', status: 'normal',
  }],
  mesTags: [
    {
      id: 'mes-pt-101', code: 'PT-101', name: '进料泵出口压力', unitId: 'mes-unit-01',
      unitName: '常减压装置', equipmentName: 'P-101 进料泵', processStep: '进料',
      parameterType: '压力', currentValue: 2.18, unit: 'MPa', upperLimit: 2.4,
      lowerLimit: 1.6, status: 'normal', trend: [2.1, 2.18],
    },
    {
      id: 'mes-ft-101', code: 'FT-101', name: '原油进料流量', unitId: 'mes-unit-01',
      unitName: '常减压装置', equipmentName: 'P-101 进料泵', processStep: '进料',
      parameterType: '流量', currentValue: 102, unit: 't/h', upperLimit: 118,
      lowerLimit: 82, status: 'normal', trend: [101, 102],
    },
  ],
  mesUnits: [{
    id: 'mes-unit-01', code: 'CDU', name: '常减压装置', load: 86,
    operatingMode: '稳定运行', status: 'normal',
  }],
  communicationTasks: [],
  emergencyPlan: {
    id: 'plan-test', code: 'PLAN-TEST', name: '测试预案', eventId: 'evt-test',
    responseLevel: 'II级', matchScore: 90, matchReason: '测试匹配',
    commander: '测试指挥', assemblyPoint: '测试集合点', status: '推荐',
  },
  emergencyPlans: [],
  emergencyTasks: [],
  emergencyResources: [],
  eventReviews: [],
  riskUnits: [],
  hazards: [],
  workPermits: [],
  warningRules: [],
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

describe('withSimulatedVocAlarm', () => {
  it('连续超限时同步更新排口、治理设施和预警事件', () => {
    const result = withSimulatedVocAlarm(baseDashboard, '09:00:00', 'updated');

    expect(result.vocPoints[0]).toMatchObject({ currentValue: 86, status: 'exceeded' });
    expect(result.vocFacilities[0]).toMatchObject({ efficiency: 62.1, fanStatus: '故障' });
    expect(result.alarms[0]).toMatchObject({ id: 'evt-voc-simulated', source: 'VOC' });
    expect(result.metrics.vocComplianceRate).toBe(87.5);
  });
});

describe('withSimulatedJointAlarm', () => {
  it('联合异常时关联 MES、GDS 并升级为重大预警', () => {
    const result = withSimulatedJointAlarm(baseDashboard, '09:10:00', 'updated');

    expect(result.mesTags[0]).toMatchObject({ currentValue: 2.68, status: 'alarm' });
    expect(result.mesTags[1]).toMatchObject({ currentValue: 68, status: 'alarm' });
    expect(result.gdsPoints[0]).toMatchObject({ currentValue: 36, alarmStatus: 'level1' });
    expect(result.alarms[0]).toMatchObject({ source: '联合预警', level: 'critical' });
    expect(result.metrics.overallRisk).toBe('重大风险');
  });
});

describe('communication escalation', () => {
  it('未确认时依次升级到重呼、班长和负责人/调度', () => {
    const dashboard: DashboardData = {
      ...baseDashboard,
      alarms: [{
        id: 'evt-1', code: 'W001', title: '测试事件', source: 'GDS',
        areaId: 'area-01', areaName: '常减压装置', level: 'high',
        value: '38% LEL', occurredAt: '08:30:00', status: '待确认',
      }],
      communicationTasks: [{
        id: 'comm-base', eventId: 'evt-1', eventTitle: '测试事件', receiver: '王强',
        receiverRole: '岗位操作员', channel: 'App消息', sendTime: '08:30:00',
        deliveryStatus: '已送达', confirmStatus: '未确认', retryCount: 0, escalationLevel: 0,
      }],
    };
    const level1 = withCommunicationEscalation(dashboard, 'evt-1', '08:32:00');
    const level2 = withCommunicationEscalation(level1, 'evt-1', '08:33:00');
    const level3 = withCommunicationEscalation(level2, 'evt-1', '08:35:00');

    expect(level1.communicationTasks[0]).toMatchObject({ escalationLevel: 1, retryCount: 1 });
    expect(level2.communicationTasks[0]).toMatchObject({ receiverRole: '当班班长', escalationLevel: 2 });
    expect(level3.communicationTasks.filter((task) => task.escalationLevel === 3)).toHaveLength(2);
  });

  it('人员确认后停止继续升级', () => {
    const dashboard: DashboardData = {
      ...baseDashboard,
      alarms: [{
        id: 'evt-1', code: 'W001', title: '测试事件', source: 'GDS',
        areaId: 'area-01', areaName: '常减压装置', level: 'high',
        value: '38% LEL', occurredAt: '08:30:00', status: '待确认',
      }],
      communicationTasks: [{
        id: 'comm-base', eventId: 'evt-1', eventTitle: '测试事件', receiver: '王强',
        receiverRole: '岗位操作员', channel: 'App消息', sendTime: '08:30:00',
        deliveryStatus: '已送达', confirmStatus: '未确认', retryCount: 0, escalationLevel: 0,
      }],
    };
    const confirmed = withCommunicationConfirmation(dashboard, 'comm-base', '08:31:00');
    expect(withCommunicationEscalation(confirmed, 'evt-1', '08:32:00')).toBe(confirmed);
  });
});
