import type { PlatformConfigService } from '../platform-config/platform-config.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { RuntimeMetricsService } from './runtime-metrics.service';

export class DiagnosticsService {
  constructor(
    private readonly metrics: RuntimeMetricsService,
    private readonly platformConfig: PlatformConfigService,
    private readonly cache: CacheService,
  ) {}

  async snapshot() {
    const memory = process.memoryUsage();
    const integrations = await this.platformConfig.listIntegrations();
    return {
      service: {
        name: 'qhse-api',
        status: 'running',
        repository: process.env.QHSE_REPOSITORY === 'prisma' ? 'prisma' : 'memory',
        objectStorage: process.env.QHSE_OBJECT_STORAGE === 's3' ? 's3' : 'local',
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
      },
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external,
      },
      integrations: {
        total: integrations.length,
        enabled: integrations.filter((item) => item.enabled).length,
        unhealthy: integrations.filter(
          (item) => item.enabled && ['degraded', 'disconnected'].includes(item.healthStatus),
        ).length,
        items: integrations.map((item) => ({
          code: item.code,
          name: item.name,
          type: item.type,
          enabled: item.enabled,
          healthStatus: item.healthStatus,
          lastCheckedAt: item.lastCheckedAt,
          owner: item.owner,
        })),
      },
      requests: this.metrics.snapshot(),
      cache: this.cache.snapshot(),
      generatedAt: new Date().toISOString(),
    };
  }
}
