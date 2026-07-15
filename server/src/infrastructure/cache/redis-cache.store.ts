import { createClient } from 'redis';
import type { CacheStore } from './cache-store';

export class RedisCacheStore implements CacheStore {
  readonly backend = 'redis' as const;
  private readonly client;
  private connectPromise?: Promise<void>;

  constructor(url: string) {
    this.client = createClient({
      url,
      socket: { connectTimeout: 2_000, reconnectStrategy: false },
    });
    this.client.on('error', () => undefined);
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.connect();
    const value = await this.client.get(key);
    return value === null ? undefined : (JSON.parse(value) as T);
  }

  async set<T>(key: string, value: T, ttlMs: number) {
    await this.connect();
    await this.client.set(key, JSON.stringify(value), { PX: ttlMs });
  }

  async close() {
    if (this.client.isOpen) await this.client.close();
  }

  private async connect() {
    if (this.client.isReady) return;
    this.connectPromise ??= this.client.connect().then(() => undefined);
    try {
      await this.connectPromise;
    } catch (error) {
      this.connectPromise = undefined;
      throw error;
    }
  }
}
