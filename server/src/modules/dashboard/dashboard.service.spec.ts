/** @jest-environment node */

import type { CommunicationService } from '../communications/communication.service';
import type { EmergencyEventService } from '../emergency-events/emergency-event.service';
import type { EmergencyResourceService } from '../emergency-resources/emergency-resource.service';
import type { IamService } from '../iam/iam.service';
import type { RiskService } from '../risks/risk.service';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type { WarningExecutionService } from '../warning-execution/warning-execution.service';
import { DashboardService } from './dashboard.service';

const timestamp = '2026-07-15T08:00:00.000Z';
const point = (id: string, areaId: string, source: 'GDS' | 'VOC' | 'MES', status: string) => ({
  id,
  code: id.toUpperCase(),
  source,
  name: `${source} 点位`,
  areaId,
  areaName: areaId === 'area-02' ? '催化裂化装置' : '硫磺回收装置',
  equipmentName: '设备',
  metricKey: 'value',
  unit: source === 'GDS' ? '%LEL' : 'mg/m³',
  configuration:
    source === 'GDS'
      ? { gasType: '可燃气体', alarmLevel1: 25, alarmLevel2: 40 }
      : source === 'VOC'
        ? { pointType: '有组织排口', pollutantType: '非甲烷总烃', limitValue: 60 }
        : { processStep: '进料', parameterType: '压力', lowerLimit: 0, upperLimit: 10 },
  currentMetrics: { value: status === 'normal' ? 10 : 50, flow: 100 },
  status,
  onlineStatus: 'online',
  lastSampleAt: timestamp,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
});

function createService() {
  const telemetry = {
    listPoints: jest
      .fn()
      .mockResolvedValue([
        point('gds-1', 'area-02', 'GDS', 'level2'),
        point('voc-1', 'area-04', 'VOC', 'normal'),
      ]),
  };
  const risks = {
    list: jest.fn().mockResolvedValue([
      { id: 'risk-1', areaId: 'area-02', currentLevel: 'critical' },
      { id: 'risk-2', areaId: 'area-04', currentLevel: 'medium' },
    ]),
  };
  const warnings = {
    listSignals: jest.fn().mockResolvedValue([
      {
        id: 'warning-1',
        code: 'WARN-1',
        subjectId: 'gds-1',
        areaId: 'area-02',
        source: 'GDS',
        level: 'critical',
        title: '二级报警',
        detail: '50 %LEL',
        occurredAt: timestamp,
        status: 'active',
        operations: [],
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'warning-2',
        code: 'WARN-2',
        subjectId: 'voc-1',
        areaId: 'area-04',
        source: 'VOC',
        level: 'medium',
        title: '区域外预警',
        detail: '40 mg/m³',
        occurredAt: timestamp,
        status: 'active',
        operations: [],
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]),
  };
  const communications = {
    list: jest.fn().mockResolvedValue([
      {
        areaName: '催化裂化装置',
        tasks: [{ id: 'task-1', deliveryStatus: '已送达', confirmStatus: '已确认' }],
      },
      {
        areaName: '硫磺回收装置',
        tasks: [{ id: 'task-2', deliveryStatus: '失败', confirmStatus: '未确认' }],
      },
    ]),
  };
  const resources = { list: jest.fn().mockResolvedValue([]) };
  const emergencies = {
    list: jest.fn().mockResolvedValue([
      {
        id: 'event-1',
        eventId: 'evt-1',
        code: 'EC-1',
        title: '泄漏事件',
        areaId: 'area-02',
        areaName: '催化裂化装置',
        source: 'GDS',
        status: '响应中',
        responseLevel: 'II级',
        commander: '现场指挥',
        ownerDepartment: '催化裂化装置',
        startedAt: timestamp,
        updatedAt: timestamp,
        createdAt: timestamp,
        summary: '测试',
        version: 1,
        evidence: [],
        operations: [
          {
            id: 'op-1',
            action: '研判启动',
            operator: '调度',
            operatedAt: timestamp,
            toStatus: '响应中',
            toLevel: 'II级',
            detail: '启动现场处置',
          },
        ],
      },
      { id: 'event-2', areaId: 'area-04', status: '响应中', updatedAt: timestamp },
    ]),
  };
  const iam = {
    listOrganizations: jest.fn().mockReturnValue([
      {
        areas: [
          { id: 'area-02', code: 'FCC', name: '催化裂化装置', organizationId: 'org-fcc' },
          { id: 'area-04', code: 'SRU', name: '硫磺回收装置', organizationId: 'org-env' },
        ],
      },
    ]),
  };
  const service = new DashboardService(
    telemetry as unknown as TelemetryService,
    risks as unknown as RiskService,
    warnings as unknown as WarningExecutionService,
    communications as unknown as CommunicationService,
    resources as unknown as EmergencyResourceService,
    emergencies as unknown as EmergencyEventService,
    iam as unknown as IamService,
    () => new Date(timestamp),
  );
  return { service, telemetry, risks, emergencies };
}

describe('DashboardService', () => {
  test('按账号区域生成驾驶舱快照并过滤跨区域数据', async () => {
    const { service, telemetry, risks, emergencies } = createService();
    const result = await service.snapshot(['area-02']);

    expect(telemetry.listPoints).toHaveBeenCalledWith({}, ['area-02']);
    expect(risks.list).toHaveBeenCalledWith({}, ['area-02']);
    expect(emergencies.list).toHaveBeenCalledWith({}, ['area-02']);
    expect(result.areas.map((area) => area.id)).toEqual(['area-02']);
    expect(result.gdsPoints).toHaveLength(1);
    expect(result.vocPoints).toHaveLength(0);
    expect(result.riskUnits).toHaveLength(1);
    expect(result.emergencyEvents).toHaveLength(1);
    expect(result.alarms).toHaveLength(1);
    expect(result.communicationTasks.map((task) => task.id)).toEqual(['task-1']);
    expect(result.metrics).toMatchObject({
      overallRisk: '重大风险',
      gdsOnlineRate: 100,
      activeAlarms: 1,
      pendingWarnings: 1,
      deliveryRate: 100,
    });
    expect(result.emergencyPlan).toMatchObject({ eventId: 'evt-1', status: '已启动' });
    expect(result.emergencyTasks).toEqual([
      expect.objectContaining({ id: 'op-1', status: '执行中' }),
    ]);
  });

  test('没有活动事件时返回明确的待命视图', async () => {
    const { service, emergencies } = createService();
    emergencies.list.mockResolvedValue([]);

    const result = await service.snapshot(['area-02']);

    expect(result.emergencyPlan).toMatchObject({ id: 'none', status: '推荐' });
    expect(result.emergencyTasks).toEqual([]);
    expect(result.trend).toHaveLength(6);
    expect(result.updatedAt).toBe(timestamp);
  });
});
