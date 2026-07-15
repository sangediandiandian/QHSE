/** @jest-environment node */

import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ReportingService } from './reporting.service';
import { ReportExportQueueService } from './report-export-queue.service';

const nextTurn = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

describe('ReportExportQueueService', () => {
  const originalMode = process.env.QHSE_QUEUE;

  beforeEach(() => delete process.env.QHSE_QUEUE);
  afterAll(() => {
    if (originalMode === undefined) delete process.env.QHSE_QUEUE;
    else process.env.QHSE_QUEUE = originalMode;
  });

  test('后台生成 CSV、查询状态并按创建人下载', async () => {
    const reports = {
      csv: jest.fn().mockResolvedValue(Buffer.from('csv')),
    } as unknown as ReportingService;
    const service = new ReportExportQueueService(reports);
    const job = await service.create({ ownerId: 'user-a', query: { from: '2026-07-01' } });
    await expect(service.content(job.id, 'user-a')).rejects.toThrow(ConflictException);
    await nextTurn();
    await expect(service.get(job.id, 'user-a')).resolves.toMatchObject({ status: 'completed' });
    await expect(service.content(job.id, 'user-a')).resolves.toMatchObject({
      body: Buffer.from('csv'),
    });
    await expect(service.get(job.id, 'user-b')).rejects.toThrow(NotFoundException);
  });

  test('失败任务最多重试三次后成功', async () => {
    const reports = {
      csv: jest
        .fn()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValue(Buffer.from('ok')),
    } as unknown as ReportingService;
    const service = new ReportExportQueueService(reports);
    const job = await service.create({ ownerId: 'user-a', query: {} });
    await nextTurn();
    await expect(service.get(job.id, 'user-a')).resolves.toMatchObject({ status: 'completed' });
    expect(reports.csv).toHaveBeenCalledTimes(3);
  });

  test('连续失败三次后标记失败且不返回内部错误', async () => {
    const reports = {
      csv: jest.fn().mockRejectedValue(new Error('secret')),
    } as unknown as ReportingService;
    const service = new ReportExportQueueService(reports);
    const job = await service.create({ ownerId: 'user-a', query: {} });
    await nextTurn();
    const metadata = await service.get(job.id, 'user-a');
    expect(metadata).toMatchObject({ status: 'failed' });
    expect(metadata).not.toHaveProperty('error');
  });
});
