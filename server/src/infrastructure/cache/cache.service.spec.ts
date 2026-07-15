/** @jest-environment node */

import { CacheService } from './cache.service';
import { MemoryCacheStore } from './memory-cache.store';
import type { CacheStore } from './cache-store';

describe('CacheService', () => {
  test('命中缓存时不重复执行加载器且返回隔离副本', async () => {
    const service = new CacheService(new MemoryCacheStore());
    const loader = jest.fn().mockResolvedValue({ total: 3 });
    const first = await service.getOrLoad<{ total: number }>('reports', 'all', 1_000, loader);
    first.total = 99;
    await expect(
      service.getOrLoad<{ total: number }>('reports', 'all', 1_000, loader),
    ).resolves.toEqual({ total: 3 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(service.snapshot()).toMatchObject({ hits: 1, misses: 1, writes: 1 });
  });

  test('过期后重新加载', async () => {
    let now = 0;
    const service = new CacheService(new MemoryCacheStore(() => now));
    const loader = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    await expect(service.getOrLoad('reports', 'all', 10, loader)).resolves.toBe('v1');
    now = 11;
    await expect(service.getOrLoad('reports', 'all', 10, loader)).resolves.toBe('v2');
  });

  test('相同键的并发未命中只执行一次加载器', async () => {
    const service = new CacheService(new MemoryCacheStore());
    const loader = jest.fn(async () => ({ generated: true }));
    const values = await Promise.all([
      service.getOrLoad('reports', 'same', 1_000, loader),
      service.getOrLoad('reports', 'same', 1_000, loader),
    ]);
    expect(values).toEqual([{ generated: true }, { generated: true }]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('按命名空间失效后重新加载所有授权范围', async () => {
    const service = new CacheService(new MemoryCacheStore());
    const loader = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    await expect(service.getOrLoad('dashboard', 'area-02', 1_000, loader)).resolves.toBe('v1');
    await service.invalidate('dashboard');
    await expect(service.getOrLoad('dashboard', 'area-02', 1_000, loader)).resolves.toBe('v2');
    expect(service.snapshot()).toMatchObject({ invalidations: 1 });
  });

  test('缓存后端故障时回源并短时熔断后续访问', async () => {
    const store = {
      backend: 'redis',
      get: jest.fn().mockRejectedValue(new Error('offline')),
      set: jest.fn(),
      deleteByPrefix: jest.fn(),
      ping: jest.fn(),
      close: jest.fn(),
    } as unknown as CacheStore;
    const service = new CacheService(store);
    const loader = jest.fn().mockResolvedValue('source');
    await expect(service.getOrLoad('reports', 'all', 1_000, loader)).resolves.toBe('source');
    await expect(service.getOrLoad('reports', 'other', 1_000, loader)).resolves.toBe('source');
    expect(store.get).toHaveBeenCalledTimes(1);
    expect(store.set).not.toHaveBeenCalled();
    expect(service.snapshot()).toMatchObject({ status: 'degraded', failures: 1 });
  });
});
