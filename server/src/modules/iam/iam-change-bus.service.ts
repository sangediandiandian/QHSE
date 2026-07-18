import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type IamChangeKind,
  type IamChangeTransport,
  MemoryIamChangeTransport,
} from './iam-change.transport';

@Injectable()
export class IamChangeBusService implements OnModuleDestroy {
  private readonly sourceId: string;
  private published = 0;
  private received = 0;
  private reconciliations = 0;
  private failures = 0;
  private lastPublishedAt?: string;
  private lastReceivedAt?: string;
  private lastErrorAt?: string;
  private lastSuccessAt?: string;

  constructor(
    private readonly transport: IamChangeTransport = new MemoryIamChangeTransport(),
    createId: () => string = randomUUID,
  ) {
    this.sourceId = createId();
  }

  async start(refresh: () => Promise<void>) {
    await this.transport.subscribe(
      async (event) => {
        if (event.sourceId === this.sourceId) return;
        try {
          await refresh();
          this.received += 1;
          this.lastReceivedAt = new Date().toISOString();
          this.lastSuccessAt = this.lastReceivedAt;
        } catch {
          this.recordFailure();
        }
      },
      async () => {
        try {
          await refresh();
          this.reconciliations += 1;
          this.lastSuccessAt = new Date().toISOString();
        } catch {
          this.recordFailure();
        }
      },
    );
  }

  async publish(kind: IamChangeKind, subjectId: string) {
    const occurredAt = new Date().toISOString();
    try {
      await this.transport.publish({
        sourceId: this.sourceId,
        kind,
        subjectId,
        occurredAt,
      });
      this.published += 1;
      this.lastPublishedAt = occurredAt;
      this.lastSuccessAt = occurredAt;
    } catch {
      this.recordFailure();
    }
  }

  recordTransportError() {
    this.recordFailure();
  }

  async check() {
    try {
      await this.transport.ping();
      this.lastSuccessAt = new Date().toISOString();
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  snapshot() {
    const degraded = Boolean(
      this.lastErrorAt && (!this.lastSuccessAt || this.lastErrorAt > this.lastSuccessAt),
    );
    return {
      backend: this.transport.backend,
      status: degraded ? 'degraded' : 'ready',
      published: this.published,
      received: this.received,
      reconciliations: this.reconciliations,
      failures: this.failures,
      lastPublishedAt: this.lastPublishedAt,
      lastReceivedAt: this.lastReceivedAt,
      lastErrorAt: this.lastErrorAt,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  async onModuleDestroy() {
    await this.transport.close();
  }

  private recordFailure() {
    this.failures += 1;
    this.lastErrorAt = new Date().toISOString();
  }
}
