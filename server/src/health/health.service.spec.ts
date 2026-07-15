/** @jest-environment node */

import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { CacheService } from '../infrastructure/cache/cache.service';
import type { SessionStoreService } from '../infrastructure/session/session-store.service';
import type { ReportExportQueueService } from '../modules/reporting/report-export-queue.service';
import { HealthService } from './health.service';

const dependency = (backend = 'memory') => ({
  snapshot: () => ({ backend }),
  check: jest.fn().mockResolvedValue(undefined),
});

function createService(cache = dependency()) {
  return new HealthService(
    { $queryRawUnsafe: jest.fn() } as unknown as PrismaService,
    cache as unknown as CacheService,
    dependency() as unknown as SessionStoreService,
    dependency() as unknown as ReportExportQueueService,
  );
}

describe('HealthService', () => {
  const originalRepository = process.env.QHSE_REPOSITORY;
  const originalTimeout = process.env.QHSE_READINESS_TIMEOUT_MS;

  afterEach(() => {
    if (originalRepository === undefined) delete process.env.QHSE_REPOSITORY;
    else process.env.QHSE_REPOSITORY = originalRepository;
    if (originalTimeout === undefined) delete process.env.QHSE_READINESS_TIMEOUT_MS;
    else process.env.QHSE_READINESS_TIMEOUT_MS = originalTimeout;
    jest.useRealTimers();
  });

  test('内存依赖全部可用时返回 ready', async () => {
    delete process.env.QHSE_REPOSITORY;
    const service = createService();
    await expect(service.readiness()).resolves.toMatchObject({
      status: 'ready',
      checks: [
        { name: 'database', backend: 'memory', status: 'ready' },
        { name: 'cache', status: 'ready' },
        { name: 'sessions', status: 'ready' },
        { name: 'queue', status: 'ready' },
      ],
    });
  });

  test('任一生产依赖失败时返回服务未就绪且不暴露内部错误', async () => {
    const cache = dependency('redis');
    cache.check.mockRejectedValue(new Error('redis password=secret'));
    const service = createService(cache);
    await expect(service.readiness()).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: 'SERVICE_NOT_READY' }),
    });
  });

  test('依赖检查超时后按未就绪收敛', async () => {
    jest.useFakeTimers();
    process.env.QHSE_READINESS_TIMEOUT_MS = '100';
    const cache = dependency('redis');
    cache.check.mockImplementation(() => new Promise(() => {}));
    const service = createService(cache);
    const result = service.readiness().catch((error) => error);
    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBeInstanceOf(ServiceUnavailableException);
  });
});
