import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { ReportQueryDto } from './report-query.dto';
import { ReportingService } from './reporting.service';

type ExportStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface ExportPayload {
  ownerId: string;
  query: ReportQueryDto;
  allowedAreaIds?: string[];
}

interface ExportResult {
  content: string;
  filename: string;
}

interface MemoryExportJob extends ExportPayload {
  id: string;
  status: ExportStatus;
  createdAt: string;
  completedAt?: string;
  result?: ExportResult;
}

function redisConnection(value: string, worker: boolean): ConnectionOptions {
  const url = new URL(value);
  if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('Queue Redis URL is invalid');
  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  if (!Number.isInteger(db) || db < 0) throw new Error('Queue Redis database is invalid');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db,
    maxRetriesPerRequest: worker ? null : 1,
    connectTimeout: 2_000,
    enableOfflineQueue: worker,
    retryStrategy: worker ? (attempt) => Math.min(attempt * 500, 5_000) : () => null,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

@Injectable()
export class ReportExportQueueService implements OnModuleDestroy {
  private readonly mode = process.env.QHSE_QUEUE === 'redis' ? 'redis' : 'memory';
  private readonly memoryJobs = new Map<string, MemoryExportJob>();
  private queue?: Queue<ExportPayload, ExportResult>;
  private worker?: Worker<ExportPayload, ExportResult>;
  private failures = 0;
  private lastErrorAt?: string;
  private lastSuccessAt?: string;

  constructor(private readonly reports: ReportingService) {
    if (this.mode === 'redis') this.initializeRedis();
  }

  async create(payload: ExportPayload) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    if (this.mode === 'redis') {
      try {
        await this.queue!.add('report-export', payload, {
          jobId: id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: { age: 86_400, count: 1_000 },
        });
        this.recordSuccess();
      } catch {
        this.recordFailure();
        throw new ServiceUnavailableException({
          code: 'REPORT_QUEUE_UNAVAILABLE',
          message: '报表任务队列暂不可用，请稍后重试',
        });
      }
      return { id, status: 'queued' as const, createdAt, backend: 'redis' as const };
    }

    this.cleanupMemoryJobs();
    const job: MemoryExportJob = { ...payload, id, status: 'queued', createdAt };
    this.memoryJobs.set(id, job);
    this.recordSuccess();
    setImmediate(() => void this.processMemoryJob(job));
    return { id, status: job.status, createdAt, backend: 'memory' as const };
  }

  async get(id: string, ownerId: string) {
    if (this.mode === 'redis') {
      const job = await this.queue!.getJob(id);
      if (!job || job.data.ownerId !== ownerId) throw this.notFound();
      return this.redisMetadata(job);
    }
    const job = this.memoryJobs.get(id);
    if (!job || job.ownerId !== ownerId) throw this.notFound();
    return this.memoryMetadata(job);
  }

  async content(id: string, ownerId: string) {
    if (this.mode === 'redis') {
      const job = await this.queue!.getJob(id);
      if (!job || job.data.ownerId !== ownerId) throw this.notFound();
      const state = await job.getState();
      if (state !== 'completed' || !job.returnvalue) throw this.notReady();
      return {
        body: Buffer.from(job.returnvalue.content, 'base64'),
        filename: job.returnvalue.filename,
      };
    }
    const job = this.memoryJobs.get(id);
    if (!job || job.ownerId !== ownerId) throw this.notFound();
    if (job.status !== 'completed' || !job.result) throw this.notReady();
    return { body: Buffer.from(job.result.content, 'base64'), filename: job.result.filename };
  }

  snapshot() {
    const degraded = Boolean(
      this.lastErrorAt && (!this.lastSuccessAt || this.lastErrorAt > this.lastSuccessAt),
    );
    return {
      backend: this.mode,
      status: degraded ? 'degraded' : 'ready',
      failures: this.failures,
      lastErrorAt: this.lastErrorAt,
      lastSuccessAt: this.lastSuccessAt,
      retainedJobs: this.mode === 'memory' ? this.memoryJobs.size : undefined,
    };
  }

  async check() {
    try {
      if (this.mode === 'redis') await this.queue!.getJobCounts('waiting', 'active', 'delayed');
      this.recordSuccess();
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private initializeRedis() {
    const url = process.env.QHSE_QUEUE_REDIS_URL || process.env.QHSE_REDIS_URL;
    if (!url) throw new Error('QHSE_QUEUE=redis requires QHSE_QUEUE_REDIS_URL or QHSE_REDIS_URL');
    const queueConnection = redisConnection(url, false);
    const workerConnection = redisConnection(url, true);
    this.queue = new Queue<ExportPayload, ExportResult>('qhse-report-exports', {
      connection: queueConnection,
      prefix: 'qhse',
    });
    this.worker = new Worker<ExportPayload, ExportResult>(
      'qhse-report-exports',
      (job) => this.generate(job.data),
      { connection: workerConnection, prefix: 'qhse', concurrency: 2 },
    );
    this.queue.on('error', () => undefined);
    this.worker.on('error', () => undefined);
  }

  private async processMemoryJob(job: MemoryExportJob) {
    job.status = 'processing';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        job.result = await this.generate(job);
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        return;
      } catch {
        if (attempt === 3) {
          job.status = 'failed';
          job.completedAt = new Date().toISOString();
        }
      }
    }
  }

  private async generate(payload: ExportPayload): Promise<ExportResult> {
    const body = await this.reports.csv(payload.query, payload.allowedAreaIds);
    return {
      content: body.toString('base64'),
      filename: `QHSE统计报表_${payload.query.from || 'auto'}_${payload.query.to || 'auto'}.csv`,
    };
  }

  private async redisMetadata(job: Job<ExportPayload, ExportResult>) {
    const state = await job.getState();
    const status: ExportStatus =
      state === 'active'
        ? 'processing'
        : state === 'completed'
          ? 'completed'
          : state === 'failed'
            ? 'failed'
            : 'queued';
    return {
      id: job.id,
      status,
      createdAt: new Date(job.timestamp).toISOString(),
      completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
      filename: job.returnvalue?.filename,
      backend: 'redis' as const,
    };
  }

  private memoryMetadata(job: MemoryExportJob) {
    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      filename: job.result?.filename,
      backend: 'memory' as const,
    };
  }

  private cleanupMemoryJobs() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1_000;
    for (const [id, job] of this.memoryJobs) {
      if (new Date(job.createdAt).getTime() < cutoff) this.memoryJobs.delete(id);
    }
    while (this.memoryJobs.size >= 1_000) {
      const oldest = this.memoryJobs.keys().next().value as string | undefined;
      if (!oldest) break;
      this.memoryJobs.delete(oldest);
    }
  }

  private notFound() {
    return new NotFoundException({ code: 'REPORT_EXPORT_NOT_FOUND', message: '导出任务不存在' });
  }

  private notReady() {
    return new ConflictException({ code: 'REPORT_EXPORT_NOT_READY', message: '导出任务尚未完成' });
  }

  private recordSuccess() {
    this.lastSuccessAt = new Date().toISOString();
  }

  private recordFailure() {
    this.failures += 1;
    this.lastErrorAt = new Date().toISOString();
  }
}
