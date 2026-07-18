/** @jest-environment node */

import { request } from '@umijs/max';
import { runHazardReminders } from './hazards';

jest.mock('@umijs/max', () => ({ request: jest.fn() }));

const requestMock = request as jest.Mock;

describe('hazard API client', () => {
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
