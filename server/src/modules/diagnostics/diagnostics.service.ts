import type { PlatformConfigService } from '../platform-config/platform-config.service';
import type { CacheService } from '../../infrastructure/cache/cache.service';
import type { ReportExportQueueService } from '../reporting/report-export-queue.service';
import type { SessionStoreService } from '../../infrastructure/session/session-store.service';
import type { TracingService } from '../../infrastructure/tracing/tracing.service';
import type { IamChangeBusService } from '../iam/iam-change-bus.service';
import type { OidcService } from '../auth/oidc/oidc.service';
import { RuntimeMetricsService } from './runtime-metrics.service';

export class DiagnosticsService {
  constructor(
    private readonly metrics: RuntimeMetricsService,
    private readonly platformConfig: PlatformConfigService,
    private readonly cache: CacheService,
    private readonly queue: ReportExportQueueService,
    private readonly sessions: SessionStoreService,
    private readonly tracing: TracingService,
    private readonly iamChanges: IamChangeBusService,
    private readonly oidc: OidcService,
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
        accessLogging: process.env.QHSE_ACCESS_LOG === 'false' ? 'disabled' : 'json',
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
      queue: this.queue.snapshot(),
      sessions: this.sessions.snapshot(),
      iamEvents: this.iamChanges.snapshot(),
      identity: this.oidc.snapshot(),
      tracing: this.tracing.snapshot(),
      generatedAt: new Date().toISOString(),
    };
  }
}
