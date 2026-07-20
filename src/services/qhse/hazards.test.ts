/** @jest-environment node */

import { request } from '@umijs/max';
import { checkHazardDuplicates, runHazardReminders } from './hazards';

jest.mock('@umijs/max', () => ({ request: jest.fn() }));

const requestMock = request as jest.Mock;

describe('hazard API client', () => {
  beforeEach(() => requestMock.mockReset());

  test('检查同风险单元和类别的历史重复隐患', async () => {
    const candidates = [
      {
        id: 'hazard-001',
        code: 'YH20260711001',
        title: 'P-208 同类高温泵法兰垫片选型待复核',
        status: '整改中',
        areaName: '催化裂化装置',
        deadline: '2026-07-15',
        similarity: 88,
      },
    ];
    requestMock.mockResolvedValue({ data: candidates });
    const input = {
      title: 'P-208 高温泵法兰垫片选型复核',
      riskUnitId: 'risk-001',
      category: '设备完整性',
    };

    await expect(checkHazardDuplicates(input)).resolves.toBe(candidates);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/hazards/duplicates/check', {
      method: 'POST',
      data: input,
    });
  });

  test('执行服务端隐患催办扫描并返回摘要', async () => {
    const result = {
      scanned: 6,
      created: 5,
      skipped: 1,
      failed: 0,
      runAt: '2026-07-15T08:00:00.000Z',
    };
    requestMock.mockResolvedValue({ data: result });

    await expect(runHazardReminders()).resolves.toBe(result);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/hazards/reminders/run', {
      method: 'POST',
    });
  });
});
