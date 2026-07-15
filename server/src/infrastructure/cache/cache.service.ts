import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { CacheStore } from './cache-store';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private hits = 0;
  private misses = 0;
  private writes = 0;
  private failures = 0;
  private invalidations = 0;
  private lastErrorAt?: string;
  private lastSuccessAt?: string;
  private unavailableUntil = 0;

  constructor(private readonly store: CacheStore) {}

  async getOrLoad<T>(namespace: string, key: string, ttlMs: number, loader: () => Promise<T>) {
    const cacheKey = `qhse:${namespace}:${key}`;
    if (Date.now() >= this.unavailableUntil) {
      try {
        const cached = await this.store.get<T>(cacheKey);
        this.lastSuccessAt = new Date().toISOString();
        if (cached !== undefined) {
          this.hits += 1;
          return cached;
        }
        this.misses += 1;
      } catch {
        this.misses += 1;
        this.recordFailure();
      }
    } else {
      this.misses += 1;
    }

    const current = this.inFlight.get(cacheKey) as Promise<T> | undefined;
    if (current) return current;
    const pending = loader()
      .then(async (value) => {
        if (Date.now() >= this.unavailableUntil) {
          try {
            await this.store.set(cacheKey, value, ttlMs);
            this.writes += 1;
            this.lastSuccessAt = new Date().toISOString();
          } catch {
            this.recordFailure();
          }
        }
        return value;
      })
      .finally(() => this.inFlight.delete(cacheKey));
    this.inFlight.set(cacheKey, pending);
    return pending;
  }

  snapshot() {
    const degraded = Boolean(
      this.lastErrorAt && (!this.lastSuccessAt || this.lastErrorAt > this.lastSuccessAt),
    );
    return {
      backend: this.store.backend,
      status: degraded ? 'degraded' : 'ready',
      hits: this.hits,
      misses: this.misses,
      writes: this.writes,
      failures: this.failures,
      invalidations: this.invalidations,
      inFlight: this.inFlight.size,
      lastErrorAt: this.lastErrorAt,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  async check() {
    try {
      await this.store.ping();
      this.lastSuccessAt = new Date().toISOString();
      this.unavailableUntil = 0;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  async invalidate(namespace: string) {
    const prefix = `qhse:${namespace}:`;
    const loading = [...this.inFlight.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, pending]) => pending.catch(() => undefined));
    await Promise.all(loading);
    try {
      await this.store.deleteByPrefix(prefix);
      this.invalidations += 1;
      this.lastSuccessAt = new Date().toISOString();
    } catch {
      this.recordFailure();
    }
  }

  async onModuleDestroy() {
    await this.store.close();
  }

  private recordFailure() {
    this.failures += 1;
    this.lastErrorAt = new Date().toISOString();
    this.unavailableUntil = Date.now() + 30_000;
  }
}
