import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { CacheService } from '../infrastructure/cache/cache.service';
import type { SessionStoreService } from '../infrastructure/session/session-store.service';
import type { ReportExportQueueService } from '../modules/reporting/report-export-queue.service';

interface DependencyCheck {
  name: string;
  backend: string;
  status: 'ready' | 'not_ready';
  durationMs: number;
}

export class HealthService {
  private readonly timeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly sessions: SessionStoreService,
    private readonly queue: ReportExportQueueService,
  ) {
    const configured = Number(process.env.QHSE_READINESS_TIMEOUT_MS || 1_500);
    this.timeoutMs =
      Number.isFinite(configured) && configured >= 100 && configured <= 10_000 ? configured : 1_500;
  }

  liveness() {
    return {
      service: 'qhse-api',
      status: 'alive',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    const checks = await Promise.all([
      this.check(
        'database',
        process.env.QHSE_REPOSITORY === 'prisma' ? 'prisma' : 'memory',
        async () => {
          if (process.env.QHSE_REPOSITORY === 'prisma') {
            await this.prisma.$queryRawUnsafe('SELECT 1');
          }
        },
      ),
      this.check('cache', this.cache.snapshot().backend, () => this.cache.check()),
      this.check('sessions', this.sessions.snapshot().backend, () => this.sessions.check()),
      this.check('queue', this.queue.snapshot().backend, () => this.queue.check()),
    ]);
    const ready = checks.every((item) => item.status === 'ready');
    if (!ready) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: '服务依赖尚未就绪',
        details: { checks },
      });
    }
    return {
      service: 'qhse-api',
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async check(name: string, backend: string, operation: () => Promise<void>) {
    const started = process.hrtime.bigint();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('readiness timeout')), this.timeoutMs);
        }),
      ]);
      return this.result(name, backend, 'ready', started);
    } catch {
      return this.result(name, backend, 'not_ready', started);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private result(
    name: string,
    backend: string,
    status: DependencyCheck['status'],
    started: bigint,
  ): DependencyCheck {
    return {
      name,
      backend,
      status,
      durationMs: Math.round((Number(process.hrtime.bigint() - started) / 1_000_000) * 100) / 100,
    };
  }
}
