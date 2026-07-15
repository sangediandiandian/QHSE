/** @jest-environment node */

import type { PlatformConfigService } from '../platform-config/platform-config.service';
import { DiagnosticsService } from './diagnostics.service';
import { RuntimeMetricsService } from './runtime-metrics.service';
import type { CacheService } from '../../infrastructure/cache/cache.service';
import type { ReportExportQueueService } from '../reporting/report-export-queue.service';
import type { SessionStoreService } from '../../infrastructure/session/session-store.service';
import type { TracingService } from '../../infrastructure/tracing/tracing.service';

describe('RuntimeMetricsService', () => {
  test('按方法和路由模板聚合请求量、错误率与耗时', () => {
    const service = new RuntimeMetricsService();
    service.record('GET', '/api/v1/hazards/:id', 200, 10, new Date('2026-07-15T08:00:00Z'));
    service.record('GET', '/api/v1/hazards/:id', 404, 30, new Date('2026-07-15T08:01:00Z'));
    const snapshot = service.snapshot();
    expect(snapshot).toMatchObject({ totalRequests: 2, totalErrors: 1 });
    expect(snapshot.routes[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/hazards/:id',
      count: 2,
      errorCount: 1,
      averageDurationMs: 20,
      durationMaxMs: 30,
      errorRate: 50,
      lastStatus: 404,
    });
  });

  test('不同方法和路由独立计数并按请求量排序', () => {
    const service = new RuntimeMetricsService();
    service.record('POST', '/api/v1/hazards', 201, 8);
    service.record('GET', '/api/v1/risks', 200, 4);
    service.record('GET', '/api/v1/risks', 200, 6);
    expect(service.snapshot().routes.map((item) => `${item.method} ${item.path}`)).toEqual([
      'GET /api/v1/risks',
      'POST /api/v1/hazards',
    ]);
  });
});

describe('DiagnosticsService', () => {
  test('汇总进程、存储模式、集成和请求指标且不返回端点或凭据', async () => {
    const metrics = new RuntimeMetricsService();
    metrics.record('GET', '/api/health', 200, 2);
    const config = {
      listIntegrations: jest.fn().mockResolvedValue([
        {
          code: 'gds_gateway',
          name: 'GDS 网关',
          type: 'telemetry',
          endpoint: 'mqtts://internal.example',
          enabled: true,
          healthStatus: 'disconnected',
          owner: '仪表班',
        },
      ]),
    } as unknown as PlatformConfigService;
    const cache = {
      snapshot: () => ({ backend: 'memory', status: 'ready', hits: 1, misses: 1 }),
    } as unknown as CacheService;
    const queue = {
      snapshot: () => ({ backend: 'memory', retainedJobs: 2 }),
    } as unknown as ReportExportQueueService;
    const sessions = {
      snapshot: () => ({ backend: 'memory', status: 'ready', operations: 3, failures: 0 }),
    } as unknown as SessionStoreService;
    const tracing = {
      snapshot: () => ({ exporter: 'disabled', spansStarted: 4, spansEnded: 3 }),
    } as unknown as TracingService;
    const value = await new DiagnosticsService(
      metrics,
      config,
      cache,
      queue,
      sessions,
      tracing,
    ).snapshot();
    expect(value.integrations).toMatchObject({ total: 1, enabled: 1, unhealthy: 1 });
    expect(value.integrations.items[0]).not.toHaveProperty('endpoint');
    expect(value.requests.totalRequests).toBe(1);
    expect(value.service.name).toBe('qhse-api');
    expect(value.cache).toMatchObject({ backend: 'memory', hits: 1 });
    expect(value.queue).toMatchObject({ backend: 'memory', retainedJobs: 2 });
    expect(value.sessions).toMatchObject({ backend: 'memory', operations: 3 });
    expect(value.tracing).toMatchObject({ exporter: 'disabled', spansStarted: 4, spansEnded: 3 });
  });
});
