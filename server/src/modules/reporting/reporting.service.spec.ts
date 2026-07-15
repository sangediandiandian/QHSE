/** @jest-environment node */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EmergencyEventService } from '../emergency-events/emergency-event.service';
import type { EmergencyEvent } from '../emergency-events/emergency-event.types';
import type { HazardService } from '../hazards/hazard.service';
import type { Hazard } from '../hazards/hazard.types';
import type { WarningExecutionService } from '../warning-execution/warning-execution.service';
import type { WarningSignal } from '../warning-execution/warning-execution.types';
import type { WorkPermitService } from '../work-permits/work-permit.service';
import type { WorkPermit } from '../work-permits/work-permit.types';
import { ReportingService } from './reporting.service';

const hazards = [
  {
    id: 'hazard-1',
    areaId: 'area-02',
    areaName: '催化,装置',
    status: '整改中',
    overdue: true,
    createdAt: '2026-07-11T08:00:00.000Z',
    operations: [],
  },
  {
    id: 'hazard-2',
    areaId: 'area-01',
    areaName: '常减压装置',
    status: '已关闭',
    overdue: false,
    createdAt: '2026-07-10T08:00:00.000Z',
    operations: [{ action: '验收关闭', operatedAt: '2026-07-12T08:00:00.000Z' }],
  },
] as Hazard[];

const permits = [
  {
    id: 'permit-1',
    areaId: 'area-02',
    areaName: '催化,装置',
    status: '作业中',
    createdAt: '2026-07-11T09:00:00.000Z',
  },
] as WorkPermit[];

const signals = [
  {
    id: 'signal-1',
    areaId: 'area-02',
    level: 'critical',
    status: 'active',
    occurredAt: '2026-07-13T09:00:00.000Z',
  },
] as WarningSignal[];

const emergencies = [
  {
    id: 'event-1',
    areaId: 'area-02',
    areaName: '催化,装置',
    status: '响应中',
    createdAt: '2026-07-14T09:00:00.000Z',
    operations: [],
  },
] as unknown as EmergencyEvent[];

function createService(signalData = signals) {
  return new ReportingService(
    { list: jest.fn().mockResolvedValue(hazards) } as unknown as HazardService,
    { list: jest.fn().mockResolvedValue(permits) } as unknown as WorkPermitService,
    { listSignals: jest.fn().mockResolvedValue(signalData) } as unknown as WarningExecutionService,
    { list: jest.fn().mockResolvedValue(emergencies) } as unknown as EmergencyEventService,
    () => new Date('2026-07-15T08:00:00.000Z'),
  );
}

describe('ReportingService', () => {
  test('按统计周期和账号区域聚合业务指标', async () => {
    const report = await createService().summary({ from: '2026-07-10', to: '2026-07-15' }, [
      'area-02',
    ]);

    expect(report.hazards).toMatchObject({ total: 1, open: 1, overdue: 1, rate: 0 });
    expect(report.warnings).toMatchObject({ total: 1, active: 1, critical: 1 });
    expect(report.permits).toMatchObject({ total: 1, active: 1 });
    expect(report.emergencies).toMatchObject({ total: 1, open: 1 });
    expect(report.areas).toEqual([
      expect.objectContaining({
        areaId: 'area-02',
        hazardOpen: 1,
        warningCritical: 1,
        permitActive: 1,
        emergencyOpen: 1,
        riskIndex: 17,
      }),
    ]);
    expect(report.trend.find((item) => item.date === '2026-07-13')).toMatchObject({
      warningTriggered: 1,
    });
  });

  test('区域筛选不能越过账号数据范围', async () => {
    await expect(
      createService().summary({ from: '2026-07-10', to: '2026-07-15', areaId: 'area-01' }, [
        'area-02',
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  test('拒绝倒置日期和超过 366 天的统计范围', async () => {
    await expect(
      createService().summary({ from: '2026-07-15', to: '2026-07-10' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      createService().summary({ from: '2025-01-01', to: '2026-07-15' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      createService().summary({ from: '2026-07-15', to: '2026-07-16' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('拒绝返回可能被截断的超量预警聚合', async () => {
    await expect(
      createService(Array.from({ length: 10_001 }, () => signals[0])).summary({
        from: '2026-07-10',
        to: '2026-07-15',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REPORT_DATA_LIMIT_EXCEEDED' }),
    });
  });

  test('导出 UTF-8 BOM CSV 并正确转义区域名称', async () => {
    const csv = (
      await createService().csv({ from: '2026-07-10', to: '2026-07-15' }, ['area-02'])
    ).toString('utf8');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"area-02","催化,装置"');
    expect(csv).toContain('"17"');
  });
});
